export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { ChevronLeft } from "lucide-react";
import { UserForm } from "@/components/shared/usuarios/UserForm";

export default async function NuevoUsuarioPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link
          href="/dashboard/usuarios"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ChevronLeft size={15} />
          Volver a usuarios
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo usuario</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Crea una cuenta para un miembro del equipo.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <UserForm mode="create" />
      </div>
    </div>
  );
}
