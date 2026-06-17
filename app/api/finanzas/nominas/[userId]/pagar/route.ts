import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { mes, anio, comision, total_ventas } = body;

  if (!mes || !anio)
    return NextResponse.json({ error: "Mes y año son requeridos" }, { status: 400 });

  const vendedora = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, name: true, role: true },
  });

  if (!vendedora || !["vendedora_online", "vendedora_tienda"].includes(vendedora.role)) {
    return NextResponse.json({ error: "Vendedora no encontrada" }, { status: 404 });
  }

  const ip = getClientIp(request);
  const now = new Date();

  const MESES = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
  ];

  const record = await prisma.$transaction(async (tx) => {
    const comisionAmount = parseFloat(Number(comision ?? 0).toFixed(2));

    const upserted = await tx.payrollRecord.upsert({
      where: { userId_mes_anio: { userId: params.userId, mes, anio } },
      create: {
        userId: params.userId,
        mes,
        anio,
        total_ventas: parseFloat(Number(total_ventas ?? 0).toFixed(2)),
        comision: comisionAmount,
        status: "pagada",
        paid_at: now,
      },
      update: {
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
          description: `Nómina ${MESES[mes - 1]} ${anio} — ${vendedora.name}`,
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
          mes,
          anio,
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
