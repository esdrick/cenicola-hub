import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ names: [], suggestions: [] });

  const products = await prisma.product.findMany({
    where: {
      name: { contains: q, mode: "insensitive" },
      is_active: true,
    },
    select: {
      name: true,
      type: true,
      description: true,
    },
    distinct: ["name"],
    orderBy: { name: "asc" },
    take: 8,
  });

  return NextResponse.json({
    names: products.map((p) => p.name),
    suggestions: products.map((p) => ({
      name: p.name,
      type: p.type,
      description: p.description,
    })),
  });
}
