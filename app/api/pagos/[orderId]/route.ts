import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const auth = await withRole(["admin", "inventario"]);
  if (!auth.ok) return auth.response;

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
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
      payments: {
        include: {
          exchange_rate: { select: { rate_date: true, usd_to_ves: true } },
        },
        orderBy: { created_at: "desc" },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

  // Detect duplicate reference_hash across other orders
  const duplicates = new Map<string, string | null>();
  for (const p of order.payments) {
    if (!p.reference_hash || p.status === "rechazado") {
      duplicates.set(p.id, null);
      continue;
    }
    const dup = await prisma.orderPayment.findFirst({
      where: {
        reference_hash: p.reference_hash,
        payment_type: p.payment_type,
        status: { not: "rechazado" },
        order_id: { not: order.id },
      },
      include: { order: { select: { order_number: true } } },
    });
    duplicates.set(p.id, dup?.order.order_number ?? null);
  }

  const data = {
    id: order.id,
    order_number: order.order_number,
    channel: order.channel,
    status: order.status,
    customer_name: order.customer_name,
    customer_lastname: order.customer_lastname,
    customer_id_doc: order.customer_id_doc,
    address: order.address,
    shipping_company: order.shipping_company,
    total_usd: Number(order.total_usd),
    is_partial_agreed: order.is_partial_agreed,
    partial_agreed_by: order.partial_agreed_by,
    notes: order.notes,
    created_by: order.created_by,
    created_at: order.created_at.toISOString(),
    updated_at: order.updated_at.toISOString(),
    creator: order.creator,
    items: order.items.map((item) => ({
      id: item.id,
      order_id: item.order_id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price_usd: Number(item.unit_price_usd),
      subtotal_usd: Number(item.subtotal_usd),
      variant_snapshot: item.variant_snapshot,
      variant: {
        id: item.variant.id,
        size: item.variant.size,
        sku: item.variant.sku,
        price_usd: Number(item.variant.price_usd),
        updated_at: item.variant.updated_at.toISOString(),
        product: item.variant.product,
      },
    })),
    payments: order.payments.map((p) => ({
      id: p.id,
      order_id: p.order_id,
      payment_type: p.payment_type,
      amount_usd: Number(p.amount_usd),
      amount_ves: p.amount_ves ? Number(p.amount_ves) : null,
      exchange_rate_id: p.exchange_rate_id,
      is_partial: p.is_partial,
      payment_date: p.payment_date.toISOString().slice(0, 10),
      payment_time: p.payment_time,
      reference: p.reference,
      reference_hash: p.reference_hash,
      payment_photo: p.payment_photo,
      status: p.status,
      rejection_reason: p.rejection_reason,
      verified_by: p.verified_by,
      verified_at: p.verified_at?.toISOString() ?? null,
      created_at: p.created_at.toISOString(),
      exchange_rate: p.exchange_rate
        ? {
            rate_date: p.exchange_rate.rate_date.toISOString().slice(0, 10),
            usd_to_ves: Number(p.exchange_rate.usd_to_ves),
          }
        : null,
      duplicate_order_number: duplicates.get(p.id) ?? null,
    })),
  };

  return NextResponse.json(data);
}
