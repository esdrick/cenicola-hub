import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { ProductCard } from "@/components/shared/productos/ProductCard";
import { ProductCatalog } from "@/components/shared/productos/ProductCatalog";
import { ProductFilters } from "@/components/shared/productos/ProductFilters";
import { Pagination } from "@/components/shared/Pagination";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductJSON, CartJSON, CartItemJSON } from "@/types";

type SearchParams = { [key: string]: string | string[] | undefined };

function sp(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

async function getProducts(params: SearchParams) {
  const q     = sp(params.q);
  const tipo  = sp(params.tipo);
  const color = sp(params.color);
  const talla = sp(params.talla);
  const page  = Math.max(1, parseInt(sp(params.page) || "1"));
  const pageSize = 24;

  const where = {
    is_active: true,
    ...(q     && { name:  { contains: q,     mode: "insensitive" as const } }),
    ...(tipo  && { type:  { equals:   tipo,  mode: "insensitive" as const } }),
    ...(color && { color: { equals:   color, mode: "insensitive" as const } }),
    ...(talla && { variants: { some: { size: talla, is_active: true } } }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        variants: { where: { is_active: true }, orderBy: { size: "asc" } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  const data: ProductJSON[] = products.map((p) => ({
    ...p,
    created_at: p.created_at.toISOString(),
    updated_at: p.updated_at.toISOString(),
    hasLowStock: p.variants.some((v) => v.stock_total < 3),
    variants: p.variants.map((v) => ({
      ...v,
      price_usd: Number(v.price_usd),
      updated_at: v.updated_at.toISOString(),
    })),
  }));

  return { data, total, page, totalPages: Math.ceil(total / pageSize) };
}

async function getFilterOptions() {
  const [tipoRows, colorRows, tallaRows] = await Promise.all([
    prisma.product.findMany({
      where: { is_active: true, type: { not: "" } },
      select: { type: true },
      distinct: ["type"],
      orderBy: { type: "asc" },
    }),
    prisma.product.findMany({
      where: { is_active: true, color: { not: null } },
      select: { color: true },
      distinct: ["color"],
      orderBy: { color: "asc" },
    }),
    prisma.productVariant.findMany({
      where: { is_active: true },
      select: { size: true },
      distinct: ["size"],
      orderBy: { size: "asc" },
    }),
  ]);

  return {
    tipos:  tipoRows.map((r) => r.type).filter(Boolean) as string[],
    colors: colorRows.map((r) => r.color).filter(Boolean) as string[],
    tallas: tallaRows.map((r) => r.size),
  };
}

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const canEdit = session.role === "admin" || session.role === "inventario";
  const isVendor = session.role === "vendedora_online" || session.role === "vendedora_tienda";
  const channel = session.role === "vendedora_online" ? "online" : "tienda";

  const [{ data, total, page, totalPages }, filterOptions] = await Promise.all([
    getProducts(searchParams),
    getFilterOptions(),
  ]);

  // Fetch active carts for vendors (and admin) to populate the cart selector
  let activeCarts: CartJSON[] = [];
  if (isVendor || session.role === "admin") {
    const rawCarts = await prisma.cart.findMany({
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
    });

    activeCarts = rawCarts.map((cart) => {
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
        created_at: cart.created_at.toISOString(),
        updated_at: cart.updated_at.toISOString(),
        vendor: cart.vendor,
        items,
        total_usd: items.reduce((s, i) => s + i.unit_price_usd * i.quantity, 0),
        has_stock_issues: items.some((i) => i.stock_warning),
      };
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {total} producto{total !== 1 ? "s" : ""} en el catálogo
          </p>
        </div>
        {canEdit && (
          <Link href="/dashboard/productos/nuevo" className={cn(buttonVariants())}>
            <Plus size={16} />
            Nuevo producto
          </Link>
        )}
      </div>

      {/* Filters */}
      <ProductFilters {...filterOptions} />

      {/* Grid */}
      {data.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-gray-400">No se encontraron productos</p>
          {canEdit && (
            <Link
              href="/dashboard/productos/nuevo"
              className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
            >
              Crear el primero
            </Link>
          )}
        </div>
      ) : isVendor || session.role === "admin" ? (
        // Vendedoras y admin: catálogo con botón "+" para agregar al carrito
        <ProductCatalog
          products={data}
          channel={channel}
          initialCarts={activeCarts}
          isAdmin={session.role === "admin"}
        />
      ) : (
        // Inventario y embalaje: vista simple sin botón de carrito
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        noun="producto"
        prevHref={page > 1 ? `/dashboard/productos?page=${page - 1}` : null}
        nextHref={page < totalPages ? `/dashboard/productos?page=${page + 1}` : null}
      />
    </div>
  );
}
