"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StockAdjustDialog } from "@/components/shared/productos/StockAdjustDialog";
import { useRouter } from "next/navigation";
import type { ProductVariantJSON } from "@/types";

type Props = {
  variants: ProductVariantJSON[];
  productName: string;
  canEdit: boolean;
  // When set, the viewer is restricted to one sales channel (vendedora_online /
  // vendedora_tienda) and must not see the other channel's stock number.
  viewerChannel?: "online" | "tienda";
};

export function SizeSelector({ variants, productName, canEdit, viewerChannel }: Props) {
  const router = useRouter();
  const active = variants.filter((v) => v.is_active);
  const [selectedId, setSelectedId] = useState<string>(active[0]?.id ?? "");
  const [adjustOpen, setAdjustOpen] = useState(false);

  const selected = active.find((v) => v.id === selectedId) ?? active[0];

  if (active.length === 0) return null;

  const channelStock = selected
    ? viewerChannel === "online"
      ? selected.stock_online
      : selected.stock_store
    : 0;
  const noStockForViewer = viewerChannel ? channelStock === 0 : selected?.stock_total === 0;

  return (
    <div className="space-y-4">
      {/* Size pills */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Talla
        </p>
        <div className="flex flex-wrap gap-2">
          {active.map((v) => {
            const isSel = v.id === selectedId;
            const noStock = viewerChannel
              ? (viewerChannel === "online" ? v.stock_online : v.stock_store) === 0
              : v.stock_total === 0;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={cn(
                  "rounded-md border px-3 py-1 text-sm font-medium transition-colors",
                  isSel
                    ? "border-gray-900 bg-gray-900 text-white"
                    : noStock
                    ? "border-gray-200 bg-gray-50 text-gray-400 line-through"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                )}
              >
                {v.size}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stock del tamaño seleccionado */}
      {selected && (
        <div className="rounded-xl border bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Stock — talla <span className="font-bold">{selected.size}</span>
            </p>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setAdjustOpen(true)}
              >
                <SlidersHorizontal size={13} className="mr-1" />
                Ajustar
              </Button>
            )}
          </div>

          {viewerChannel ? (
            <div className="mt-3 text-center">
              <p className="text-xs text-gray-400 capitalize">{viewerChannel}</p>
              <p className={cn(
                "text-lg font-bold",
                channelStock === 0 ? "text-rose-500" : channelStock < 3 ? "text-amber-600" : "text-gray-900"
              )}>
                {channelStock}
              </p>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-400">Online</p>
                <p className={cn(
                  "text-lg font-bold",
                  selected.stock_online === 0 ? "text-rose-500" : selected.stock_online < 3 ? "text-amber-600" : "text-gray-900"
                )}>
                  {selected.stock_online}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Tienda</p>
                <p className={cn(
                  "text-lg font-bold",
                  selected.stock_store === 0 ? "text-rose-500" : selected.stock_store < 3 ? "text-amber-600" : "text-gray-900"
                )}>
                  {selected.stock_store}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total</p>
                <p className={cn(
                  "text-lg font-bold",
                  selected.stock_total === 0 ? "text-rose-500" : selected.stock_total < 3 ? "text-amber-600" : "text-gray-900"
                )}>
                  {selected.stock_total}
                </p>
              </div>
            </div>
          )}

          {noStockForViewer && (
            <p className="mt-2 text-center text-xs text-rose-500 font-medium">
              Agotado en esta talla
            </p>
          )}
        </div>
      )}

      {selected && canEdit && (
        <StockAdjustDialog
          open={adjustOpen}
          onClose={() => setAdjustOpen(false)}
          onSuccess={() => router.refresh()}
          variantId={selected.id}
          productName={productName}
          size={selected.size}
          currentOnline={selected.stock_online}
          currentStore={selected.stock_store}
        />
      )}
    </div>
  );
}
