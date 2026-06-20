export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EnviadasTable } from "@/components/shared/embalaje/EnviadasTable";
import type { EmbalajeOrdenJSON, EmbalajeShipmentJSON } from "@/types";

export default async function EnviadasPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["admin", "embalador"].includes(session.role)) redirect("/dashboard");
  if (session.role === "admin") redirect("/dashboard/embalaje?tab=historial");

  const isEmbalador = session.role === "embalador";

  const orders = await prisma.order.findMany({
    where: isEmbalador
      ? { status: { in: ["enviada", "completada"] }, shipment: { packed_by: session.id } }
      : { status: { in: ["enviada", "completada"] } },
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

  const data: EmbalajeOrdenJSON[] = orders.map((o) => {
    const items_summary = o.items
      .map((item) => {
        const snap = item.variant_snapshot as Record<string, unknown> | null;
        const productName = item.variant?.product?.name ?? snap?.product_name ?? "Producto";
        const colorStr = item.variant?.product?.color ?? (snap?.color as string | undefined) ?? null;
        const size = item.variant?.size ?? snap?.size ?? "";
        const label = [productName, colorStr].filter(Boolean).join(" ");
        return `${label} T-${size} ×${item.quantity}`;
      })
      .join(", ");

    let shipment: EmbalajeShipmentJSON | null = null;
    if (o.shipment) {
      shipment = {
        id: o.shipment.id,
        packed_by: o.shipment.packed_by,
        packed_at: o.shipment.packed_at.toISOString(),
        shipped_at: o.shipment.shipped_at?.toISOString() ?? null,
        tracking_number: o.shipment.tracking_number,
        photo_package: o.shipment.photo_package,
        photo_receipt: o.shipment.photo_receipt,
        notes: o.shipment.notes,
        packer: o.shipment.packer,
      };
    }

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

  const title = isEmbalador ? "Mi Historial de Envíos" : "Historial de Envíos";
  const subtitle = isEmbalador
    ? `${data.length} orden${data.length !== 1 ? "es" : ""} en tu historial`
    : `${data.length} orden${data.length !== 1 ? "es" : ""} enviada${data.length !== 1 ? "s" : ""} o completada${data.length !== 1 ? "s" : ""}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
      </div>
      <EnviadasTable initialOrders={data} role={session.role} />
    </div>
  );
}
