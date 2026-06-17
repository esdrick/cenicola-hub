import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

// GET /api/inventory?q=&tipo=&canal=&desde=&hasta=&page=1
export async function GET(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const tipo = sp.get("tipo")?.trim() ?? "";
  const canal = sp.get("canal")?.trim() ?? "";
  const desde = sp.get("desde") ?? "";
  const hasta = sp.get("hasta") ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const pageSize = 30;

  const where = {
    ...(tipo && { type: tipo as never }),
    ...(canal && { channel: canal as never }),
    ...(desde || hasta
      ? {
          created_at: {
            ...(desde && { gte: new Date(desde) }),
            ...(hasta && { lte: new Date(hasta + "T23:59:59Z") }),
          },
        }
      : {}),
    ...(q && {
      variant: {
        product: { name: { contains: q, mode: "insensitive" as const } },
      },
    }),
  };

  const [movements, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      include: {
        variant: {
          select: {
            id: true,
            size: true,
            sku: true,
            product: { select: { id: true, name: true, color: true } },
          },
        },
        created_by_user: { select: { id: true, name: true } },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  const data = movements.map((m) => ({
    ...m,
    created_at: m.created_at.toISOString(),
  }));

  return NextResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
