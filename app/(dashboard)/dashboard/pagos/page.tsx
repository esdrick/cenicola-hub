export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PagosTable } from "@/components/shared/pagos/PagosTable";
import type { PagoOrdenJSON } from "@/types";
import type { PaymentType, OrderStatus } from "@/app/generated/prisma/client";

type SP = { [key: string]: string | string[] | undefined };
function s(v: string | string[] | undefined) { return typeof v === "string" ? v : ""; }

const PAGE_SIZE = 25;

export default async function PagosPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin" && session.role !== "inventario") redirect("/dashboard");

  const q      = s(searchParams.q);
  const metodo = s(searchParams.metodo) as PaymentType | "";
  const desde  = s(searchParams.desde);
  const hasta  = s(searchParams.hasta);
  const page   = Math.max(1, parseInt(s(searchParams.page) || "1"));

  const STATUSES: OrderStatus[] = ["pendiente_pago", "pago_parcial"];
  const where = {
    status: { in: STATUSES },
    ...(metodo && { payments: { some: { payment_type: metodo } } }),
    ...(desde && !hasta && { created_at: { gte: new Date(desde) } }),
    ...(hasta && !desde && { created_at: { lte: new Date(`${hasta}T23:59:59`) } }),
    ...(desde && hasta && { created_at: { gte: new Date(desde), lte: new Date(`${hasta}T23:59:59`) } }),
    ...(q && {
      OR: [
        { customer_name:     { contains: q, mode: "insensitive" as const } },
        { customer_lastname: { contains: q, mode: "insensitive" as const } },
        { order_number:      { contains: q, mode: "insensitive" as const } },
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
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);

  const data: PagoOrdenJSON[] = orders.map((o) => ({
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Verificación de pagos</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {total} orden{total !== 1 ? "es" : ""} pendiente{total !== 1 ? "s" : ""} de verificación
        </p>
      </div>

      <PagosTable
        orders={data}
        total={total}
        page={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
      />
    </div>
  );
}
