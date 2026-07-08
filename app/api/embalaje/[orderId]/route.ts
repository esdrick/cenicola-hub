import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";

// GET /api/embalaje/[orderId] — full order detail
export async function GET(
  _request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const auth = await withRole(["admin", "embalador", "inventario", "vendedora_online"]);
  if (!auth.ok) return auth.response;

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
      creator: { select: { id: true, name: true } },
      items: {
        include: {
          variant: {
            include: {
              product: {
                select: { id: true, name: true, color: true, photos: true },
              },
            },
          },
        },
      },
      shipment: {
        include: {
          packer: { select: { id: true, name: true } },
          editor: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

  const shipment = order.shipment
    ? {
        id: order.shipment.id,
        packed_by: order.shipment.packed_by,
        packed_at: order.shipment.packed_at.toISOString(),
        shipped_at: order.shipment.shipped_at?.toISOString() ?? null,
        tracking_number: order.shipment.tracking_number,
        photo_package: order.shipment.photo_package,
        photo_receipt: order.shipment.photo_receipt,
        photo_guide: order.shipment.photo_guide,
        notes: order.shipment.notes,
        edited_at: order.shipment.edited_at?.toISOString() ?? null,
        packer: order.shipment.packer,
        editor: order.shipment.editor,
      }
    : null;

  const data = {
    id: order.id,
    order_number: order.order_number,
    channel: order.channel,
    status: order.status,
    customer_name: order.customer_name,
    customer_lastname: order.customer_lastname,
    customer_id_doc: order.customer_id_doc,
    address: order.address,
    shipping_company: order.shipping_company,
    total_usd: Number(order.total_usd),
    notes: order.notes,
    created_at: order.created_at.toISOString(),
    creator: order.creator,
    items: order.items.map((item) => ({
      id: item.id,
      order_id: item.order_id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price_usd: Number(item.unit_price_usd),
      subtotal_usd: Number(item.subtotal_usd),
      variant_snapshot: item.variant_snapshot,
      variant: {
        id: item.variant.id,
        size: item.variant.size,
        sku: item.variant.sku,
        product: item.variant.product,
      },
    })),
    shipment,
  };

  return NextResponse.json(data);
}
