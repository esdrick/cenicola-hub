export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmbalajeTable } from "@/components/shared/embalaje/EmbalajeTable";
import type { EmbalajeOrdenJSON } from "@/types";

export default async function EmbalajeListPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["admin", "embalador"].includes(session.role)) redirect("/dashboard");

  const orders = await prisma.order.findMany({
    where: { status: "en_embalaje" },
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

  const data: EmbalajeOrdenJSON[] = orders.map((o) => {
    const items_summary = o.items
      .map((item) => {
        const snap = item.variant_snapshot as Record<string, string> | null;
        const productName = item.variant?.product?.name ?? snap?.product_name ?? "Producto";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Embalaje</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {data.length} orden{data.length !== 1 ? "es" : ""} pendiente{data.length !== 1 ? "s" : ""} de embalaje
        </p>
      </div>
      <EmbalajeTable initialOrders={data} />
    </div>
  );
}
