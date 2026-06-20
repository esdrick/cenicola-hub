import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");

  const orderDateFilter =
    desde && hasta
      ? { gte: new Date(desde), lte: new Date(`${hasta}T23:59:59`) }
      : desde
      ? { gte: new Date(desde) }
      : hasta
      ? { lte: new Date(`${hasta}T23:59:59`) }
      : undefined;

  const expenseDateFilter =
    desde && hasta
      ? { gte: new Date(desde), lte: new Date(hasta) }
      : desde
      ? { gte: new Date(desde) }
      : hasta
      ? { lte: new Date(hasta) }
      : undefined;

  const [ventas, gastos, cobrar, pagar, pagosPendientes, ingresosPorMetodo] =
    await Promise.all([
      prisma.order.aggregate({
        where: {
          status: "completada",
          ...(orderDateFilter && { created_at: orderDateFilter }),
        },
        _sum: { total_usd: true },
        _count: { id: true },
      }),
      prisma.expense.aggregate({
        where: {
          ...(expenseDateFilter && { expense_date: expenseDateFilter }),
        },
        _sum: { amount_usd: true },
      }),
      prisma.accountReceivable.findMany({
        where: { status: { in: ["pendiente", "cobrado_parcial"] } },
        select: { amount_usd: true, amount_paid_usd: true },
      }),
      prisma.accountPayable.findMany({
        where: { status: "pendiente" },
        select: { monto: true },
      }),
      prisma.order.count({
        where: { status: { in: ["pendiente_pago", "pago_parcial"] } },
      }),
      prisma.orderPayment.groupBy({
        by: ["payment_type"],
        where: {
          status: "verificado",
          ...(orderDateFilter && { verified_at: orderDateFilter }),
        },
        _sum: { amount_usd: true },
        _count: { id: true },
      }),
    ]);

  const totalCobrar = cobrar.reduce(
    (s, r) => s + Number(r.amount_usd) - Number(r.amount_paid_usd),
    0
  );
  const totalPagar = pagar.reduce((s, p) => s + Number(p.monto), 0);

  return NextResponse.json({
    ventas: Number(ventas._sum.total_usd ?? 0),
    ordenes_completadas: ventas._count.id,
    gastos: Number(gastos._sum.amount_usd ?? 0),
    cobrar: totalCobrar,
    pagar: totalPagar,
    pagos_pendientes: pagosPendientes,
    ingresos_por_metodo: ingresosPorMetodo.map((m) => ({
      metodo: m.payment_type,
      total: Number(m._sum.amount_usd ?? 0),
      count: m._count.id,
    })),
  });
}
