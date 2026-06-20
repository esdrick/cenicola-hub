import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getTasa } from "@/lib/tasa-cambio";

export async function GET() {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const tasa = await getTasa(auth.session.id);

  if (!tasa) {
    return NextResponse.json(
      { error: "No hay tasa de cambio disponible. Registra una manualmente." },
      { status: 503 }
    );
  }

  return NextResponse.json(tasa);
}
