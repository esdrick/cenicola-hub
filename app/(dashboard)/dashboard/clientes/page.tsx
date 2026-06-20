export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ClientesTable } from "@/components/shared/clientes/ClientesTable";
import type { CustomerJSON } from "@/types";

export default async function ClientesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const pageSize = 25;
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      include: { _count: { select: { orders: true } } },
      orderBy: { created_at: "desc" },
      take: pageSize,
    }),
    prisma.customer.count(),
  ]);

  const initialData: CustomerJSON[] = customers.map((c) => ({
    ...c,
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <p className="mt-0.5 text-sm text-gray-500">Directorio de clientes registrados en el sistema</p>
      </div>
      <ClientesTable initialData={initialData} initialTotal={total} />
    </div>
  );
}
