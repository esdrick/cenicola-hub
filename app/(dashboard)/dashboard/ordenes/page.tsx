export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { OrdersTable } from "@/components/shared/ordenes/OrdersTable";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderJSON } from "@/types";
import type { OrderStatus, OrderChannel } from "@/app/generated/prisma/client";

type SP = { [key: string]: string | string[] | undefined };
function s(v: string | string[] | undefined) { return typeof v === "string" ? v : ""; }

const PAGE_SIZE = 25;

export default async function OrdenesPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const q        = s(searchParams.q);
  const status   = s(searchParams.status) as OrderStatus | "";
  const channel  = s(searchParams.channel) as OrderChannel | "";
  const seller   = s(searchParams.seller);
  const desde    = s(searchParams.desde);
  const hasta    = s(searchParams.hasta);
  const page     = Math.max(1, parseInt(s(searchParams.page) || "1"));

  const isRestricted = session.role === "vendedora_online" || session.role === "vendedora_tienda";
  const canSeeAll    = !isRestricted;

  const where = {
    ...(isRestricted && { created_by: session.id }),
    ...(canSeeAll && seller && { created_by: seller }),
    ...(status  && { status }),
    ...(channel && { channel }),
    ...(desde && !hasta && { created_at: { gte: new Date(desde) } }),
    ...(hasta && !desde && { created_at: { lte: new Date(`${hasta}T23:59:59`) } }),
    ...(desde && hasta  && { created_at: { gte: new Date(desde), lte: new Date(`${hasta}T23:59:59`) } }),
    ...(q && {
      OR: [
        { customer_name:     { contains: q, mode: "insensitive" as const } },
        { customer_lastname: { contains: q, mode: "insensitive" as const } },
        { customer_id_doc:   { contains: q, mode: "insensitive" as const } },
        { order_number:      { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const [orders, total, sellers] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
    canSeeAll
      ? prisma.user.findMany({
          where: {
            role: { in: ["vendedora_online", "vendedora_tienda", "admin"] },
            is_active: true,
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const data: OrderJSON[] = orders.map((o) => ({
    ...o,
    total_usd:  Number(o.total_usd),
    created_at: o.created_at.toISOString(),
    updated_at: o.updated_at.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Órdenes</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {total} orden{total !== 1 ? "es" : ""}
          </p>
        </div>
        <Link href="/dashboard/ordenes/nueva" className={cn(buttonVariants())}>
          <Plus size={16} className="mr-2" />
          Nueva orden
        </Link>
      </div>

      <OrdersTable
        orders={data}
        total={total}
        page={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        sellers={sellers}
        isAdmin={canSeeAll}
      />
    </div>
  );
}
