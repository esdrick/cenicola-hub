import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, withRole } from "@/lib/api-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      creator: { select: { id: true, name: true } },
      items: {
        include: {
          variant: {
            include: {
              product: { select: { id: true, name: true, color: true, photos: true } },
            },
          },
        },
      },
      payments: { orderBy: { created_at: "asc" } },
    },
  });

  if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

  // Vendedoras can only see their own orders
  const restricted = auth.session.role === "vendedora_online" || auth.session.role === "vendedora_tienda";
  if (restricted && order.created_by !== auth.session.id) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const data = {
    ...order,
    total_usd: Number(order.total_usd),
    created_at: order.created_at.toISOString(),
    updated_at: order.updated_at.toISOString(),
    items: order.items.map((item) => ({
      ...item,
      unit_price_usd: Number(item.unit_price_usd),
      subtotal_usd: Number(item.subtotal_usd),
      variant: {
        ...item.variant,
        updated_at: item.variant.updated_at.toISOString(),
      },
    })),
    payments: order.payments.map((p) => ({
      ...p,
      amount_usd: Number(p.amount_usd),
      amount_ves: p.amount_ves ? Number(p.amount_ves) : null,
      payment_date: p.payment_date.toISOString().slice(0, 10),
      verified_at: p.verified_at?.toISOString() ?? null,
      created_at: p.created_at.toISOString(),
    })),
  };

  return NextResponse.json(data);
}

