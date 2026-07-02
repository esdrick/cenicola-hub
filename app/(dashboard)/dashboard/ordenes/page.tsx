export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { OrdersTable } from "@/components/shared/ordenes/OrdersTable";
import { CartsSection } from "@/components/shared/carritos/CartsSection";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderJSON, CartJSON, CartItemJSON } from "@/types";
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
  const canUseCarts  = isRestricted || session.role === "admin" || session.role === "inventario";

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

  const [orders, total, sellers, rawCarts] = await Promise.all([
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
    canUseCarts
      ? prisma.cart.findMany({
          where: {
            vendor_id: session.id,
            status: "active",
          },
          include: {
            vendor: { select: { id: true, name: true } },
            items: {
              include: {
                variant: {
                  include: {
                    product: { select: { id: true, name: true, color: true, photos: true } },
                  },
                },
              },
              orderBy: { created_at: "asc" },
            },
          },
          orderBy: { updated_at: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const data: OrderJSON[] = orders.map((o) => ({
    ...o,
    total_usd:        Number(o.total_usd),
    pricing_method:   o.pricing_method as "bcv" | "divisas" | null,
    created_at: o.created_at.toISOString(),
    updated_at: o.updated_at.toISOString(),
  }));

  const carts: CartJSON[] = rawCarts.map((cart) => {
    const ch = cart.channel;
    const items: CartItemJSON[] = cart.items.map((item) => {
      const stock = ch === "online" ? item.variant.stock_online : item.variant.stock_store;
      return {
        id: item.id,
        cart_id: item.cart_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price_usd: Number(item.unit_price_usd),
        created_at: item.created_at.toISOString(),
        stock_warning: stock < item.quantity,
        stock_available: stock,
        variant: {
          id: item.variant.id,
          size: item.variant.size,
          sku: item.variant.sku,
          stock_online: item.variant.stock_online,
          stock_store: item.variant.stock_store,
          product: {
            id: item.variant.product.id,
            name: item.variant.product.name,
            color: item.variant.product.color,
            photos: item.variant.product.photos,
          },
        },
      };
    });
    return {
      id: cart.id,
      vendor_id: cart.vendor_id,
      channel: cart.channel,
      note: cart.note,
      status: cart.status,
      pricing_method: cart.pricing_method,
      created_at: cart.created_at.toISOString(),
      updated_at: cart.updated_at.toISOString(),
      vendor: cart.vendor,
      items,
      total_usd: items.reduce((s, i) => s + i.unit_price_usd * i.quantity, 0),
      has_stock_issues: items.some((i) => i.stock_warning),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Órdenes</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {total} orden{total !== 1 ? "es" : ""}
          </p>
        </div>
        {canUseCarts && (
          <Link href="/dashboard/ordenes/nueva" className={cn(buttonVariants())}>
            <Plus size={16} />
            Nueva orden
          </Link>
        )}
      </div>

      {carts.length > 0 && <CartsSection initialCarts={carts} />}

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
