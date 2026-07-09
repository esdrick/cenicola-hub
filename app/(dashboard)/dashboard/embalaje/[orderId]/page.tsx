export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmbalajeDetailClient } from "@/components/shared/embalaje/EmbalajeDetailClient";
import type { EmbalajeOrdenDetailJSON, EmbalajeShipmentJSON } from "@/types";

export default async function EmbalajeDetailPage({
  params,
}: {
  params: { orderId: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["admin", "embalador", "inventario", "vendedora_online"].includes(session.role)) redirect("/dashboard");

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

  if (!order) notFound();

  // Vendedoras online solo pueden empacar las órdenes que ellas mismas vendieron.
  if (session.role === "vendedora_online" && order.created_by !== session.id) {
    redirect("/dashboard/embalaje");
  }

  // Redirect if not in correct status
  if (order.status === "enviada" || order.status === "completada") {
    redirect("/dashboard/embalaje/enviadas");
  }
  if (order.status !== "en_embalaje") {
    redirect("/dashboard/embalaje");
  }

  let shipment: EmbalajeShipmentJSON | null = null;
  if (order.shipment) {
    shipment = {
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
    };
  }

  const data: EmbalajeOrdenDetailJSON = {
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

  return <EmbalajeDetailClient order={data} />;
}
