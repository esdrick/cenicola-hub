import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";
import {
  formatRangoLabel,
  rangoADateTime,
  nominaEligibleWhere,
  PERIODO_TIPOS,
  type PeriodoTipo,
} from "@/lib/payroll-periods";

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { desde, hasta, tipo, comision } = body;

  if (!desde || !hasta)
    return NextResponse.json({ error: "El rango de fechas es requerido" }, { status: 400 });

  const periodoInicio = new Date(desde);
  const periodoFin = new Date(hasta);
  if (isNaN(periodoInicio.getTime()) || isNaN(periodoFin.getTime()) || periodoInicio > periodoFin) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }
  const periodoTipo: PeriodoTipo = PERIODO_TIPOS.includes(tipo) ? tipo : "personalizado";
  const { inicio, fin } = rangoADateTime(desde, hasta);

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

    const existing = await tx.payrollRecord.findUnique({
      where: {
        userId_periodo_inicio_periodo_fin: {
          userId: params.userId,
          periodo_inicio: periodoInicio,
          periodo_fin: periodoFin,
        },
      },
    });

    // Si este período ya fue pagado antes, las órdenes correspondientes ya quedaron
    // selladas con incluido_en_nomina_id en esa primera llamada — no se vuelven a buscar
    // ni a recortar. Solo se permite ajustar la comisión ya registrada.
    let total_ventas: number;
    let orderIdsToTag: string[] = [];

    if (existing?.status === "pagada") {
      total_ventas = Number(existing.total_ventas);
    } else {
      const ordenesElegibles = await tx.order.findMany({
        where: nominaEligibleWhere(inicio, fin, params.userId),
        select: { id: true, total_usd: true },
      });
      total_ventas = parseFloat(
        ordenesElegibles.reduce((sum, o) => sum + Number(o.total_usd), 0).toFixed(2)
      );
      orderIdsToTag = ordenesElegibles.map((o) => o.id);
    }

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
        total_ventas,
        comision: comisionAmount,
        status: "pagada",
        paid_at: now,
      },
      update: {
        periodo_tipo: periodoTipo,
        total_ventas,
        comision: comisionAmount,
        status: "pagada",
        paid_at: now,
      },
    });

    // Corte real: las órdenes que entraron en este pago quedan selladas y no volverán
    // a contar para ninguna nómina futura, sin importar qué rango de fechas se use después.
    if (orderIdsToTag.length > 0) {
      await tx.order.updateMany({
        where: { id: { in: orderIdsToTag } },
        data: { incluido_en_nomina_id: upserted.id },
      });
    }

    // Registrar automáticamente como gasto si la comisión es > 0
    if (comisionAmount > 0) {
      await tx.expense.create({
        data: {
          description: `Nómina ${rangoLabel} — ${vendedora.name}`,
          amount_usd: comisionAmount,
          category: "nomina",
          expense_date: now,
          notas: `Período: ${rangoLabel} — Comisión sobre ventas de $${Number(total_ventas ?? 0).toFixed(2)}`,
          payroll_record_id: upserted.id,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");
  if (!desde || !hasta)
    return NextResponse.json({ error: "El rango de fechas es requerido" }, { status: 400 });

  const periodoInicio = new Date(desde);
  const periodoFin = new Date(hasta);
  if (isNaN(periodoInicio.getTime()) || isNaN(periodoFin.getTime())) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  const ip = getClientIp(request);

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.payrollRecord.findUnique({
      where: {
        userId_periodo_inicio_periodo_fin: {
          userId: params.userId,
          periodo_inicio: periodoInicio,
          periodo_fin: periodoFin,
        },
      },
    });

    if (!record) return { error: "No existe un pago para ese período", status: 404 } as const;
    if (record.status !== "pagada")
      return { error: "Este período no está pagado", status: 400 } as const;

    // Revertir completo: las órdenes vuelven a ser elegibles, el gasto vinculado
    // desaparece, y el registro de pago se borra (no existe un estado "pendiente"
    // persistido — un PayrollRecord solo se crea al pagar).
    await tx.order.updateMany({
      where: { incluido_en_nomina_id: record.id },
      data: { incluido_en_nomina_id: null },
    });
    await tx.expense.deleteMany({ where: { payroll_record_id: record.id } });
    await tx.payrollRecord.delete({ where: { id: record.id } });

    await tx.auditLog.create({
      data: {
        user_id: auth.session.id,
        action: "PAYROLL_UNPAID",
        entity_type: "PayrollRecord",
        entity_id: record.id,
        data_before: {
          userId: params.userId,
          desde,
          hasta,
          total_ventas: Number(record.total_ventas),
          comision: Number(record.comision),
          status: record.status,
        },
        ip_address: ip,
      },
    });

    return { ok: true } as const;
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
