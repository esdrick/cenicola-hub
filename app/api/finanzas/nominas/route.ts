import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";
import { nominaEligibleWhere } from "@/lib/payroll-periods";

export async function GET(request: NextRequest) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const now = new Date();
  const mes = parseInt(sp.get("mes") ?? String(now.getMonth() + 1));
  const anio = parseInt(sp.get("anio") ?? String(now.getFullYear()));

  if (isNaN(mes) || mes < 1 || mes > 12)
    return NextResponse.json({ error: "Mes inválido" }, { status: 400 });
  if (isNaN(anio) || anio < 2020 || anio > 2100)
    return NextResponse.json({ error: "Año inválido" }, { status: 400 });

  const inicio = new Date(anio, mes - 1, 1);
  const fin = new Date(anio, mes, 0, 23, 59, 59);

  const sellers = await prisma.user.findMany({
    where: {
      role: { in: ["vendedora_online", "vendedora_tienda"] },
      is_active: true,
    },
    select: {
      id: true,
      name: true,
      role: true,
      payroll_records: {
        where: { mes, anio },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = await Promise.all(
    sellers.map(async (u) => {
      const record = u.payroll_records[0] ?? null;
      const isPaid = record?.status === "pagada";

      const orders = await prisma.order.findMany({
        where: isPaid ? { incluido_en_nomina_id: record!.id } : nominaEligibleWhere(inicio, fin, u.id),
        select: { total_usd: true },
      });

      const total_ventas = isPaid
        ? Number(record!.total_ventas)
        : orders.reduce((s, o) => s + Number(o.total_usd), 0);

      return {
        userId: u.id,
        nombre: u.name,
        rol: u.role,
        ordenes_count: orders.length,
        total_ventas,
        comision: record ? Number(record.comision) : 0,
        status: record?.status ?? "pendiente",
        paid_at: record?.paid_at ? record.paid_at.toISOString() : null,
      };
    })
  );

  return NextResponse.json({ data, mes, anio });
}
