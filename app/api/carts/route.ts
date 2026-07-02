import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import type { OrderChannel } from "@/app/generated/prisma/client";

function cartChannel(role: string): OrderChannel {
  if (role === "vendedora_tienda") return "tienda";
  if (role === "vendedora_online") return "online";
  return "tienda"; // default for admin
}

type CartWithItems = {
  id: string;
  vendor_id: string;
  channel: OrderChannel;
  note: string | null;
  status: "active" | "converting";
  pricing_method: "bcv" | "divisas";
  created_at: Date;
  updated_at: Date;
  vendor: { id: string; name: string };
  items: Array<{
    id: string;
    cart_id: string;
    variant_id: string;
    quantity: number;
    unit_price_usd: { toFixed?: (d: number) => string } | number;
    created_at: Date;
    variant: {
      id: string;
      size: string;
      sku: string;
      stock_online: number;
      stock_store: number;
      product: { id: string; name: string; color: string | null; photos: string[] };
    };
  }>;
};

function serializeCart(cart: CartWithItems) {
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
  };
}

// GET /api/carts — list vendor's active carts
export async function GET() {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const carts = await prisma.cart.findMany({
    where: {
      vendor_id: auth.session.id,
      status: "active",
    },
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
    orderBy: { updated_at: "desc" },
  });

  return NextResponse.json(carts.map(serializeCart));
}

// POST /api/carts — create new cart
export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const note: string | undefined = body.note?.trim() || undefined;
  // Admin and inventario can specify channel; vendors get it from their role
  const channel: OrderChannel =
    (auth.session.role === "admin" || auth.session.role === "inventario") && body.channel
      ? (body.channel as OrderChannel)
      : cartChannel(auth.session.role);

  const cart = await prisma.cart.create({
    data: {
      vendor_id: auth.session.id,
      channel,
      note: note ?? null,
    },
    include: {
      vendor: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(
    { ...cart, items: [], total_usd: 0, has_stock_issues: false, created_at: cart.created_at.toISOString(), updated_at: cart.updated_at.toISOString() },
    { status: 201 }
  );
}
