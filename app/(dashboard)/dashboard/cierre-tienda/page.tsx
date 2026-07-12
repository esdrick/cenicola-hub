export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { History } from "lucide-react";
import { getSession } from "@/lib/session";
import { CierreTiendaClient } from "@/components/shared/cierre-tienda/CierreTiendaClient";

export default async function CierreTiendaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cierre de Tienda</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Genera un cierre de las órdenes con pago confirmado en un período
          </p>
        </div>
        <Link
          href="/dashboard/cierre-tienda/historial"
          className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <History size={15} />
          Historial
        </Link>
      </div>

      <CierreTiendaClient />
    </div>
  );
}
