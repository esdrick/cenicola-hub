import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";

// GET /api/cierre-tienda/[id] — snapshot congelado de un cierre ya generado (solo lectura)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const cierre = await prisma.cierreTienda.findUnique({
    where: { id: params.id },
    include: {
      generado_por: { select: { id: true, name: true } },
      detalles: { orderBy: { fecha_confirmacion: "asc" } },
    },
  });

  if (!cierre) return NextResponse.json({ error: "Cierre no encontrado" }, { status: 404 });

  return NextResponse.json({
    ...cierre,
    fecha_inicio: cierre.fecha_inicio.toISOString(),
    fecha_fin: cierre.fecha_fin.toISOString(),
    created_at: cierre.created_at.toISOString(),
    detalles: cierre.detalles.map((d) => ({
      ...d,
      monto: Number(d.monto),
      fecha_confirmacion: d.fecha_confirmacion.toISOString(),
    })),
  });
}
