import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { uploadToCloudinary } from "@/lib/cloudinary";

export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });

  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!validTypes.includes(file.type)) {
    return NextResponse.json({ error: "Solo se permiten imágenes (JPG, PNG, WEBP, GIF)" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "El archivo no puede superar 5MB" }, { status: 400 });
  }

  const url = await uploadToCloudinary(file, "cenicola/pagos");
  return NextResponse.json({ url });
}
