import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { resolveSplitSubtotal } from "@/lib/pricing";
import { getSetting } from "@/lib/settings";

// Recomputes subtotal_bcv_usd/subtotal_divisas_usd/unit_price_usd for every line against the
// cart's current total quantity (the tier signal), WITHOUT touching how each line's quantity
// is split between currencies — that split is only ever changed explicitly (item upsert defaults
// it, or the dedicated `split` action below).
async function repriceAllCartItems(cartId: string, mayorThreshold: number, bundleThreshold: number) {
  const items = await prisma.cartItem.findMany({
    where: { cart_id: cartId },
    include: { variant: true },
  });
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  for (const item of items) {
    const { subtotalBcv, subtotalDivisas } = resolveSplitSubtotal(
      item.variant, item.quantity_bcv, item.quantity_divisas, totalQty, mayorThreshold, bundleThreshold,
    );
    const newUnitPrice = item.quantity > 0 ? (subtotalBcv + subtotalDivisas) / item.quantity : 0;
    if (
      Number(item.subtotal_bcv_usd) !== subtotalBcv ||
      Number(item.subtotal_divisas_usd) !== subtotalDivisas
    ) {
      await prisma.cartItem.update({
        where: { id: item.id },
        data: {
          subtotal_bcv_usd: subtotalBcv,
          subtotal_divisas_usd: subtotalDivisas,
          unit_price_usd: parseFloat(newUnitPrice.toFixed(2)),
        },
      });
    }
  }
}

// Moves every line that ISN'T already split by the vendor fully into `newMethod`'s bucket —
// used only when the whole-cart currency picker changes (before any per-line split exists).
// Lines the vendor has explicitly split are left alone so this can't silently collapse them.
async function realignUnsplitItems(cartId: string, newMethod: "bcv" | "divisas") {
  const items = await prisma.cartItem.findMany({ where: { cart_id: cartId } });
  for (const item of items) {
    const isSplit = item.quantity_bcv > 0 && item.quantity_divisas > 0;
    if (isSplit) continue;
    await prisma.cartItem.update({
      where: { id: item.id },
      data: {
        quantity_bcv: newMethod === "bcv" ? item.quantity : 0,
        quantity_divisas: newMethod === "divisas" ? item.quantity : 0,
      },
    });
  }
}

// Forces EVERY line (including ones the vendor explicitly split) fully into `method`'s bucket —
// used when the vendor turns the "dividir por moneda" switch back off, so the cart returns to
// its single-currency price instead of quietly keeping whatever split was left behind.
async function resetAllItemsToMethod(cartId: string, method: "bcv" | "divisas") {
  const items = await prisma.cartItem.findMany({ where: { cart_id: cartId } });
  for (const item of items) {
    await prisma.cartItem.update({
      where: { id: item.id },
      data: {
        quantity_bcv: method === "bcv" ? item.quantity : 0,
        quantity_divisas: method === "divisas" ? item.quantity : 0,
      },
    });
  }
}

function serializeCart(
  cart: Awaited<ReturnType<typeof fetchCart>>,
  thresholds: { mayorThreshold: number; bundleThreshold: number },
) {
  const channel = cart.channel;
  const items = cart.items.map((item) => {
    const stock = channel === "online" ? item.variant.stock_online : item.variant.stock_store;
    return {
      id: item.id,
      cart_id: item.cart_id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price_usd: Number(item.unit_price_usd),
      quantity_bcv: item.quantity_bcv,
      quantity_divisas: item.quantity_divisas,
      subtotal_bcv_usd: Number(item.subtotal_bcv_usd),
      subtotal_divisas_usd: Number(item.subtotal_divisas_usd),
      created_at: item.created_at.toISOString(),
      stock_warning: stock < item.quantity,
      stock_available: stock,
      variant: {
        id: item.variant.id,
        size: item.variant.size,
        sku: item.variant.sku,
        stock_online: item.variant.stock_online,
        stock_store: item.variant.stock_store,
        product: {
          id: item.variant.product.id,
          name: item.variant.product.name,
          color: item.variant.product.color,
          photos: item.variant.product.photos,
        },
      },
    };
  });

  const total_bcv_usd = parseFloat(items.reduce((s, i) => s + i.subtotal_bcv_usd, 0).toFixed(2));
  const total_divisas_usd = parseFloat(items.reduce((s, i) => s + i.subtotal_divisas_usd, 0).toFixed(2));
  const total_usd = parseFloat((total_bcv_usd + total_divisas_usd).toFixed(2));
  const has_stock_issues = items.some((i) => i.stock_warning);

  return {
    id: cart.id,
    vendor_id: cart.vendor_id,
    channel: cart.channel,
    note: cart.note,
    status: cart.status,
    pricing_method: cart.pricing_method,
    created_at: cart.created_at.toISOString(),
    updated_at: cart.updated_at.toISOString(),
    vendor: cart.vendor,
    items,
    total_usd,
    total_bcv_usd,
    total_divisas_usd,
    has_stock_issues,
    mayor_threshold: thresholds.mayorThreshold,
    bundle_threshold: thresholds.bundleThreshold,
  };
}

