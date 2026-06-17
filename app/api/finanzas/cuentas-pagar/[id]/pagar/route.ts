import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const cuenta = await prisma.accountPayable.findUnique({ where: { id: params.id } });
  if (!cuenta) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  if (cuenta.status === "pagada")
    return NextResponse.json({ error: "Esta cuenta ya está pagada" }, { status: 409 });

  const ip = getClientIp(request);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.accountPayable.update({
      where: { id: params.id },
      data: { status: "pagada", paid_at: now },
    });

    // Registrar automáticamente como gasto
    await tx.expense.create({
      data: {
        description: `${cuenta.proveedor} — ${cuenta.descripcion}`,
        amount_usd: Number(cuenta.monto),
        category: "operativo",
        expense_date: now,
        notas: `Pago de cuenta por pagar registrada el ${cuenta.created_at.toISOString().slice(0, 10)}`,
        created_by: auth.session.id,
      },
    });

    await tx.auditLog.create({
      data: {
        user_id: auth.session.id,
        action: "PAID",
        entity_type: "AccountPayable",
        entity_id: params.id,
        data_before: { status: cuenta.status },
        data_after: {
          proveedor: cuenta.proveedor,
          monto: Number(cuenta.monto),
          status: "pagada",
          paid_at: now.toISOString(),
          gasto_creado: true,
        },
        ip_address: ip,
      },
    });
  });

  return NextResponse.json({ ok: true, paid_at: now.toISOString() });
}
