import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, withRole } from "@/lib/api-auth";
import {
  getCatalogPillsConfig,
  validateCatalogPills,
  STORE_CATALOG_PILLS_KEY,
} from "@/lib/settings";

export async function GET() {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  try {
    const { pills, systemCategories, hasSavedConfig } = await getCatalogPillsConfig();
    return NextResponse.json({
      pills,
      systemCategories,
      hasSavedConfig,
    });
  } catch (error) {
    console.error("GET /api/settings/catalog-pills error:", error);
    return NextResponse.json(
      { error: "Error al obtener la configuración de filtros web" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await withRole(["admin", "inventario"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const rawList = Array.isArray(body) ? body : body?.pills;

    const validation = validateCatalogPills(rawList);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    await prisma.systemSetting.upsert({
      where: { key: STORE_CATALOG_PILLS_KEY },
      create: {
        key: STORE_CATALOG_PILLS_KEY,
        value: JSON.stringify(validation.pills),
        updated_by: auth.session.id,
      },
      update: {
        value: JSON.stringify(validation.pills),
        updated_by: auth.session.id,
      },
    });

    return NextResponse.json({ pills: validation.pills });
  } catch (error) {
    console.error("PUT /api/settings/catalog-pills error:", error);
    return NextResponse.json(
      { error: "Error al guardar la configuración de filtros web" },
      { status: 500 }
    );
  }
}
