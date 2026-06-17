import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { withAuth } from "@/lib/api-auth";

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

  const maxMb = 5;
  if (file.size > maxMb * 1024 * 1024) {
    return NextResponse.json({ error: `El archivo no puede superar ${maxMb}MB` }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filename = `${randomUUID()}.${ext}`;
  const uploadDir = join(process.cwd(), "public", "uploads");
  const filePath = join(uploadDir, filename);

  const bytes = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));

  return NextResponse.json({ url: `/uploads/${filename}` });
}
