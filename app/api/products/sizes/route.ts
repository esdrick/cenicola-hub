import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export const revalidate = 3600;

export async function GET() {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const rows = await prisma.$queryRaw<{ size: string }[]>`
    SELECT DISTINCT size FROM product_variants WHERE is_active = true ORDER BY size ASC LIMIT 50
  `;

  return NextResponse.json({ sizes: rows.map((r) => r.size) });
}
