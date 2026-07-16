import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";
import {
  parseRangoFechas,
  cierreOrderInclude,
  cierreEligibleWhere,
  buildCierreRows,
  buildResumen,
} from "@/lib/cierre-tienda";
import type { TipoCierre, OrderChannel } from "@/app/generated/prisma/client";

const TIPOS_VALIDOS: TipoCierre[] = ["diario", "semanal", "quincenal", "mensual", "personalizado"];
const CANALES_VALIDOS: OrderChannel[] = ["tienda", "online"];

// GET /api/cierre-tienda?canal=... — historial de cierres, paginado, más reciente primero.
// `canal` es opcional: sin él devuelve el historial de ambos canales mezclado.
export async function GET(request: NextRequest) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const canal = sp.get("canal") as OrderChannel | null;
  if (canal && !CANALES_VALIDOS.includes(canal)) {
    return NextResponse.json({ error: "Canal inválido" }, { status: 400 });
  }
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const pageSize = 25;

  const [cierres, total] = await Promise.all([
    prisma.cierreTienda.findMany({
      where: canal ? { canal } : undefined,
      include: { generado_por: { select: { id: true, name: true } } },
      orderBy: { fecha_inicio: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.cierreTienda.count({ where: canal ? { canal } : undefined }),
  ]);

  const data = cierres.map((c) => ({
    ...c,
    fecha_inicio: c.fecha_inicio.toISOString(),
    fecha_fin: c.fecha_fin.toISOString(),
    created_at: c.created_at.toISOString(),
  }));

  return NextResponse.json({ data, total, page, totalPages: Math.ceil(total / pageSize) });
}

// POST /api/cierre-tienda — genera y guarda un cierre (irreversible: las órdenes incluidas
// quedan bloqueadas para cualquier cierre futuro)
export async function POST(request: NextRequest) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { tipo, canal, fechaInicio, fechaFin } = body;
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de cierre inválido" }, { status: 400 });
  }
  if (!CANALES_VALIDOS.includes(canal)) {
    return NextResponse.json({ error: "Canal inválido" }, { status: 400 });
  }
  const rango = parseRangoFechas(fechaInicio, fechaFin);
  if (!rango) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  const ip = getClientIp(request);

  try {
    const cierre = await prisma.$transaction(async (tx) => {
      // Server-side: nunca confiar en la lista de órdenes que pudiera mandar el cliente —
      // se repite exactamente la misma query que el preview.
      const orders = await tx.order.findMany({
        where: cierreEligibleWhere(rango.fechaInicio, rango.fechaFin, canal as OrderChannel),
        include: cierreOrderInclude,
        orderBy: { pago_verificado_at: "asc" },
      });

      if (orders.length === 0) throw new Error("NO_ELIGIBLE_ORDERS");

      const rows = buildCierreRows(orders);
      const { totalPiezas, resumenTotales } = buildResumen(rows);

      const created = await tx.cierreTienda.create({
        data: {
          tipo: tipo as TipoCierre,
          canal: canal as OrderChannel,
          fecha_inicio: rango.fechaInicio,
          fecha_fin: rango.fechaFin,
          generado_por_id: auth.session.id,
          total_piezas: totalPiezas,
          resumen_totales: resumenTotales,
          detalles: {
            create: rows.map((r) => ({
              order_id: r.orderId,
              numero_orden: r.numeroOrden,
              cliente_nombre: r.clienteNombre,
              fecha_confirmacion: r.fechaConfirmacion,
              cantidad_piezas: r.cantidadPiezas,
              monto: r.monto,
              moneda: r.moneda,
              metodo_pago: r.metodoPago,
              referencia_pago: r.referencia,
            })),
          },
        },
        include: { detalles: true, generado_por: { select: { id: true, name: true } } },
      });

      await tx.order.updateMany({
        where: { id: { in: rows.map((r) => r.orderId) } },
        data: { incluido_en_cierre_id: created.id },
      });

      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "cierre_tienda_generado",
          entity_type: "CierreTienda",
          entity_id: created.id,
          data_after: {
            tipo,
            canal,
            fecha_inicio: rango.fechaInicio.toISOString(),
            fecha_fin: rango.fechaFin.toISOString(),
            total_piezas: totalPiezas,
            ordenes_incluidas: rows.length,
          },
          ip_address: ip,
        },
      });

      return created;
    }, { isolationLevel: "Serializable" });

    return NextResponse.json(
      {
        ...cierre,
        fecha_inicio: cierre.fecha_inicio.toISOString(),
        fecha_fin: cierre.fecha_fin.toISOString(),
        created_at: cierre.created_at.toISOString(),
        detalles: cierre.detalles.map((d) => ({
          ...d,
          monto: Number(d.monto),
          fecha_confirmacion: d.fecha_confirmacion.toISOString(),
        })),
      },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NO_ELIGIBLE_ORDERS") {
      return NextResponse.json(
        { error: "No hay órdenes elegibles en el rango seleccionado" },
        { status: 400 }
      );
    }
    console.error("POST /api/cierre-tienda:", err);
    return NextResponse.json({ error: "Error interno al generar el cierre" }, { status: 500 });
  }
}
