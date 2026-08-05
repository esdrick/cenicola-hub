import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";
import { parseFechaCorte, getCorteActivo } from "@/lib/cierre-sistema";

// GET /api/cierre-sistema — corte activo actual (o null si nunca se ha confirmado uno)
export async function GET() {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const corte = await getCorteActivo();
  return NextResponse.json({ fecha_corte: corte?.toISOString() ?? null });
}

// POST /api/cierre-sistema — confirma un nuevo corte de sistema (irreversible: pasa a
// ser el piso de fecha por defecto en Ventas/Pagos/Envíos para lo ya resuelto)
export async function POST(request: NextRequest) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const fecha = parseFechaCorte(body.fecha);
  if (!fecha) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const ip = getClientIp(request);

  const created = await prisma.$transaction(async (tx) => {
    const corte = await tx.cierreSistema.create({
      data: { fecha_corte: fecha, confirmado_por_id: auth.session.id },
    });

    await tx.auditLog.create({
      data: {
        user_id: auth.session.id,
        action: "corte_sistema_generado",
        entity_type: "CierreSistema",
        entity_id: corte.id,
        data_after: { fecha_corte: fecha.toISOString() },
        ip_address: ip,
      },
    });

    return corte;
  });

  return NextResponse.json(
    { ...created, fecha_corte: created.fecha_corte.toISOString() },
    { status: 201 },
  );
}
