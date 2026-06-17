import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { ProductCard } from "@/components/shared/productos/ProductCard";
import { ProductFilters } from "@/components/shared/productos/ProductFilters";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductJSON } from "@/types";

type SearchParams = { [key: string]: string | string[] | undefined };

function sp(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

async function getProducts(params: SearchParams) {
  const q = sp(params.q);
  const tipo = sp(params.tipo);
  const color = sp(params.color);
  const page = Math.max(1, parseInt(sp(params.page) || "1"));
  const pageSize = 24;

  const where = {
    is_active: true,
    ...(q && { name: { contains: q, mode: "insensitive" as const } }),
    ...(tipo && { type: { contains: tipo, mode: "insensitive" as const } }),
    ...(color && { color: { contains: color, mode: "insensitive" as const } }),
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

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const canEdit = session.role === "admin" || session.role === "inventario";
  const { data, total, page, totalPages } = await getProducts(searchParams);

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
            <Plus size={16} className="mr-2" />
            Nuevo producto
          </Link>
        )}
      </div>

      {/* Filters */}
      <ProductFilters />

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
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2 text-sm">
          {page > 1 && (
            <Link
              href={`/dashboard/productos?page=${page - 1}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Anterior
            </Link>
          )}
          <span className="text-gray-500">Página {page} de {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`/dashboard/productos?page=${page + 1}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Siguiente
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
