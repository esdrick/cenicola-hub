import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET() {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const rows = await prisma.productVariant.findMany({
    select: { size: true },
    distinct: ["size"],
    orderBy: { size: "asc" },
    take: 50,
  });

  return NextResponse.json({ sizes: rows.map((r) => r.size) });
}
