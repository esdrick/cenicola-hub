import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const low_stock_threshold = await getSetting("low_stock_threshold");
  return NextResponse.json({ low_stock_threshold });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!["admin", "inventario"].includes(session.role)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const body = await req.json();
  const raw = parseInt(body.low_stock_threshold, 10);

  if (isNaN(raw) || raw < 1 || raw > 999) {
    return NextResponse.json({ error: "Valor inválido (1–999)" }, { status: 400 });
  }

  await prisma.systemSetting.upsert({
    where: { key: "low_stock_threshold" },
    create: { key: "low_stock_threshold", value: String(raw), updated_by: session.id },
    update: { value: String(raw), updated_by: session.id },
  });

  return NextResponse.json({ low_stock_threshold: raw });
}
