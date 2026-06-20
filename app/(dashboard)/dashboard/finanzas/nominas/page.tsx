export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NominasClient } from "@/components/shared/finanzas/NominasClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type SP = { [key: string]: string | string[] | undefined };
function s(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}

export default async function NominasPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const now = new Date();
  const mes = Math.min(12, Math.max(1, parseInt(s(searchParams.mes) || String(now.getMonth() + 1))));
  const anio = parseInt(s(searchParams.anio) || String(now.getFullYear()));
  const safeAnio = isNaN(anio) ? now.getFullYear() : anio;

  const inicio = new Date(safeAnio, mes - 1, 1);
  const fin = new Date(safeAnio, mes, 0, 23, 59, 59);

  const sellers = await prisma.user.findMany({
    where: {
      role: { in: ["vendedora_online", "vendedora_tienda"] },
      is_active: true,
    },
    select: {
      id: true,
      name: true,
      role: true,
      orders_created: {
        where: {
          status: "completada",
          created_at: { gte: inicio, lte: fin },
        },
        select: {
          id: true,
          order_number: true,
          channel: true,
          customer_name: true,
          customer_lastname: true,
          total_usd: true,
          items: { select: { quantity: true } },
        },
        orderBy: { created_at: "desc" },
      },
      payroll_records: {
        where: { mes, anio: safeAnio },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = sellers.map((u) => {
    const record = u.payroll_records[0] ?? null;
    const total_ventas = u.orders_created.reduce((sum, o) => sum + Number(o.total_usd), 0);
    const productos_vendidos = u.orders_created.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
      0
    );

    return {
      userId: u.id,
      nombre: u.name,
      rol: u.role as string,
      ordenes_count: u.orders_created.length,
      productos_vendidos,
      total_ventas,
      comision: record ? Number(record.comision) : 0,
      status: record?.status ?? "pendiente",
      paid_at: record?.paid_at ? record.paid_at.toISOString() : null,
      ordenes: u.orders_created.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        channel: o.channel as string,
        customer_name: o.customer_name,
        customer_lastname: o.customer_lastname,
        total_usd: Number(o.total_usd),
        productos: o.items.reduce((s, i) => s + i.quantity, 0),
      })),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/finanzas"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 w-fit"
        >
          <ArrowLeft size={15} />
          Volver a Finanzas
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nóminas</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Comisiones y pagos por vendedora
        </p>
      </div>
      <NominasClient data={data} mes={mes} anio={safeAnio} />
    </div>
  );
}
