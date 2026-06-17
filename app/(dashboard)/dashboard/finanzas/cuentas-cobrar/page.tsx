export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CuentasCobrarClient } from "@/components/shared/finanzas/CuentasCobrarClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function CuentasCobrarPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const cuentas = await prisma.accountReceivable.findMany({
    where: { status: { in: ["pendiente", "cobrado_parcial"] } },
    include: {
      order: { select: { id: true, order_number: true } },
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
    status: c.status as string,
    order: c.order,
    creator: c.creator,
    created_at: c.created_at.toISOString(),
  }));

  const totalPendiente = data.reduce((s, c) => s + c.amount_pending, 0);

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
        <h1 className="text-2xl font-bold text-gray-900">Cuentas por cobrar</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {data.length} cuenta{data.length !== 1 ? "s" : ""} pendiente
          {data.length !== 1 ? "s" : ""} — total por cobrar: ${totalPendiente.toFixed(2)}
        </p>
      </div>
      <CuentasCobrarClient data={data} />
    </div>
  );
}
