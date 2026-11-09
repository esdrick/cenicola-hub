import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { BASE_CATALOG_CATEGORIES, STORE_CATALOG_PILLS_KEY } from "@/lib/settings";

function formatTypeName(str: string): string {
  const trimmed = str.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function GET() {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  try {
    const [rows, pillsSetting] = await Promise.all([
      prisma.product.groupBy({
        by: ["type"],
        where: {
          is_active: true,
        },
        orderBy: {
          type: "asc",
        },
      }),
      prisma.systemSetting.findUnique({
        where: { key: STORE_CATALOG_PILLS_KEY },
      }),
    ]);

    const baseGenderSet = new Set(
      BASE_CATALOG_CATEGORIES.map((c) => c.toLowerCase())
    );
    const typeMap = new Map<string, string>();

    for (const r of rows) {
      const formatted = formatTypeName(r.type ?? "");
      if (formatted && !typeMap.has(formatted.toLowerCase())) {
        typeMap.set(formatted.toLowerCase(), formatted);
      }
    }

    if (pillsSetting?.value) {
      try {
        const parsed = JSON.parse(pillsSetting.value);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && typeof item.name === "string") {
              const formatted = formatTypeName(item.name);
              const key = formatted.toLowerCase();
              if (formatted && !baseGenderSet.has(key) && !typeMap.has(key)) {
                typeMap.set(key, formatted);
              }
            }
          }
        }
      } catch {
        // ignore invalid JSON
      }
    }

    const types = Array.from(typeMap.values()).sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    );

    return NextResponse.json({ types });
  } catch (error) {
    console.error("GET /api/products/types error:", error);
    return NextResponse.json({ error: "Error al obtener los tipos de productos" }, { status: 500 });
  }
}
