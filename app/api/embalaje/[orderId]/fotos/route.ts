import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { withRole } from "@/lib/api-auth";

const VALID_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function mimeToExt(mime: string): string {
  if (mime === "image/jpeg" || mime === "image/jpg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

// POST /api/embalaje/[orderId]/fotos — upload package photos
export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const auth = await withRole(["admin", "embalador"]);
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

  // Validate foto1
  if (!VALID_TYPES.includes(foto1.type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json(
      { error: "Tipo de archivo inválido para foto1. Solo JPG, PNG, WEBP." },
      { status: 400 }
    );
  }
  if (foto1.size > MAX_SIZE) {
    return NextResponse.json({ error: "La foto del paquete no puede superar 5MB" }, { status: 400 });
  }

  // Validate foto2 if present
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

  const uploadDir = path.join(process.cwd(), "public", "uploads", "envios", orderId);
  await mkdir(uploadDir, { recursive: true });

  // Save foto1
  const ext1 = mimeToExt(foto1.type);
  const foto1Filename = `foto1${ext1}`;
  const foto1Path = path.join(uploadDir, foto1Filename);
  const foto1Bytes = await foto1.arrayBuffer();
  await writeFile(foto1Path, Buffer.from(foto1Bytes));
  const foto1Url = `/uploads/envios/${orderId}/${foto1Filename}`;

  // Save foto2 if present
  let foto2Url: string | null = null;
  if (foto2 && foto2.size > 0) {
    const ext2 = mimeToExt(foto2.type);
    const foto2Filename = `foto2${ext2}`;
    const foto2Path = path.join(uploadDir, foto2Filename);
    const foto2Bytes = await foto2.arrayBuffer();
    await writeFile(foto2Path, Buffer.from(foto2Bytes));
    foto2Url = `/uploads/envios/${orderId}/${foto2Filename}`;
  }

  return NextResponse.json({ foto1Url, foto2Url });
}
