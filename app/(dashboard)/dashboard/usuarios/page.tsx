export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { UsuariosTable } from "@/components/shared/usuarios/UsuariosTable";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserJSON } from "@/types";
import type { UserRole } from "@/app/generated/prisma/client";

type SP = { [key: string]: string | string[] | undefined };
function s(v: string | string[] | undefined) { return typeof v === "string" ? v : ""; }

const PAGE_SIZE = 25;

export default async function UsuariosPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const rol = s(searchParams.rol) as UserRole | "";
  const estado = s(searchParams.estado);
  const page = Math.max(1, parseInt(s(searchParams.page) || "1"));
  const success = s(searchParams.success) === "1";

  const where = {
    ...(rol && { role: rol }),
    ...(estado === "activo" && { is_active: true }),
    ...(estado === "inactivo" && { is_active: false }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        created_by: true,
        created_at: true,
        creator: { select: { id: true, name: true } },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  const data: UserJSON[] = users.map((u) => ({
    ...u,
    created_at: u.created_at.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {total} usuario{total !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/dashboard/usuarios/nuevo" className={cn(buttonVariants())}>
          <UserPlus size={16} className="mr-2" />
          Nuevo usuario
        </Link>
      </div>

      {success && (
        <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Usuario guardado correctamente.
        </div>
      )}

      <UsuariosTable
        users={data}
        total={total}
        page={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
      />
    </div>
  );
}
