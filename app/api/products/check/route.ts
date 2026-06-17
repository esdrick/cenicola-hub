import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const name = request.nextUrl.searchParams.get("name")?.trim() ?? "";
  const color = request.nextUrl.searchParams.get("color")?.trim() || null;

  if (!name) return NextResponse.json({ exists: false });

  const existing = await prisma.product.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      color: color ? { equals: color, mode: "insensitive" } : null,
      is_active: true,
    },
    select: { id: true, name: true, color: true },
  });

  if (!existing) return NextResponse.json({ exists: false });
  return NextResponse.json({ exists: true, id: existing.id, name: existing.name, color: existing.color });
}
