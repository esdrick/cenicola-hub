import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api-auth";
import { uploadToCloudinary } from "@/lib/cloudinary";

const VALID_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;
const MAX_SIZE = 5 * 1024 * 1024;

// POST /api/embalaje/[orderId]/fotos — upload package photos
export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const auth = await withRole(["admin", "embalador", "inventario"]);
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

  const folder = `cenicola/envios/${orderId}`;
  const foto1Url = await uploadToCloudinary(foto1, folder);

  let foto2Url: string | null = null;
  if (foto2 && foto2.size > 0) {
    foto2Url = await uploadToCloudinary(foto2, folder);
  }

  return NextResponse.json({ foto1Url, foto2Url });
}
