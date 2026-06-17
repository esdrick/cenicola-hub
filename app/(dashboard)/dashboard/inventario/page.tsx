import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { MovimientosTable } from "@/components/shared/inventario/MovimientosTable";
import { InventarioHeader } from "@/components/shared/inventario/InventarioHeader";
import type { MovementJSON, MovementType, MovementChannel } from "@/types";

type SearchParams = { [key: string]: string | string[] | undefined };

function sp(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

async function getMovements(params: SearchParams) {
  const q = sp(params.q);
  const tipo = sp(params.tipo) as MovementType | "";
  const canal = sp(params.canal) as MovementChannel | "";
  const desde = sp(params.desde);
  const hasta = sp(params.hasta);
  const page = Math.max(1, parseInt(sp(params.page) || "1"));
  const pageSize = 30;

  const where = {
    ...(tipo && { type: tipo }),
    ...(canal && { channel: canal }),
    ...(desde && !hasta && { created_at: { gte: new Date(desde) } }),
    ...(hasta && !desde && { created_at: { lte: new Date(`${hasta}T23:59:59`) } }),
    ...(desde && hasta && {
      created_at: { gte: new Date(desde), lte: new Date(`${hasta}T23:59:59`) },
    }),
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
            product_id: true,
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

  const data: MovementJSON[] = movements.map((m) => ({
    id: m.id,
    type: m.type as MovementType,
    channel: m.channel as MovementChannel,
    qty_before: m.qty_before,
    qty_change: m.qty_change,
    qty_after: m.qty_after,
    reason: m.reason,
    order_id: m.order_id,
    created_at: m.created_at.toISOString(),
    variant: {
      id: m.variant.id,
      size: m.variant.size,
      sku: m.variant.sku,
      product: {
        id: m.variant.product.id,
        name: m.variant.product.name,
        color: m.variant.product.color,
      },
    },
    created_by_user: m.created_by_user,
  }));

  return { data, total, page, totalPages: Math.ceil(total / pageSize) };
}

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const canAdjust = session.role === "admin" || session.role === "inventario";
  const { data, total, page, totalPages } = await getMovements(searchParams);

  return (
    <div className="space-y-6">
      <InventarioHeader total={total} canAdjust={canAdjust} />

      <Suspense>
        <MovimientosTable
          movements={data}
          total={total}
          page={page}
          totalPages={totalPages}
        />
      </Suspense>
    </div>
  );
}
