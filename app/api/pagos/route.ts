import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";
import type { PaymentType, OrderStatus } from "@/app/generated/prisma/client";

export async function GET(request: NextRequest) {
  const auth = await withRole(["admin", "inventario"]);
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const metodo = sp.get("metodo") as PaymentType | null;
  const desde = sp.get("desde") ?? "";
  const hasta = sp.get("hasta") ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const pageSize = 25;

  const STATUSES: OrderStatus[] = ["pendiente_pago", "pago_parcial"];
  const where = {
    status: { in: STATUSES },
    ...(metodo && { payments: { some: { payment_type: metodo } } }),
    ...(desde && !hasta && { created_at: { gte: new Date(desde) } }),
    ...(hasta && !desde && { created_at: { lte: new Date(`${hasta}T23:59:59`) } }),
    ...(desde && hasta && { created_at: { gte: new Date(desde), lte: new Date(`${hasta}T23:59:59`) } }),
    ...(q && {
      OR: [
        { customer_name: { contains: q, mode: "insensitive" as const } },
        { customer_lastname: { contains: q, mode: "insensitive" as const } },
        { order_number: { contains: q, mode: "insensitive" as const } },
        { payments: { some: { reference: { contains: q, mode: "insensitive" as const } } } },
      ],
    }),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        payments: {
          where: { status: { not: "rechazado" } },
          orderBy: { created_at: "asc" },
        },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  const data = orders.map((o) => ({
    id: o.id,
    order_number: o.order_number,
    channel: o.channel,
    status: o.status,
    customer_name: o.customer_name,
    customer_lastname: o.customer_lastname,
    total_usd: Number(o.total_usd),
    is_partial_agreed: o.is_partial_agreed,
    paid_usd: o.payments.reduce((s, p) => s + Number(p.amount_usd), 0),
    payments: o.payments.map((p) => ({
      id: p.id,
      payment_type: p.payment_type,
      amount_usd: Number(p.amount_usd),
      reference: p.reference,
      payment_date: p.payment_date.toISOString().slice(0, 10),
      status: p.status,
    })),
    creator: o.creator,
    created_at: o.created_at.toISOString(),
  }));

  return NextResponse.json({ data, total, page, totalPages: Math.ceil(total / pageSize) });
}
