export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ResumenClient } from "@/components/shared/finanzas/ResumenClient";

export default async function FinanzasPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finanzas</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Resumen financiero del negocio
        </p>
      </div>
      <ResumenClient />
    </div>
  );
}
