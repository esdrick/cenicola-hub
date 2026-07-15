import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";
import {
  parseRangoFechas,
  cierreOrderInclude,
  cierreEligibleWhere,
  buildCierreRows,
  buildResumen,
} from "@/lib/cierre-tienda";
import type { OrderChannel } from "@/app/generated/prisma/client";

const CANALES_VALIDOS: OrderChannel[] = ["tienda", "online"];

// GET /api/cierre-tienda/preview?fechaInicio=...&fechaFin=...&canal=... — solo lectura, no guarda nada
export async function GET(request: NextRequest) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const canal = sp.get("canal") as OrderChannel | null;
  if (!canal || !CANALES_VALIDOS.includes(canal)) {
    return NextResponse.json({ error: "Canal inválido" }, { status: 400 });
  }

  const rango = parseRangoFechas(sp.get("fechaInicio"), sp.get("fechaFin"));
  if (!rango) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: cierreEligibleWhere(rango.fechaInicio, rango.fechaFin, canal),
    include: cierreOrderInclude,
    orderBy: { pago_verificado_at: "asc" },
  });

  const ordenes = buildCierreRows(orders);
  const { totalPiezas, resumenTotales } = buildResumen(ordenes);

  return NextResponse.json({
    fechaInicio: rango.fechaInicio.toISOString(),
    fechaFin: rango.fechaFin.toISOString(),
    ordenes: ordenes.map((o) => ({ ...o, fechaConfirmacion: o.fechaConfirmacion.toISOString() })),
    totalPiezas,
    resumenTotales,
  });
}
