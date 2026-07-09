import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";

// POST /api/embalaje/[orderId]/confirmar — confirm shipment
export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const auth = await withRole(["admin", "embalador", "inventario", "vendedora_online"]);
  if (!auth.ok) return auth.response;

  const { orderId } = params;

  let body: { foto1Url?: string; foto2Url?: string; foto3Url?: string; tracking?: string; notas?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { foto1Url, foto2Url, foto3Url, tracking, notas } = body;

  if (!foto1Url?.trim()) {
    return NextResponse.json({ error: "La URL de la foto del paquete es requerida" }, { status: 400 });
  }

  const ip = getClientIp(request);

  try {
    await prisma.$transaction(async (tx) => {
      // Validate order exists and has correct status
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("NOT_FOUND");
      if (auth.session.role === "vendedora_online" && order.created_by !== auth.session.id) {
        throw new Error("FORBIDDEN");
      }
      if (order.status !== "en_embalaje") throw new Error("INVALID_STATUS");

      // 1. Create shipment
      await tx.orderShipment.create({
        data: {
          order_id: orderId,
          packed_by: auth.session.id,
          packed_at: new Date(),
          photo_package: foto1Url.trim(),
          photo_receipt: foto2Url?.trim() || null,
          photo_guide: foto3Url?.trim() || null,
          tracking_number: tracking?.trim() || null,
          notes: notas?.trim() || null,
        },
      });

      // 2. Update order status to enviada
      await tx.order.update({
        where: { id: orderId },
        data: { status: "enviada" },
      });

      // 3. Audit log
      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "enviada",
          entity_type: "Order",
          entity_id: orderId,
          data_before: { status: "en_embalaje" },
          data_after: { status: "enviada", tracking: tracking?.trim() || null },
          ip_address: ip,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }
    if (msg === "INVALID_STATUS") {
      return NextResponse.json({ error: "La orden no está en estado en_embalaje" }, { status: 409 });
    }
    console.error("POST /api/embalaje/[orderId]/confirmar:", err);
    return NextResponse.json({ error: "Error interno al confirmar el envío" }, { status: 500 });
  }
}
