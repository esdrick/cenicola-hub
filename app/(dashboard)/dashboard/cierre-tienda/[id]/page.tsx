export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { CierreDetalleView } from "@/components/shared/cierre-tienda/CierreDetalleView";
import { TIPO_CIERRE_LABELS, CANAL_LABELS, CANAL_CLASSES, formatFechaCorta, formatFechaHora } from "@/components/shared/cierre-tienda/cierre-format";
import type { CierreTiendaDetailJSON } from "@/types";

export default async function CierreDetallePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const cierre = await prisma.cierreTienda.findUnique({
    where: { id: params.id },
    include: {
      generado_por: { select: { id: true, name: true } },
      detalles: { orderBy: { fecha_confirmacion: "asc" } },
    },
  });

  if (!cierre) notFound();

  const data: CierreTiendaDetailJSON = {
    id: cierre.id,
    tipo: cierre.tipo,
    canal: cierre.canal,
    fecha_inicio: cierre.fecha_inicio.toISOString(),
    fecha_fin: cierre.fecha_fin.toISOString(),
    generado_por_id: cierre.generado_por_id,
    total_piezas: cierre.total_piezas,
    resumen_totales: cierre.resumen_totales as CierreTiendaDetailJSON["resumen_totales"],
    created_at: cierre.created_at.toISOString(),
    generado_por: cierre.generado_por,
    detalles: cierre.detalles.map((d) => ({
      id: d.id,
      cierre_id: d.cierre_id,
      order_id: d.order_id,
      numero_orden: d.numero_orden,
      cliente_nombre: d.cliente_nombre,
      fecha_confirmacion: d.fecha_confirmacion.toISOString(),
      cantidad_piezas: d.cantidad_piezas,
      monto: Number(d.monto),
      moneda: d.moneda,
      metodo_pago: d.metodo_pago,
      referencia_pago: d.referencia_pago,
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/cierre-tienda/historial"
          className="mb-2 flex w-fit items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft size={15} />
          Historial de cierres
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">
            {formatFechaCorta(data.fecha_inicio)} – {formatFechaCorta(data.fecha_fin)}
          </h1>
          <Badge className={`border-0 text-xs ${CANAL_CLASSES[data.canal] ?? "bg-gray-100 text-gray-700"}`}>
            {CANAL_LABELS[data.canal] ?? data.canal}
          </Badge>
          <Badge className="border-0 bg-gray-100 text-xs text-gray-700">
            {TIPO_CIERRE_LABELS[data.tipo] ?? data.tipo}
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-gray-500">
          Generado por {data.generado_por.name} el {formatFechaHora(data.created_at)}
        </p>
      </div>

      <CierreDetalleView cierre={data} />
    </div>
  );
}
