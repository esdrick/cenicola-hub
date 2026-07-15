export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/shared/Pagination";
import { CierreHistorialTable } from "@/components/shared/cierre-tienda/CierreHistorialTable";
import type { CierreTiendaJSON } from "@/types";
import type { OrderChannel } from "@/app/generated/prisma/client";

type SP = { [key: string]: string | string[] | undefined };

const PAGE_SIZE = 25;
const CANALES_VALIDOS: OrderChannel[] = ["tienda", "online"];

export default async function CierreHistorialPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const page = Math.max(1, parseInt(typeof searchParams.page === "string" ? searchParams.page : "1"));
  const canalParam = typeof searchParams.canal === "string" ? searchParams.canal : "";
  const canal = CANALES_VALIDOS.includes(canalParam as OrderChannel) ? (canalParam as OrderChannel) : null;
  const where = canal ? { canal } : undefined;

  const [cierres, total] = await Promise.all([
    prisma.cierreTienda.findMany({
      where,
      include: { generado_por: { select: { id: true, name: true } } },
      orderBy: { fecha_inicio: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.cierreTienda.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const data: CierreTiendaJSON[] = cierres.map((c) => ({
    id: c.id,
    tipo: c.tipo,
    canal: c.canal,
    fecha_inicio: c.fecha_inicio.toISOString(),
    fecha_fin: c.fecha_fin.toISOString(),
    generado_por_id: c.generado_por_id,
    total_piezas: c.total_piezas,
    resumen_totales: c.resumen_totales as CierreTiendaJSON["resumen_totales"],
    created_at: c.created_at.toISOString(),
    generado_por: c.generado_por,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/cierre-tienda"
          className="mb-2 flex w-fit items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft size={15} />
          Cierre de Tienda
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Historial de cierres</h1>
        <p className="mt-0.5 text-sm text-gray-500">{total} cierre{total !== 1 ? "s" : ""} generado{total !== 1 ? "s" : ""}</p>
      </div>

      <div className="flex w-fit gap-1 rounded-lg border bg-gray-50 p-1">
        {([["", "Todos"], ["tienda", "Tienda"], ["online", "Online"]] as const).map(([value, label]) => (
          <Link
            key={value || "todos"}
            href={value ? `/dashboard/cierre-tienda/historial?canal=${value}` : "/dashboard/cierre-tienda/historial"}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              canal === (value || null) ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <Card className="p-0">
        <CardContent className="p-0">
          <CierreHistorialTable cierres={data} />
        </CardContent>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        noun="cierre"
        prevHref={page > 1 ? `/dashboard/cierre-tienda/historial?${canal ? `canal=${canal}&` : ""}page=${page - 1}` : null}
        nextHref={page < totalPages ? `/dashboard/cierre-tienda/historial?${canal ? `canal=${canal}&` : ""}page=${page + 1}` : null}
      />
    </div>
  );
}
