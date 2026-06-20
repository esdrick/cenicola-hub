import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";

export async function GET() {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const cuentas = await prisma.accountReceivable.findMany({
    where: { status: { in: ["pendiente", "cobrado_parcial"] } },
    include: {
      order: {
        select: {
          id: true,
          order_number: true,
          customer_name: true,
          customer_lastname: true,
          creator: { select: { id: true, name: true } },
        },
      },
      creator: { select: { id: true, name: true } },
    },
    orderBy: { created_at: "asc" },
  });

  const data = cuentas.map((c) => ({
    id: c.id,
    description: c.description,
    debtor_name: c.debtor_name,
    amount_usd: Number(c.amount_usd),
    amount_paid_usd: Number(c.amount_paid_usd),
    amount_pending: Number(c.amount_usd) - Number(c.amount_paid_usd),
    due_date: c.due_date.toISOString().slice(0, 10),
    status: c.status,
    order: c.order
      ? {
          id: c.order.id,
          order_number: c.order.order_number,
          customer_name: c.order.customer_name,
          customer_lastname: c.order.customer_lastname,
          manager: c.order.creator,
        }
      : null,
    creator: c.creator,
    created_at: c.created_at.toISOString(),
  }));

  return NextResponse.json({ data });
}
