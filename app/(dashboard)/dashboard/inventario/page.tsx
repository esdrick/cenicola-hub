import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { MovimientosTable } from "@/components/shared/inventario/MovimientosTable";
import { StockTable } from "@/components/shared/inventario/StockTable";
import { InventarioHeader } from "@/components/shared/inventario/InventarioHeader";
import { getSetting } from "@/lib/settings";
import type { MovementJSON, MovementType, MovementChannel, StockVariantJSON } from "@/types";

type SearchParams = { [key: string]: string | string[] | undefined };

function sp(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

// LOW_STOCK is read from the database at request time via getSetting()

// ─── Stock actual ─────────────────────────────────────────────────────────────

async function getStock(params: SearchParams, lowStock: number) {
  const q = sp(params.q);
  const talla = sp(params.talla);
  const tipo = sp(params.tipo);
  const stockStatus = sp(params.stock_status);
  const page = Math.max(1, parseInt(sp(params.page) || "1"));
  const pageSize = 50;

  const qFilters = q
    ? q.trim().split(/\s+/).filter(Boolean).map((t) => ({
        OR: [
          { product: { name: { contains: t, mode: "insensitive" as const } } },
          { product: { color: { contains: t, mode: "insensitive" as const } } },
          { size: { contains: t, mode: "insensitive" as const } },
        ],
      }))
    : [];

  const where = {
    is_active: true,
    ...(stockStatus === "sin" && { stock_total: 0 }),
    ...(stockStatus === "bajo" && { stock_total: { gt: 0, lt: lowStock } }),
    ...(talla && { size: { contains: talla, mode: "insensitive" as const } }),
    AND: [
      ...(tipo ? [{ product: { type: { contains: tipo, mode: "insensitive" as const } } }] : []),
      ...qFilters,
    ],
  };

  const [variants, total] = await Promise.all([
    prisma.productVariant.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, type: true, color: true } },
      },
      orderBy: [{ product: { name: "asc" } }, { size: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.productVariant.count({ where }),
  ]);

  const data: StockVariantJSON[] = variants.map((v) => ({
    id: v.id,
    product_id: v.product_id,
    sku: v.sku,
    size: v.size,
    stock_total: v.stock_total,
    stock_online: v.stock_online,
    stock_store: v.stock_store,
    price_bcv: Number(v.price_bcv),
    product: {
      id: v.product.id,
      name: v.product.name,
      type: v.product.type,
      color: v.product.color,
    },
  }));

  return { data, total, page, totalPages: Math.ceil(total / pageSize) };
}

// ─── Movimientos ──────────────────────────────────────────────────────────────

async function getMovements(params: SearchParams) {
  const q = sp(params.q);
  const talla = sp(params.talla);
  const tipo = sp(params.tipo) as MovementType | "";
  const canal = sp(params.canal) as MovementChannel | "";
  const desde = sp(params.desde);
  const hasta = sp(params.hasta);
  const page = Math.max(1, parseInt(sp(params.page) || "1"));
  const pageSize = 30;

  const variantWhere: Record<string, unknown> = {};
  if (q) {
    const terms = q.trim().split(/\s+/).filter(Boolean);
    const termFilters = terms.map((t) => ({
      OR: [
        { product: { name: { contains: t, mode: "insensitive" as const } } },
        { product: { color: { contains: t, mode: "insensitive" as const } } },
        { size: { contains: t, mode: "insensitive" as const } },
      ],
    }));
    variantWhere.AND = termFilters;
  }
  if (talla) {
    variantWhere.size = { contains: talla, mode: "insensitive" as const };
  }

  const where = {
    ...(tipo && { type: tipo }),
    ...(canal && { channel: canal }),
    ...(desde && !hasta && { created_at: { gte: new Date(desde) } }),
    ...(hasta && !desde && { created_at: { lte: new Date(`${hasta}T23:59:59`) } }),
    ...(desde && hasta && {
      created_at: { gte: new Date(desde), lte: new Date(`${hasta}T23:59:59`) },
    }),
    ...(Object.keys(variantWhere).length > 0 && { variant: variantWhere }),
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const canAdjust = session.role === "admin" || session.role === "inventario";
  const tab = sp(searchParams.tab) || "stock";
  const lowStockThreshold = await getSetting("low_stock_threshold");

  const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "UNIQUE"];
  const [rawSizes, rawTipos] = await Promise.all([
    prisma.productVariant.findMany({
      select: { size: true },
      distinct: ["size"],
      orderBy: { size: "asc" },
    }),
    prisma.product.findMany({
      where: { is_active: true, type: { not: "" } },
      select: { type: true },
      distinct: ["type"],
      orderBy: { type: "asc" },
    }),
  ]);
  const tallas = rawSizes
    .map((v) => v.size)
    .sort((a, b) => {
      const ia = SIZE_ORDER.indexOf(a);
      const ib = SIZE_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  const tipos = rawTipos.map((t) => t.type).filter(Boolean) as string[];

  const stockResult = tab !== "movimientos" ? await getStock(searchParams, lowStockThreshold) : null;
  const movResult = tab === "movimientos" ? await getMovements(searchParams) : null;

  const subtitle =
    tab === "movimientos"
      ? `${movResult!.total} movimiento${movResult!.total !== 1 ? "s" : ""} registrado${movResult!.total !== 1 ? "s" : ""}`
      : `${stockResult!.total} variante${stockResult!.total !== 1 ? "s" : ""} activa${stockResult!.total !== 1 ? "s" : ""}`;

  const tabClass = (active: boolean) =>
    cn(
      "flex flex-1 sm:flex-none items-center justify-center sm:justify-start rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
      active
        ? "bg-gray-900 text-white shadow-sm"
        : "text-gray-500 hover:text-gray-900"
    );

  return (
    <div className="space-y-6">
      <InventarioHeader subtitle={subtitle} canAdjust={canAdjust} lowStockThreshold={lowStockThreshold} />

      {/* ── Tabs ── */}
      <div className="flex w-full sm:w-fit gap-1 rounded-lg border bg-gray-50 p-1">
        <Link href="/dashboard/inventario?tab=stock" className={tabClass(tab !== "movimientos")}>
          Stock actual
        </Link>
        <Link href="/dashboard/inventario?tab=movimientos" className={tabClass(tab === "movimientos")}>
          Movimientos
        </Link>
      </div>

      <Suspense>
        {tab === "movimientos" ? (
          <MovimientosTable
            movements={movResult!.data}
            total={movResult!.total}
            page={movResult!.page}
            totalPages={movResult!.totalPages}
            tallas={tallas}
          />
        ) : (
          <StockTable
            variants={stockResult!.data}
            total={stockResult!.total}
            page={stockResult!.page}
            totalPages={stockResult!.totalPages}
            lowStockThreshold={lowStockThreshold}
            tallas={tallas}
            tipos={tipos}
          />
        )}
      </Suspense>
    </div>
  );
}
