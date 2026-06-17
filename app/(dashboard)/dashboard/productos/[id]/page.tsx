import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ProductDetailGallery } from "@/components/shared/productos/ProductDetailGallery";
import { VariantActions } from "@/components/shared/productos/VariantActions";
import { ColorSelector } from "@/components/shared/productos/ColorSelector";
import { SizeSelector } from "@/components/shared/productos/SizeSelector";
import { ChevronLeft, Pencil, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductJSON } from "@/types";

async function getProduct(id: string): Promise<ProductJSON | null> {
  const p = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: { orderBy: { size: "asc" } },
      creator: { select: { id: true, name: true } },
    },
  });
  if (!p) return null;
  return {
    ...p,
    created_at: p.created_at.toISOString(),
    updated_at: p.updated_at.toISOString(),
    variants: p.variants.map((v) => ({
      ...v,
      price_usd: Number(v.price_usd),
      updated_at: v.updated_at.toISOString(),
    })),
  };
}

async function getSiblings(name: string) {
  const siblings = await prisma.product.findMany({
    where: {
      name: { equals: name, mode: "insensitive" },
      is_active: true,
    },
    select: { id: true, color: true },
    orderBy: { color: "asc" },
  });
  return siblings;
}

export default async function ProductoDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [product, siblingsRaw] = await Promise.all([
    getProduct(params.id),
    // getSiblings needs product name — fetch product first then siblings below
    Promise.resolve(null),
  ]);

  if (!product) notFound();

  const siblings = await getSiblings(product.name);

  const canEdit = session.role === "admin" || session.role === "inventario";
  const activeVariants = product.variants.filter((v) => v.is_active);
  const price = activeVariants[0]?.price_usd;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/productos"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ChevronLeft size={15} />
          Productos
        </Link>
        {canEdit && (
          <Link
            href={`/dashboard/productos/${product.id}/editar`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Pencil size={14} className="mr-1.5" />
            Editar
          </Link>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        {/* Galería de fotos */}
        {product.photos.length > 0 ? (
          <ProductDetailGallery photos={product.photos} name={product.name} />
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-xl border bg-gray-100 text-gray-300">
            <ImageOff size={48} />
          </div>
        )}

        {/* Info */}
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge>{product.type}</Badge>
              {!product.is_active && (
                <Badge variant="destructive">Inactivo</Badge>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">{product.name}</h1>
            {price != null && (
              <p className="mt-1 text-2xl font-bold text-gray-800">${price.toFixed(2)}</p>
            )}
            {product.description && (
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">{product.description}</p>
            )}
          </div>

          <Separator />

          {/* Selector de color (productos hermanos) */}
          <ColorSelector currentId={product.id} siblings={siblings} />

          {/* Selector de talla + stock */}
          <SizeSelector
            variants={product.variants}
            productName={product.name}
            canEdit={canEdit}
          />

          <div className="text-xs text-gray-400">
            Creado por {product.creator.name} ·{" "}
            {new Date(product.created_at).toLocaleDateString("es-VE", {
              day: "2-digit", month: "long", year: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* Tabla completa de variantes — solo para admin/inventario */}
      {canEdit && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">
            Variantes por talla
          </h2>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Talla</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Online</TableHead>
                  <TableHead className="text-right">Tienda</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.variants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-gray-400">
                      Sin variantes registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  product.variants.map((v) => (
                    <TableRow key={v.id} className={!v.is_active ? "opacity-50" : ""}>
                      <TableCell>
                        <Badge variant="secondary">{v.size}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-400">{v.sku}</TableCell>
                      <TableCell className="text-right">{v.stock_online}</TableCell>
                      <TableCell className="text-right">{v.stock_store}</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-semibold ${v.stock_total < 3 ? "text-amber-600" : "text-gray-900"}`}>
                          {v.stock_total}
                        </span>
                      </TableCell>
                      <TableCell>
                        {v.is_active ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Activa</span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inactiva</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <VariantActions
                          variantId={v.id}
                          productName={product.name}
                          size={v.size}
                          currentOnline={v.stock_online}
                          currentStore={v.stock_store}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
