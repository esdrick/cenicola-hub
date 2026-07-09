"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus, Minus, Loader2, Search, ShoppingCart, AlertCircle, AlertTriangle, X, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductJSON } from "@/types";
import type { OrderStatus } from "@/app/generated/prisma/client";

type Props = {
  orderId: string;
  orderNumber: string;
  channel: "online" | "tienda";
  status: OrderStatus;
};

type DraftLine = { productName: string; size: string; sku: string; quantity: number; stockAvailable: number };

export function AgregarProductosDialog({ orderId, orderNumber, channel, status }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductJSON[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [variantQty, setVariantQty] = useState<Record<string, number>>({});
  const [draftLines, setDraftLines] = useState<Record<string, DraftLine>>({});

  const isReopen = status === "pago_verificado" || status === "en_embalaje";

  const loadProducts = useCallback(async (q: string, p: number) => {
    setLoadingProducts(true);
    try {
      const url = `/api/products?page=${p}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`;
      const r = await fetch(url);
      const j = await r.json();
      setProducts(j.data ?? []);
      setTotalPages(j.totalPages ?? 1);
    } catch { /* silent */ }
    finally { setLoadingProducts(false); }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const delay = searchQ ? 300 : 0;
    searchTimer.current = setTimeout(() => loadProducts(searchQ, page), delay);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [open, searchQ, page, loadProducts]);

  function channelStock(v: ProductJSON["variants"][0]) {
    return channel === "online" ? v.stock_online : v.stock_store;
  }

  function handleOpen() {
    setError(null);
    setDraftLines({});
    setVariantQty({});
    setExpandedId(null);
    setSearchQ("");
    setPage(1);
    setOpen(true);
  }

  function addDraftLine(product: ProductJSON, variant: ProductJSON["variants"][0], stock: number) {
    const qty = Math.max(1, Math.min(stock, variantQty[variant.id] ?? 1));
    setDraftLines((p) => ({
      ...p,
      [variant.id]: { productName: product.name, size: variant.size, sku: variant.sku, quantity: qty, stockAvailable: stock },
    }));
  }

  function removeDraftLine(variantId: string) {
    setDraftLines((p) => { const next = { ...p }; delete next[variantId]; return next; });
  }

  const draftEntries = Object.entries(draftLines);
  const draftCount = draftEntries.reduce((s, [, l]) => s + l.quantity, 0);

  function handleSubmit() {
    setError(null);
    if (draftEntries.length === 0) { setError("Agrega al menos un producto"); return; }

    start(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/agregar-productos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: draftEntries.map(([variant_id, l]) => ({ variant_id, quantity: l.quantity })),
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Error al agregar productos");
          return;
        }
        setOpen(false);
        router.refresh();
      } catch {
        setError("Error de conexión");
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={handleOpen}>
        <Plus size={13} className="mr-1.5" />
        Agregar producto
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar productos</DialogTitle>
            <DialogDescription>
              Orden <span className="font-mono font-medium">{orderNumber}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isReopen && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle size={14} className="text-orange-600" />
                <AlertDescription className="text-orange-800">
                  Esta orden ya fue verificada{status === "en_embalaje" ? " y está en proceso de embalaje" : ""}.
                  Agregar un producto la <strong>reabrirá</strong> y saldrá de la cola de embalaje. El precio de
                  todos los productos se recalcula según la nueva cantidad total. Si lo ya pagado no cubre el
                  nuevo total, quedará en <strong>Pago parcial</strong> pendiente de un nuevo pago verificado;
                  si lo cubre, quedará lista para confirmar el envío a embalaje nuevamente.
                </AlertDescription>
              </Alert>
            )}

            {/* Staged lines */}
            {draftEntries.length > 0 && (
              <div className="rounded-lg border bg-gray-50 divide-y">
                {draftEntries.map(([variantId, l]) => (
                  <div key={variantId} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{l.productName}</p>
                      <p className="text-xs text-gray-400">Talla {l.size} · {l.sku}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">×{l.quantity}</span>
                    <button
                      type="button"
                      onClick={() => removeDraftLine(variantId)}
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <Input
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setPage(1); }}
                placeholder="Buscar producto…"
                className="pl-9"
              />
              {searchQ && (
                <button
                  type="button"
                  onClick={() => { setSearchQ(""); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Catalog */}
            <div className="rounded-xl border bg-white divide-y overflow-hidden">
              {loadingProducts ? (
                <div className="flex items-center justify-center py-10 text-gray-400">
                  <Loader2 size={18} className="animate-spin mr-2" />
                  Cargando catálogo…
                </div>
              ) : products.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">
                  {searchQ ? `Sin resultados para "${searchQ}"` : "No hay productos disponibles"}
                </p>
              ) : (
                products.map((product) => {
                  const isOpenExpanded = expandedId === product.id;
                  const availableVariants = product.variants.filter((v) => channelStock(v) > 0 && v.is_active);
                  const stagedCount = product.variants.filter((v) => draftLines[v.id]).length;

                  return (
                    <div key={product.id}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="flex-shrink-0">
                          {product.photos[0] ? (
                            <Image
                              src={product.photos[0]}
                              alt={product.name}
                              width={40} height={40}
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                              <ShoppingCart size={14} className="text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                          <p className="text-xs text-gray-400">
                            {availableVariants.length} talla{availableVariants.length !== 1 ? "s" : ""} disponible{availableVariants.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {stagedCount > 0 && (
                          <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            {stagedCount} agregada{stagedCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedId((prev) => (prev === product.id ? null : product.id))}
                          disabled={availableVariants.length === 0}
                          className={cn(
                            "flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                            availableVariants.length === 0
                              ? "border-gray-200 text-gray-300 cursor-not-allowed"
                              : isOpenExpanded
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-300 text-gray-600 hover:border-gray-900 hover:bg-gray-900 hover:text-white"
                          )}
                        >
                          {isOpenExpanded ? <X size={14} /> : <Plus size={14} />}
                        </button>
                      </div>

                      {isOpenExpanded && (
                        <div className="bg-gray-50 border-t px-3 py-2.5 space-y-2">
                          {availableVariants.length === 0 ? (
                            <p className="text-xs text-gray-400 py-1">Sin stock en {channel}</p>
                          ) : (
                            availableVariants.map((v) => {
                              const stock = channelStock(v);
                              const qty = variantQty[v.id] ?? draftLines[v.id]?.quantity ?? 1;
                              const staged = !!draftLines[v.id];

                              return (
                                <div key={v.id} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
                                  <span className="min-w-10 shrink-0 text-sm font-semibold text-gray-800">{v.size}</span>
                                  <span className="text-xs text-gray-500 flex-1">{stock} disp.</span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setVariantQty((p) => ({ ...p, [v.id]: Math.max(1, (p[v.id] ?? qty) - 1) }))}
                                      className="h-7 w-7 rounded border flex items-center justify-center hover:bg-gray-50"
                                    >
                                      <Minus size={12} />
                                    </button>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={stock}
                                      value={qty}
                                      onChange={(e) =>
                                        setVariantQty((p) => ({
                                          ...p,
                                          [v.id]: Math.max(1, Math.min(stock, parseInt(e.target.value) || 1)),
                                        }))
                                      }
                                      className="h-7 w-12 text-center text-sm px-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setVariantQty((p) => ({ ...p, [v.id]: Math.min(stock, (p[v.id] ?? qty) + 1) }))}
                                      className="h-7 w-7 rounded border flex items-center justify-center hover:bg-gray-50"
                                    >
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                  <Button size="sm" onClick={() => addDraftLine(product, v, stock)}>
                                    {staged ? "Actualizar" : "Agregar"}
                                  </Button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <span className="text-sm text-gray-500">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Siguiente
                </Button>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle size={14} />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs text-gray-400">
                {draftCount > 0 ? `${draftCount} unidad${draftCount !== 1 ? "es" : ""} por agregar` : ""}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={isPending || draftEntries.length === 0}>
                  {isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : <Plus size={14} className="mr-2" />}
                  {isReopen ? "Reabrir y agregar" : "Agregar productos"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
