import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

function serializeCart(cart: Awaited<ReturnType<typeof fetchCart>>) {
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
    created_at: cart.created_at.toISOString(),
    updated_at: cart.updated_at.toISOString(),
    vendor: cart.vendor,
    items,
    total_usd,
    has_stock_issues,
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

  const full = await fetchCart(id);
  return NextResponse.json(serializeCart(full));
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

  // Update note if provided
  if ("note" in body) {
    await prisma.cart.update({
      where: { id },
      data: { note: body.note?.trim() || null },
    });
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
      // Get current price
      const variant = await prisma.productVariant.findUnique({ where: { id: variant_id } });
      if (!variant || !variant.is_active) {
        return NextResponse.json({ error: "Variante no encontrada" }, { status: 404 });
      }

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
            unit_price_usd: variant.price_usd,
          },
        });
      }
    }

    // Touch updated_at
    await prisma.cart.update({ where: { id }, data: { updated_at: new Date() } });
  }

  const updated = await fetchCart(id);
  return NextResponse.json(serializeCart(updated));
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
