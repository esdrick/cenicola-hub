import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { resolveUnitPrice } from "@/lib/pricing";
import { getSetting } from "@/lib/settings";

async function repriceAllCartItems(
  cartId: string,
  method: "bcv" | "divisas",
  mayorThreshold: number,
  bundleThreshold: number,
) {
  const items = await prisma.cartItem.findMany({
    where: { cart_id: cartId },
    include: { variant: true },
  });
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  for (const item of items) {
    const newPrice = resolveUnitPrice(item.variant, method, totalQty, mayorThreshold, bundleThreshold);
    if (Number(item.unit_price_usd) !== Number(newPrice)) {
      await prisma.cartItem.update({ where: { id: item.id }, data: { unit_price_usd: newPrice } });
    }
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

  const total_usd = items.reduce((s, i) => s + i.unit_price_usd * i.quantity, 0);
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

  // Tracks the pricing method to use for repricing below, in case it's changed in this same request
  let activeMethod: "bcv" | "divisas" = cart.pricing_method;

  // Handle pricing_method change — reprices all items
  if ("pricing_method" in body && (body.pricing_method === "bcv" || body.pricing_method === "divisas")) {
    const newMethod = body.pricing_method as "bcv" | "divisas";
    if (newMethod !== cart.pricing_method) {
      activeMethod = newMethod;
      await repriceAllCartItems(id, newMethod, mayorThreshold, bundleThreshold);
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
      const variant = await prisma.productVariant.findUnique({ where: { id: variant_id } });
      if (!variant || !variant.is_active) {
        return NextResponse.json({ error: "Variante no encontrada" }, { status: 404 });
      }

      // unit_price_usd is a placeholder here — repriceAllCartItems below immediately
      // recomputes it (and every other line) against the cart's new total quantity.
      const existing = await prisma.cartItem.findFirst({ where: { cart_id: id, variant_id } });
      if (existing) {
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cart_id: id,
            variant_id,
            quantity,
            unit_price_usd: variant.price_bcv,
          },
        });
      }
    }

    // Reprice every remaining line against the cart's new total quantity — a tier
    // change (paquete/mayor) must apply to all products in the cart, not just the
    // one just added/edited/removed.
    await repriceAllCartItems(id, activeMethod, mayorThreshold, bundleThreshold);

    // Touch updated_at
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
