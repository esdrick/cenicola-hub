import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const records = await prisma.payrollRecord.findMany({
    where: { userId: params.userId, status: "pagada" },
    orderBy: { periodo_inicio: "desc" },
  });

  const data = records.map((r) => ({
    id: r.id,
    periodo_inicio: r.periodo_inicio.toISOString().slice(0, 10),
    periodo_fin: r.periodo_fin.toISOString().slice(0, 10),
    total_ventas: Number(r.total_ventas),
    comision: Number(r.comision),
    paid_at: r.paid_at ? r.paid_at.toISOString() : null,
  }));

  return NextResponse.json({ data });
}
