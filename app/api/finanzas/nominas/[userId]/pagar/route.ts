import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";
import { formatRangoLabel, PERIODO_TIPOS, type PeriodoTipo } from "@/lib/payroll-periods";

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { desde, hasta, tipo, comision, total_ventas } = body;

  if (!desde || !hasta)
    return NextResponse.json({ error: "El rango de fechas es requerido" }, { status: 400 });

  const periodoInicio = new Date(desde);
  const periodoFin = new Date(hasta);
  if (isNaN(periodoInicio.getTime()) || isNaN(periodoFin.getTime()) || periodoInicio > periodoFin) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }
  const periodoTipo: PeriodoTipo = PERIODO_TIPOS.includes(tipo) ? tipo : "personalizado";

  const vendedora = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, name: true, role: true },
  });

  if (!vendedora || !["vendedora_online", "vendedora_tienda"].includes(vendedora.role)) {
    return NextResponse.json({ error: "Vendedora no encontrada" }, { status: 404 });
  }

  const ip = getClientIp(request);
  const now = new Date();
  const mes = periodoInicio.getUTCMonth() + 1;
  const anio = periodoInicio.getUTCFullYear();
  const rangoLabel = formatRangoLabel(desde, hasta);

  const record = await prisma.$transaction(async (tx) => {
    const comisionAmount = parseFloat(Number(comision ?? 0).toFixed(2));

    const upserted = await tx.payrollRecord.upsert({
      where: {
        userId_periodo_inicio_periodo_fin: {
          userId: params.userId,
          periodo_inicio: periodoInicio,
          periodo_fin: periodoFin,
        },
      },
      create: {
        userId: params.userId,
        periodo_tipo: periodoTipo,
        periodo_inicio: periodoInicio,
        periodo_fin: periodoFin,
        mes,
        anio,
        total_ventas: parseFloat(Number(total_ventas ?? 0).toFixed(2)),
        comision: comisionAmount,
        status: "pagada",
        paid_at: now,
      },
      update: {
        periodo_tipo: periodoTipo,
        total_ventas: parseFloat(Number(total_ventas ?? 0).toFixed(2)),
        comision: comisionAmount,
        status: "pagada",
        paid_at: now,
      },
    });

    // Registrar automáticamente como gasto si la comisión es > 0
    if (comisionAmount > 0) {
      await tx.expense.create({
        data: {
          description: `Nómina ${rangoLabel} — ${vendedora.name}`,
          amount_usd: comisionAmount,
          category: "nomina",
          expense_date: now,
          notas: `Comisión sobre ventas de $${Number(total_ventas ?? 0).toFixed(2)}`,
          created_by: auth.session.id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        user_id: auth.session.id,
        action: "PAYROLL_PAID",
        entity_type: "PayrollRecord",
        entity_id: upserted.id,
        data_after: {
          vendedora: vendedora.name,
          periodo_tipo: periodoTipo,
          desde,
          hasta,
          total_ventas: Number(upserted.total_ventas),
          comision: comisionAmount,
          status: "pagada",
          gasto_creado: comisionAmount > 0,
        },
        ip_address: ip,
      },
    });

    return upserted;
  });

  return NextResponse.json({
    id: record.id,
    status: record.status,
    paid_at: record.paid_at?.toISOString() ?? null,
  });
}
