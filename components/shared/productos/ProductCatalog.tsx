"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ImageOff, AlertTriangle, LayoutGrid, Grid3X3, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddToCartButton } from "./AddToCartButton";
import type { ProductJSON, CartJSON } from "@/types";

type ViewMode = "grid" | "grid-sm" | "list";

type Props = {
  products: ProductJSON[];
  channel: "online" | "tienda";
  initialCarts: CartJSON[];
  isAdmin?: boolean;
};

export function ProductCatalog({ products, channel: defaultChannel, initialCarts, isAdmin = false }: Props) {
  const [channel, setChannel] = useState<"online" | "tienda">(defaultChannel);
  const [carts, setCarts] = useState<CartJSON[]>(initialCarts);
  const [view, setView] = useState<ViewMode>("grid");
  const [brokenPhotos, setBrokenPhotos] = useState<Set<string>>(new Set());

  function markPhotoBroken(id: string) {
    setBrokenPhotos((prev) => new Set(prev).add(id));
  }

  function handleCartUpdate(updated: CartJSON) {
    setCarts((prev) =>
      prev.some((c) => c.id === updated.id)
        ? prev.map((c) => (c.id === updated.id ? updated : c))
        : [updated, ...prev]
    );
  }

  function handleCartCreated(newCart: CartJSON) {
    setCarts((prev) => [newCart, ...prev]);
  }

  return (
    <div className="space-y-4">
      {/* Top bar: channel selector (admin only) + view toggle */}
      <div className="flex items-center justify-between gap-4">
        {isAdmin ? (
          <div className="flex overflow-hidden rounded-lg border bg-white shadow-sm">
            {(["tienda", "online"] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannel(ch)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium capitalize transition-colors first:border-r",
                  channel === ch
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:text-gray-800"
                )}
              >
                {ch}
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}

        {/* View toggle */}
        <div className="flex overflow-hidden rounded-lg border bg-white shadow-sm">
          <button
            onClick={() => setView("grid")}
            title="Grid normal"
            className={`p-2 transition-colors ${
              view === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setView("grid-sm")}
            title="Grid compacto"
            className={`hidden sm:block border-l p-2 transition-colors ${
              view === "grid-sm" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Grid3X3 size={16} />
          </button>
          <button
            onClick={() => setView("list")}
            title="Lista"
            className={`border-l p-2 transition-colors ${
              view === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <LayoutList size={16} />
          </button>
        </div>
      </div>

      {/* Grid views */}
      {view !== "list" && (
        <div
          className={
            view === "grid"
              ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              : "grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7"
          }
        >
          {products.map((product) => {
            const photo = product.photos[0];
            const activeVariants = product.variants.filter((v) => v.is_active);
            const price = activeVariants[0]?.price_bcv;
            const totalStock = activeVariants.reduce((s, v) => s + v.stock_total, 0);
            const outOfStock = totalStock === 0;

            return (
              <div
                key={product.id}
                className="relative group rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {!outOfStock && (
                  <AddToCartButton
                    product={product}
                    channel={channel}
                    carts={carts}
                    onCartUpdate={handleCartUpdate}
                    onCartCreated={handleCartCreated}
                  />
                )}
                <Link href={`/dashboard/productos/${product.id}`} className="block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-gray-100">
                    {photo && !brokenPhotos.has(product.id) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={() => markPhotoBroken(product.id)}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-300">
                        <ImageOff size={40} />
                      </div>
                    )}
                    {outOfStock && (
                      <span className="absolute left-2 top-2 rounded-full bg-gray-800/80 px-2 py-0.5 text-[11px] font-medium text-white">
                        Agotado
                      </span>
                    )}
                    {!outOfStock && product.hasLowStock && (
                      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[11px] font-medium text-white">
                        <AlertTriangle size={10} />
                        Stock bajo
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold text-gray-900">{product.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[11px]">{product.type}</Badge>
                      {product.color && (
                        <Badge variant="outline" className="text-[11px]">{product.color}</Badge>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      {price != null ? (
                        <span className="text-sm font-bold text-gray-900">${price.toFixed(2)}</span>
                      ) : (
                        <span className="text-xs text-gray-400">Sin precio</span>
                      )}
                      <span className="text-xs text-gray-400">
                        {activeVariants.length} talla{activeVariants.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="flex flex-col gap-2">
          {products.map((product) => {
            const photo = product.photos[0];
            const activeVariants = product.variants.filter((v) => v.is_active);
            const price = activeVariants[0]?.price_bcv;
            const totalStock = activeVariants.reduce((s, v) => s + v.stock_total, 0);
            const outOfStock = totalStock === 0;

            return (
              <div
                key={product.id}
                className="flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Thumbnail */}
                <Link href={`/dashboard/productos/${product.id}`} className="shrink-0">
                  <div className="h-14 w-14 overflow-hidden rounded-lg bg-gray-100">
                    {photo && !brokenPhotos.has(product.id) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={product.name} className="h-full w-full object-cover"
                        onError={() => markPhotoBroken(product.id)} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-300">
                        <ImageOff size={20} />
                      </div>
                    )}
                  </div>
                </Link>

                {/* Info */}
                <Link href={`/dashboard/productos/${product.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{product.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[11px]">{product.type}</Badge>
                    {product.color && (
                      <Badge variant="outline" className="text-[11px]">{product.color}</Badge>
                    )}
                    {outOfStock && (
                      <Badge variant="destructive" className="text-[11px]">Agotado</Badge>
                    )}
                    {!outOfStock && product.hasLowStock && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[11px] font-medium text-white">
                        <AlertTriangle size={10} />
                        Stock bajo
                      </span>
                    )}
                  </div>
                </Link>

                {/* Price + variants — oculto en móvil muy pequeño */}
                <div className="hidden sm:flex shrink-0 flex-col items-end gap-0.5">
                  {price != null ? (
                    <span className="text-sm font-bold text-gray-900">${price.toFixed(2)}</span>
                  ) : (
                    <span className="text-xs text-gray-400">Sin precio</span>
                  )}
                  <span className="text-xs text-gray-400">
                    {activeVariants.length} talla{activeVariants.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Add to cart */}
                {!outOfStock && (
                  <AddToCartButton
                    product={product}
                    channel={channel}
                    carts={carts}
                    onCartUpdate={handleCartUpdate}
                    onCartCreated={handleCartCreated}
                    iconOnly
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
