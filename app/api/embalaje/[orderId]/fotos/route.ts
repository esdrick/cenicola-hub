import { NextRequest, NextResponse } from "next/server";
import { withRole, getClientIp } from "@/lib/api-auth";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;
const MAX_SIZE = 5 * 1024 * 1024;

// POST /api/embalaje/[orderId]/fotos — upload package photos
export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const auth = await withRole(["admin", "embalador", "inventario", "vendedora_online"]);
  if (!auth.ok) return auth.response;

  const { orderId } = params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el formulario" }, { status: 400 });
  }

  const foto1 = formData.get("foto1") as File | null;
  const foto2 = formData.get("foto2") as File | null;
  const foto3 = formData.get("foto3") as File | null;

  if (!foto1) {
    return NextResponse.json({ error: "La foto del paquete es requerida" }, { status: 400 });
  }

  if (!VALID_TYPES.includes(foto1.type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json(
      { error: "Tipo de archivo inválido para foto1. Solo JPG, PNG, WEBP." },
      { status: 400 }
    );
  }
  if (foto1.size > MAX_SIZE) {
    return NextResponse.json({ error: "La foto del paquete no puede superar 5MB" }, { status: 400 });
  }

  if (foto2 && foto2.size > 0) {
    if (!VALID_TYPES.includes(foto2.type as (typeof VALID_TYPES)[number])) {
      return NextResponse.json(
        { error: "Tipo de archivo inválido para foto2. Solo JPG, PNG, WEBP." },
        { status: 400 }
      );
    }
    if (foto2.size > MAX_SIZE) {
      return NextResponse.json({ error: "La foto del recibo no puede superar 5MB" }, { status: 400 });
    }
  }

  if (foto3 && foto3.size > 0) {
    if (!VALID_TYPES.includes(foto3.type as (typeof VALID_TYPES)[number])) {
      return NextResponse.json(
        { error: "Tipo de archivo inválido para foto3. Solo JPG, PNG, WEBP." },
        { status: 400 }
      );
    }
    if (foto3.size > MAX_SIZE) {
      return NextResponse.json({ error: "La foto de la guía no puede superar 5MB" }, { status: 400 });
    }
  }

  const folder = `cenicola/envios/${orderId}`;
  const foto1Url = await uploadToCloudinary(foto1, folder);

  let foto2Url: string | null = null;
  if (foto2 && foto2.size > 0) {
    foto2Url = await uploadToCloudinary(foto2, folder);
  }

  let foto3Url: string | null = null;
  if (foto3 && foto3.size > 0) {
    foto3Url = await uploadToCloudinary(foto3, folder);
  }

  return NextResponse.json({ foto1Url, foto2Url, foto3Url });
}

// PATCH /api/embalaje/[orderId]/fotos — edit package photos of an already confirmed shipment
export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const auth = await withRole(["admin", "inventario"]);
  if (!auth.ok) return auth.response;

  const { orderId } = params;

  const shipment = await prisma.orderShipment.findUnique({ where: { order_id: orderId } });
  if (!shipment) {
    return NextResponse.json({ error: "Esta orden no tiene un envío registrado" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el formulario" }, { status: 400 });
  }

  const foto1 = formData.get("foto1") as File | null;
  const foto2 = formData.get("foto2") as File | null;
  const foto3 = formData.get("foto3") as File | null;
  const removeFoto2 = formData.get("removeFoto2") === "true";
  const removeFoto3 = formData.get("removeFoto3") === "true";

  if (
    (!foto1 || foto1.size === 0) &&
    (!foto2 || foto2.size === 0) &&
    (!foto3 || foto3.size === 0) &&
    !removeFoto2 &&
    !removeFoto3
  ) {
    return NextResponse.json({ error: "No se proporcionó ninguna foto nueva" }, { status: 400 });
  }

  if (foto1 && foto1.size > 0) {
    if (!VALID_TYPES.includes(foto1.type as (typeof VALID_TYPES)[number])) {
      return NextResponse.json(
        { error: "Tipo de archivo inválido para foto1. Solo JPG, PNG, WEBP." },
        { status: 400 }
      );
    }
    if (foto1.size > MAX_SIZE) {
      return NextResponse.json({ error: "La foto del paquete no puede superar 5MB" }, { status: 400 });
    }
  }

  if (foto2 && foto2.size > 0) {
    if (!VALID_TYPES.includes(foto2.type as (typeof VALID_TYPES)[number])) {
      return NextResponse.json(
        { error: "Tipo de archivo inválido para foto2. Solo JPG, PNG, WEBP." },
        { status: 400 }
      );
    }
    if (foto2.size > MAX_SIZE) {
      return NextResponse.json({ error: "La foto del recibo no puede superar 5MB" }, { status: 400 });
    }
  }

  if (foto3 && foto3.size > 0) {
    if (!VALID_TYPES.includes(foto3.type as (typeof VALID_TYPES)[number])) {
      return NextResponse.json(
        { error: "Tipo de archivo inválido para foto3. Solo JPG, PNG, WEBP." },
        { status: 400 }
      );
    }
    if (foto3.size > MAX_SIZE) {
      return NextResponse.json({ error: "La foto de la guía no puede superar 5MB" }, { status: 400 });
    }
  }

  const folder = `cenicola/envios/${orderId}`;

  let photo_package = shipment.photo_package;
  if (foto1 && foto1.size > 0) {
    photo_package = await uploadToCloudinary(foto1, folder);
  }

  let photo_receipt = shipment.photo_receipt;
  if (foto2 && foto2.size > 0) {
    photo_receipt = await uploadToCloudinary(foto2, folder);
  } else if (removeFoto2) {
    photo_receipt = null;
  }

  let photo_guide = shipment.photo_guide;
  if (foto3 && foto3.size > 0) {
    photo_guide = await uploadToCloudinary(foto3, folder);
  } else if (removeFoto3) {
    photo_guide = null;
  }

  const ip = getClientIp(request);
  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.orderShipment.update({
      where: { order_id: orderId },
      data: {
        photo_package,
        photo_receipt,
        photo_guide,
        edited_at: now,
        edited_by: auth.session.id,
      },
      include: { editor: { select: { id: true, name: true } } },
    });

    await tx.auditLog.create({
      data: {
        user_id: auth.session.id,
        action: "embalaje_fotos_editadas",
        entity_type: "OrderShipment",
        entity_id: shipment.id,
        data_before: {
          photo_package: shipment.photo_package,
          photo_receipt: shipment.photo_receipt,
          photo_guide: shipment.photo_guide,
        },
        data_after: { photo_package, photo_receipt, photo_guide },
        ip_address: ip,
      },
    });

    return result;
  });

  return NextResponse.json({
    photo_package: updated.photo_package,
    photo_receipt: updated.photo_receipt,
    photo_guide: updated.photo_guide,
    edited_at: updated.edited_at?.toISOString() ?? null,
    editor: updated.editor,
  });
}
