export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { GastosClient } from "@/components/shared/finanzas/GastosClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type SP = { [key: string]: string | string[] | undefined };
function s(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}

export default async function GastosPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const categoria = s(searchParams.categoria);
  const desde = s(searchParams.desde);
  const hasta = s(searchParams.hasta);

  const where = {
    ...(categoria && { category: categoria }),
    ...(desde && hasta
      ? { expense_date: { gte: new Date(desde), lte: new Date(hasta) } }
      : desde
      ? { expense_date: { gte: new Date(desde) } }
      : hasta
      ? { expense_date: { lte: new Date(hasta) } }
      : {}),
  };

  const gastos = await prisma.expense.findMany({
    where,
    include: { creator: { select: { id: true, name: true } } },
    orderBy: { expense_date: "desc" },
  });

  const data = gastos.map((g) => ({
    id: g.id,
    category: g.category,
    description: g.description,
    amount_usd: Number(g.amount_usd),
    expense_date: g.expense_date.toISOString().slice(0, 10),
    notas: g.notas,
    creator: g.creator,
    created_at: g.created_at.toISOString(),
  }));

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
        <h1 className="text-2xl font-bold text-gray-900">Gastos</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Registro y control de gastos operativos
        </p>
      </div>
      <GastosClient
        data={data}
        filterCategoria={categoria}
        filterDesde={desde}
        filterHasta={hasta}
      />
    </div>
  );
}
