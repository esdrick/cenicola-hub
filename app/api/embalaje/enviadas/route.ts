export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";

// GET /api/embalaje/enviadas — orders in enviada
export async function GET(request: NextRequest) {
  const auth = await withRole(["admin", "embalador"]);
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";

  const where = {
    status: "enviada" as const,
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
      shipment: {
        include: {
          packer: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { updated_at: "desc" },
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

    const shipment = o.shipment
      ? {
          id: o.shipment.id,
          packed_by: o.shipment.packed_by,
          packed_at: o.shipment.packed_at.toISOString(),
          shipped_at: o.shipment.shipped_at?.toISOString() ?? null,
          tracking_number: o.shipment.tracking_number,
          photo_package: o.shipment.photo_package,
          photo_receipt: o.shipment.photo_receipt,
          notes: o.shipment.notes,
          packer: o.shipment.packer,
        }
      : null;

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
      shipment,
    };
  });

  return NextResponse.json({ data });
}
