import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ImageOff } from "lucide-react";
import type { ProductJSON } from "@/types";

type Props = { product: ProductJSON };

export function ProductCard({ product }: Props) {
  const photo = product.photos[0];
  const activeVariants = product.variants.filter((v) => v.is_active);
  const price = activeVariants[0]?.price_usd;
  const totalStock = activeVariants.reduce((s, v) => s + v.stock_total, 0);
  const outOfStock = totalStock === 0;

  return (
    <Link
      href={`/dashboard/productos/${product.id}`}
      className={`group block rounded-xl border shadow-sm transition-shadow hover:shadow-md ${
        outOfStock
          ? "border-red-300 bg-red-50"
          : product.hasLowStock
          ? "border-amber-300 bg-amber-50"
          : "border-gray-200 bg-white"
      }`}
    >
      {/* Foto */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-gray-100">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <ImageOff size={40} />
          </div>
        )}

        {/* Badges de stock */}
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

      {/* Info */}
      <div className="p-3">
        <p className="truncate text-sm font-semibold text-gray-900">{product.name}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-[11px]">
            {product.type}
          </Badge>
          {product.color && (
            <Badge variant="outline" className="text-[11px]">
              {product.color}
            </Badge>
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
  );
}
