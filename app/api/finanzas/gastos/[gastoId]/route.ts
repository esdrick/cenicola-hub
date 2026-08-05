import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { gastoId: string } }
) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const { gastoId } = params;

  const gasto = await prisma.expense.findUnique({ where: { id: gastoId } });
  if (!gasto) return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
  if (gasto.payroll_record_id) {
    return NextResponse.json(
      { error: "Este gasto está vinculado a un pago de nómina — deshazlo desde Nóminas" },
      { status: 400 }
    );
  }

  const ip = getClientIp(request);

  await prisma.$transaction(async (tx) => {
    await tx.expense.delete({ where: { id: gastoId } });
    await tx.auditLog.create({
      data: {
        user_id: auth.session.id,
        action: "DELETE",
        entity_type: "Expense",
        entity_id: gastoId,
        data_before: {
          description: gasto.description,
          amount_usd: Number(gasto.amount_usd),
          category: gasto.category,
          expense_date: gasto.expense_date.toISOString().slice(0, 10),
        },
        ip_address: ip,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
