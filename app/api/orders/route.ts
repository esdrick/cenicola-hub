import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import type { OrderStatus, OrderChannel } from "@/app/generated/prisma/client";

// GET /api/orders
export async function GET(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const q      = sp.get("q")?.trim() ?? "";
  const status = sp.get("status") as OrderStatus | null;
  const channel = sp.get("channel") as OrderChannel | null;
  const sellerId = sp.get("seller") ?? "";
  const desde  = sp.get("desde") ?? "";
  const hasta  = sp.get("hasta") ?? "";
  const page   = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const pageSize = 25;

  const isRestricted = auth.session.role === "vendedora_online" || auth.session.role === "vendedora_tienda";

  const where = {
    // Vendedoras only see their own orders
    ...(isRestricted && { created_by: auth.session.id }),
    // Admin filter by seller
    ...(!isRestricted && sellerId && { created_by: sellerId }),
    ...(status  && { status }),
    ...(channel && { channel }),
    ...(desde && !hasta && { created_at: { gte: new Date(desde) } }),
    ...(hasta && !desde && { created_at: { lte: new Date(`${hasta}T23:59:59`) } }),
    ...(desde && hasta && { created_at: { gte: new Date(desde), lte: new Date(`${hasta}T23:59:59`) } }),
    ...(q && {
      OR: [
        { customer_name: { contains: q, mode: "insensitive" as const } },
        { customer_lastname: { contains: q, mode: "insensitive" as const } },
        { customer_id_doc: { contains: q, mode: "insensitive" as const } },
        { order_number: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  const data = orders.map((o) => ({
    ...o,
    total_usd: Number(o.total_usd),
    created_at: o.created_at.toISOString(),
    updated_at: o.updated_at.toISOString(),
  }));

  return NextResponse.json({ data, total, page, totalPages: Math.ceil(total / pageSize) });
}
