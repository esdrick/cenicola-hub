import { NextResponse } from "next/server";
import { withRole } from "@/lib/api-auth";
import { generatePromoPreviewToken } from "@/lib/promotions";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const previewData = generatePromoPreviewToken();
    return NextResponse.json(previewData);
  } catch (error) {
    console.error("POST /api/promociones/preview error:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Error al generar el enlace de vista previa";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
