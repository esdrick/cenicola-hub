import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";
import { rangoADateTime } from "@/lib/payroll-periods";
import type { OrderChannel, Prisma } from "@/app/generated/prisma";

export async function GET(request: NextRequest) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");
  const canal = sp.get("canal") ?? "all";

  let inicio: Date | undefined;
  let fin: Date | undefined;
  if (desde && hasta) {
    const range = rangoADateTime(desde, hasta);
    inicio = range.inicio;
    fin = range.fin;
  }

  // Where clause for eligible orders in period
  const orderWhere: Prisma.OrderWhereInput = {
    status: { in: ["enviada", "completada"] },
    ...(canal && canal !== "all" ? { channel: canal as OrderChannel } : {}),
    ...(inicio && fin ? { updated_at: { gte: inicio, lte: fin } } : {}),
  };

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Ejecución EN PARALELO de las consultas de base de datos
  const [items, recentSoldVariants, activeProducts] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: orderWhere },
      select: {
        quantity: true,
        subtotal_usd: true,
        variant_snapshot: true,
        variant: {
          select: {
            id: true,
            size: true,
            product: {
              select: {
                id: true,
                name: true,
                type: true,
                color: true,
                photos: true,
              },
            },
          },
        },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: ["enviada", "completada"] },
          updated_at: { gte: thirtyDaysAgo },
        },
      },
      select: { variant_id: true },
      distinct: ["variant_id"],
    }),
    prisma.product.findMany({
      where: {
        is_active: true,
        variants: {
          some: {
            is_active: true,
            stock_total: { gt: 0 },
          },
        },
      },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        photos: true,
        variants: {
          where: { is_active: true },
          select: {
            id: true,
            stock_total: true,
            stock_online: true,
            stock_store: true,
          },
        },
      },
    }),
  ]);

  let totalUnidades = 0;
  let totalFacturado = 0;

  type ProductAgg = {
    id: string;
    name: string;
    type: string;
    color: string | null;
    photo: string | null;
    totalUnits: number;
    totalUsd: number;
    sizes: Record<string, number>;
  };

  const productMap = new Map<string, ProductAgg>();

  for (const item of items) {
    const qty = item.quantity;
    const usd = Number(item.subtotal_usd);
    totalUnidades += qty;
    totalFacturado += usd;

    type VariantSnapshot = { product_name?: string; product_type?: string; size?: string };
    const snapshot = item.variant_snapshot as VariantSnapshot | null;

    const prod = item.variant?.product;
    const prodId = prod?.id ?? "unknown";
    const prodName = prod?.name ?? snapshot?.product_name ?? "Producto no especificado";
    const prodType = prod?.type ?? snapshot?.product_type ?? "General";
    const prodColor = prod?.color ?? null;
    const photo = prod?.photos?.[0] ?? null;
    const size = item.variant?.size ?? snapshot?.size ?? "Única";

    const existingProd = productMap.get(prodId) ?? {
      id: prodId,
      name: prodName,
      type: prodType,
      color: prodColor,
      photo,
      totalUnits: 0,
      totalUsd: 0,
      sizes: {},
    };

    existingProd.totalUnits += qty;
    existingProd.totalUsd += usd;
    existingProd.sizes[size] = (existingProd.sizes[size] ?? 0) + qty;
    productMap.set(prodId, existingProd);
  }

  // Top 10 productos más vendidos
  const topProductos = Array.from(productMap.values())
    .sort((a, b) => b.totalUnits - a.totalUnits)
    .slice(0, 10);

  // Filtrado de productos estancados (sin ventas en 30 días con stock positivo)
  const recentSoldVariantIds = new Set(recentSoldVariants.map((v) => v.variant_id));

  const productosEstancados = activeProducts
    .map((p) => {
      const hasRecentSales = p.variants.some((v) => recentSoldVariantIds.has(v.id));
      const stockTotal = p.variants.reduce((s, v) => s + v.stock_total, 0);
      const stockOnline = p.variants.reduce((s, v) => s + v.stock_online, 0);
      const stockStore = p.variants.reduce((s, v) => s + v.stock_store, 0);

      return {
        id: p.id,
        name: p.name,
        type: p.type,
        color: p.color,
        photo: p.photos[0] ?? null,
        stockTotal,
        stockOnline,
        stockStore,
        hasRecentSales,
      };
    })
    .filter((p) => !p.hasRecentSales && p.stockTotal > 0)
    .sort((a, b) => b.stockTotal - a.stockTotal)
    .slice(0, 10);

  return NextResponse.json({
    totalUnidades,
    totalFacturado,
    totalProductosDistintos: productMap.size,
    topProductos,
    productosEstancados,
  });
}
