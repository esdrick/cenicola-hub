import { NextResponse } from "next/server";
import { withRole } from "@/lib/api-auth";
import { generatePromoPreviewToken } from "@/lib/promotions";

export async function POST() {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const previewData = generatePromoPreviewToken();
    return NextResponse.json(previewData);
  } catch (error) {
    console.error("POST /api/promociones/preview error:", error);
    return NextResponse.json(
      { error: "Error al generar el token de vista previa" },
      { status: 500 }
    );
  }
}
