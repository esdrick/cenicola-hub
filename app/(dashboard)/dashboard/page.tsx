export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/auth";
import { AdminDashboard } from "@/components/shared/dashboard/AdminDashboard";
import { InventarioDashboard } from "@/components/shared/dashboard/InventarioDashboard";
import { VendedoraDashboard } from "@/components/shared/dashboard/VendedoraDashboard";
import { EmbaladorDashboard } from "@/components/shared/dashboard/EmbaladorDashboard";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}, {session.name.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              {ROLE_LABELS[session.role]}
            </span>
          </p>
        </div>
      </div>

      {/* Dashboard por rol */}
      {session.role === "admin" && <AdminDashboard />}
      {session.role === "inventario" && <InventarioDashboard />}
      {(session.role === "vendedora_online" || session.role === "vendedora_tienda") && (
        <VendedoraDashboard session={session} />
      )}
      {session.role === "embalador" && <EmbaladorDashboard />}
    </div>
  );
}
