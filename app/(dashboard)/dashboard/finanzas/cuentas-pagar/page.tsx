export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CuentasPagarClient } from "@/components/shared/finanzas/CuentasPagarClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function CuentasPagarPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const cuentas = await prisma.accountPayable.findMany({
    include: { creator: { select: { id: true, name: true } } },
    orderBy: [{ status: "asc" }, { created_at: "desc" }],
  });

  const data = cuentas.map((c) => ({
    id: c.id,
    proveedor: c.proveedor,
    descripcion: c.descripcion,
    monto: Number(c.monto),
    fecha_vencimiento: c.fecha_vencimiento
      ? c.fecha_vencimiento.toISOString().slice(0, 10)
      : null,
    status: c.status,
    paid_at: c.paid_at ? c.paid_at.toISOString() : null,
    creator: c.creator,
    created_at: c.created_at.toISOString(),
  }));

  const totalPendiente = data
    .filter((c) => c.status === "pendiente")
    .reduce((s, c) => s + c.monto, 0);

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
        <h1 className="text-2xl font-bold text-gray-900">Cuentas por pagar</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {data.filter((c) => c.status === "pendiente").length} pendiente
          {data.filter((c) => c.status === "pendiente").length !== 1 ? "s" : ""} — total: $
          {totalPendiente.toFixed(2)}
        </p>
      </div>
      <CuentasPagarClient data={data} />
    </div>
  );
}
