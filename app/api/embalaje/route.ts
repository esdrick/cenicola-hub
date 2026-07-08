export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";

// GET /api/embalaje — orders in en_embalaje
export async function GET(request: NextRequest) {
  const auth = await withRole(["admin", "embalador", "inventario", "vendedora_online"]);
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";

  const where = {
    status: "en_embalaje" as const,
    ...(q && {
      OR: [
        { order_number: { contains: q, mode: "insensitive" as const } },
        { customer_name: { contains: q, mode: "insensitive" as const } },
        { customer_lastname: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const orders = await prisma.order.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true } },
      items: {
        include: {
          variant: {
            include: {
              product: { select: { id: true, name: true, color: true } },
            },
          },
        },
      },
    },
    orderBy: { updated_at: "asc" },
  });

  const data = orders.map((o) => {
    const items_summary = o.items
      .map((item) => {
        const snap = item.variant_snapshot as Record<string, string> | null;
        const productName =
          item.variant?.product?.name ?? snap?.product_name ?? "Producto";
        const color = item.variant?.product?.color ?? snap?.color ?? null;
        const size = item.variant?.size ?? snap?.size ?? "";
        const label = [productName, color].filter(Boolean).join(" ");
        return `${label} T-${size} ×${item.quantity}`;
      })
      .join(", ");

    return {
      id: o.id,
      order_number: o.order_number,
      channel: o.channel,
      status: o.status,
      customer_name: o.customer_name,
      customer_lastname: o.customer_lastname,
      address: o.address,
      shipping_company: o.shipping_company,
      total_usd: Number(o.total_usd),
      notes: o.notes,
      created_at: o.created_at.toISOString(),
      updated_at: o.updated_at.toISOString(),
      creator: o.creator,
      items_summary,
      shipment: null,
    };
  });

  return NextResponse.json({ data });
}
