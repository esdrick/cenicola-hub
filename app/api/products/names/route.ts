import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ names: [] });

  const rows = await prisma.product.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: { name: true },
    distinct: ["name"],
    orderBy: { name: "asc" },
    take: 8,
  });

  return NextResponse.json({ names: rows.map((r) => r.name) });
}
