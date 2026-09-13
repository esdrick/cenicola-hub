import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { sendOrderShippedEmail } from "@/lib/emails";

const VALID_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;
const MAX_SIZE = 5 * 1024 * 1024;

// POST /api/orders/[id]/guia — Add/update shipping guide (tracking number & photo) and send email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withRole(["admin", "inventario"]);
  if (!auth.ok) return auth.response;

  const { id: orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      shipment: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }

  if (order.channel !== "online") {
    return NextResponse.json({ error: "La guía de envío solo aplica para ventas online y web" }, { status: 400 });
  }

  let formData: FormData | null = null;
  let jsonBody: Record<string, unknown> | null = null;

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "No se pudo procesar el formulario con archivos" }, { status: 400 });
    }
  } else {
    try {
      jsonBody = await request.json();
    } catch {
      jsonBody = null;
    }
  }

  const tracking_number = (formData
    ? (formData.get("tracking_number") as string | null)
    : (jsonBody?.tracking_number as string | null))?.trim() ?? "";

  const customer_email_input = (formData
    ? (formData.get("customer_email") as string | null)
    : (jsonBody?.customer_email as string | null))?.trim() ?? "";

  const send_email = formData
    ? formData.get("send_email") === "true"
    : Boolean(jsonBody?.send_email);

  const fotoGuiaFile = formData ? (formData.get("foto_guia") as File | null) : null;
  const fotoGuiaUrlBody = jsonBody?.photo_guide as string | null;

  let photo_guide_url: string | null = fotoGuiaUrlBody?.trim() || null;

  if (fotoGuiaFile && fotoGuiaFile.size > 0) {
    if (!VALID_TYPES.includes(fotoGuiaFile.type as (typeof VALID_TYPES)[number])) {
      return NextResponse.json(
        { error: "Tipo de archivo inválido para la foto de la guía. Solo JPG, PNG, WEBP." },
        { status: 400 }
      );
    }
    if (fotoGuiaFile.size > MAX_SIZE) {
      return NextResponse.json({ error: "La foto de la guía no puede superar 5MB" }, { status: 400 });
    }

    const folder = `cenicola/envios/${orderId}`;
    try {
      photo_guide_url = await uploadToCloudinary(fotoGuiaFile, folder);
    } catch (err) {
      console.error("Error al subir foto de la guía a Cloudinary:", err);
      return NextResponse.json({ error: "Error al subir la imagen de la guía" }, { status: 500 });
    }
  }

  if (!tracking_number && !photo_guide_url && !order.shipment?.photo_guide) {
    return NextResponse.json(
      { error: "Debes ingresar un número de guía o subir una foto de la guía" },
      { status: 400 }
    );
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const targetEmail: string | null = customer_email_input
    ? customer_email_input.toLowerCase()
    : order.customer?.email || null;

  if (customer_email_input && !EMAIL_RE.test(customer_email_input)) {
    return NextResponse.json({ error: "El correo electrónico ingresado no es válido" }, { status: 400 });
  }

  if (send_email && !targetEmail) {
    return NextResponse.json(
      { error: "Debes ingresar o registrar un correo electrónico para el cliente para enviar la guía" },
      { status: 400 }
    );
  }

  const ip = getClientIp(request);
  const now = new Date();

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Upsert OrderShipment
      const finalTracking = tracking_number || order.shipment?.tracking_number || null;
      const finalGuidePhoto = photo_guide_url || order.shipment?.photo_guide || null;

      let shipment;
      if (order.shipment) {
        shipment = await tx.orderShipment.update({
          where: { order_id: orderId },
          data: {
            tracking_number: finalTracking,
            photo_guide: finalGuidePhoto,
            edited_at: now,
            edited_by: auth.session.id,
          },
        });
      } else {
        shipment = await tx.orderShipment.create({
          data: {
            order_id: orderId,
            packed_by: auth.session.id,
            packed_at: now,
            shipped_at: now,
            photo_package: finalGuidePhoto || "",
            photo_guide: finalGuidePhoto,
            tracking_number: finalTracking,
          },
        });
      }

      // 3. Ensure order status is at least enviada
      if (order.status === "en_embalaje") {
        await tx.order.update({
          where: { id: orderId },
          data: { status: "enviada" },
        });
      }

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "guia_actualizada",
          entity_type: "OrderShipment",
          entity_id: shipment.id,
          data_after: {
            tracking_number: finalTracking,
            photo_guide: finalGuidePhoto,
            send_email,
            target_email: targetEmail,
          },
          ip_address: ip,
        },
      });

      return shipment;
    });

    let emailSent = false;
    if (send_email && targetEmail) {
      emailSent = await sendOrderShippedEmail({
        customerEmail: targetEmail,
        customerName: `${order.customer_name} ${order.customer_lastname}`.trim(),
        orderNumber: order.order_number,
        shippingCompany: order.shipping_company,
        trackingNumber: updated.tracking_number,
        packagePhotoUrl: updated.photo_package || null,
        guidePhotoUrl: updated.photo_guide || null,
      }).catch((err) => {
        console.error("Error al enviar correo de guía:", err);
        return false;
      });

      if (emailSent) {
        await prisma.orderShipment.update({
          where: { id: updated.id },
          data: {
            guide_email_sent_at: now,
            guide_email_sent_to: targetEmail,
          },
        }).catch(console.error);
      }
    }

    const finalShipment = await prisma.orderShipment.findUnique({ where: { id: updated.id } });

    return NextResponse.json({
      success: true,
      shipment: {
        id: updated.id,
        tracking_number: updated.tracking_number,
        photo_guide: updated.photo_guide,
        edited_at: updated.edited_at?.toISOString() ?? null,
        guide_email_sent_at: finalShipment?.guide_email_sent_at?.toISOString() ?? null,
        guide_email_sent_to: finalShipment?.guide_email_sent_to ?? null,
      },
      emailSent,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "EMAIL_DUPLICATE") {
      return NextResponse.json({ error: "El correo ingresado ya pertenece a otro cliente registrado" }, { status: 409 });
    }
    console.error("POST /api/orders/[id]/guia error:", err);
    return NextResponse.json({ error: "Error interno al guardar la guía" }, { status: 500 });
  }
}