async function fetchCart(id: string) {
  return prisma.cart.findUniqueOrThrow({
    where: { id },
    include: {
      vendor: { select: { id: true, name: true } },
      items: {
        include: {
          variant: {
            include: {
              product: { select: { id: true, name: true, color: true, photos: true } },
            },
          },
        },
        orderBy: { created_at: "asc" },
      },
    },
  });
}

type Params = { params: Promise<{ id: string }> };

// GET /api/carts/[id]
export async function GET(_: NextRequest, { params }: Params) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const cart = await prisma.cart.findUnique({ where: { id } });
  if (!cart) return NextResponse.json({ error: "Carrito no encontrado" }, { status: 404 });

  const isVendor =
    auth.session.role === "vendedora_online" || auth.session.role === "vendedora_tienda";
  if (isVendor && cart.vendor_id !== auth.session.id) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const [mayorThreshold, bundleThreshold] = await Promise.all([
    getSetting("mayor_threshold"),
    getSetting("bundle_threshold"),
  ]);

  const full = await fetchCart(id);
  return NextResponse.json(serializeCart(full, { mayorThreshold, bundleThreshold }));
}

// PUT /api/carts/[id] — update note and/or items
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const cart = await prisma.cart.findUnique({ where: { id } });
  if (!cart) return NextResponse.json({ error: "Carrito no encontrado" }, { status: 404 });

  const isVendor =
    auth.session.role === "vendedora_online" || auth.session.role === "vendedora_tienda";
  if (isVendor && cart.vendor_id !== auth.session.id) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  if (cart.status !== "active") {
    return NextResponse.json({ error: "No se puede editar un carrito en conversión" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));

  const [mayorThreshold, bundleThreshold] = await Promise.all([
    getSetting("mayor_threshold"),
    getSetting("bundle_threshold"),
  ]);

  // Update note if provided
  if ("note" in body) {
    await prisma.cart.update({
      where: { id },
      data: { note: body.note?.trim() || null },
    });
  }

  // Tracks the pricing method new (unsplit) items default into, in case it's changed in this same request
  let activeMethod: "bcv" | "divisas" = cart.pricing_method;

  // Handle pricing_method change — realigns every NOT-yet-split line to the new currency and
  // reprices. Lines the vendor already split explicitly (via `split` below) are left untouched.
  if ("pricing_method" in body && (body.pricing_method === "bcv" || body.pricing_method === "divisas")) {
    const newMethod = body.pricing_method as "bcv" | "divisas";
    if (newMethod !== cart.pricing_method) {
      activeMethod = newMethod;
      await realignUnsplitItems(id, newMethod);
      await repriceAllCartItems(id, mayorThreshold, bundleThreshold);
      await prisma.cart.update({ where: { id }, data: { pricing_method: newMethod, updated_at: new Date() } });
    }
  }

  // Handle item upsert: { variant_id, quantity }
  if (body.item) {
    const { variant_id, quantity } = body.item as { variant_id: string; quantity: number };

    if (!variant_id) {
      return NextResponse.json({ error: "variant_id requerido" }, { status: 400 });
    }

    if (quantity <= 0) {
      // Remove item
      await prisma.cartItem.deleteMany({ where: { cart_id: id, variant_id } });
    } else {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variant_id },
        include: { product: { select: { quick_sale: true } } },
      });
      if (!variant || !variant.is_active) {
        return NextResponse.json({ error: "Variante no encontrada" }, { status: 404 });
      }

      if (auth.session.role === "vendedora_tienda" && !variant.product.quick_sale) {
        return NextResponse.json({ error: "Este producto no está disponible para venta rápida" }, { status: 403 });
      }

      // Any explicit quantity change (via product-step editing) resets this line back to a
      // single currency bucket — a per-line split only ever comes from the dedicated `split`
      // action below, against a known/final quantity. Prices are placeholders here;
      // repriceAllCartItems below immediately recomputes them.
      const existing = await prisma.cartItem.findFirst({ where: { cart_id: id, variant_id } });
      if (existing) {
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity,
            quantity_bcv: activeMethod === "bcv" ? quantity : 0,
            quantity_divisas: activeMethod === "divisas" ? quantity : 0,
          },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cart_id: id,
            variant_id,
            quantity,
            unit_price_usd: variant.price_bcv,
            quantity_bcv: activeMethod === "bcv" ? quantity : 0,
            quantity_divisas: activeMethod === "divisas" ? quantity : 0,
          },
        });
      }
    }

    // Reprice every remaining line against the cart's new total quantity — a tier
    // change (paquete/mayor) must apply to all products in the cart, not just the
    // one just added/edited/removed.
    await repriceAllCartItems(id, mayorThreshold, bundleThreshold);

    // Touch updated_at
    await prisma.cart.update({ where: { id }, data: { updated_at: new Date() } });
  }

  // Handle per-line currency split: { variant_id, quantity_bcv, quantity_divisas } — this is
  // the only place a line ever ends up genuinely split across both buckets (opt-in, from the
  // payment step). quantity_bcv + quantity_divisas must equal the line's existing quantity;
  // the tier itself never changes here since total cart quantity is untouched.
  if (body.split) {
    const { variant_id, quantity_bcv, quantity_divisas } = body.split as {
      variant_id: string; quantity_bcv: number; quantity_divisas: number;
    };
    if (!variant_id || !Number.isInteger(quantity_bcv) || !Number.isInteger(quantity_divisas) || quantity_bcv < 0 || quantity_divisas < 0) {
      return NextResponse.json({ error: "Reparto inválido" }, { status: 400 });
    }
    const item = await prisma.cartItem.findFirst({ where: { cart_id: id, variant_id } });
    if (!item) return NextResponse.json({ error: "Producto no encontrado en el carrito" }, { status: 404 });
    if (quantity_bcv + quantity_divisas !== item.quantity) {
      return NextResponse.json({ error: "El reparto debe sumar la cantidad total de la línea" }, { status: 400 });
    }

    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity_bcv, quantity_divisas } });
    await repriceAllCartItems(id, mayorThreshold, bundleThreshold);
    await prisma.cart.update({ where: { id }, data: { updated_at: new Date() } });
  }

  // Handle turning the per-line split off: collapse EVERY line (even ones the vendor had
  // explicitly split) back into the cart's single pricing_method bucket, so the total returns
  // to the single-currency price instead of keeping whatever split was left behind.
  if (body.reset_split === true) {
    await resetAllItemsToMethod(id, cart.pricing_method);
    await repriceAllCartItems(id, mayorThreshold, bundleThreshold);
    await prisma.cart.update({ where: { id }, data: { updated_at: new Date() } });
  }

  // Don't persist an empty, untitled cart — remove it instead of leaving an orphan
  const [itemCount, current] = await Promise.all([
    prisma.cartItem.count({ where: { cart_id: id } }),
    prisma.cart.findUnique({ where: { id }, select: { note: true } }),
  ]);
  if (itemCount === 0 && !current?.note?.trim()) {
    await prisma.cart.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  }

  const updated = await fetchCart(id);
  return NextResponse.json(serializeCart(updated, { mayorThreshold, bundleThreshold }));
}

// DELETE /api/carts/[id]
export async function DELETE(_: NextRequest, { params }: Params) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const cart = await prisma.cart.findUnique({ where: { id } });
  if (!cart) return NextResponse.json({ error: "Carrito no encontrado" }, { status: 404 });

  const isVendor =
    auth.session.role === "vendedora_online" || auth.session.role === "vendedora_tienda";
  if (isVendor && cart.vendor_id !== auth.session.id) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  await prisma.cart.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
