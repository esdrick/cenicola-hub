export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ChevronLeft } from "lucide-react";
import { UserForm } from "@/components/shared/usuarios/UserForm";
import type { UserJSON } from "@/types";

type Props = { params: { userId: string } };

export default async function EditarUsuarioPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const raw = await prisma.user.findUnique({
    where: { id: params.userId },
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
  });

  if (!raw) notFound();

  const user: UserJSON = { ...raw, created_at: raw.created_at.toISOString() };

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
        <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
        <p className="mt-0.5 text-sm text-gray-500">{user.email}</p>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <UserForm mode="edit" user={user} sessionId={session.id} />
      </div>
    </div>
  );
}
