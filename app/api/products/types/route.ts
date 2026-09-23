import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET() {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  try {
    const rows = await prisma.product.groupBy({
      by: ["type"],
      where: {
        is_active: true,
      },
      orderBy: {
        type: "asc",
      },
    });

    const types = rows
      .map((r) => r.type?.trim())
      .filter((t): t is string => Boolean(t && t.length > 0));

    return NextResponse.json({ types });
  } catch (error) {
    console.error("GET /api/products/types error:", error);
    return NextResponse.json({ error: "Error al obtener los tipos de productos" }, { status: 500 });
  }
}
