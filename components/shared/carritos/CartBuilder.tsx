"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle, Loader2, Search, ShoppingCart, Trash2,
  Plus, Minus, ChevronRight, Save, AlertTriangle, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CartJSON, ProductJSON } from "@/types";

type Props = {
  cart: CartJSON | null;
  defaultChannel?: "online" | "tienda";
  isAdmin?: boolean;
  quickSale?: boolean;
};

export function CartBuilder({ cart: initialCart, defaultChannel = "online", isAdmin = false, quickSale = false }: Props) {
  const router = useRouter();

  // Lazy cart: cartId is null until first product is added or note is saved
  const [cartId, setCartId] = useState<string | null>(initialCart?.id ?? null);
  const [cart, setCart] = useState<CartJSON | null>(initialCart);
  const [channel, setChannel] = useState<"online" | "tienda">(
    initialCart?.channel ?? defaultChannel
  );
  const [note, setNote] = useState(initialCart?.note ?? "");
  const [savingNote, setSavingNote] = useState(false);

  // Catalog state
  const [products, setProducts] = useState<ProductJSON[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Expanded product (for variant selector)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [variantQty, setVariantQty] = useState<Record<string, number>>({});

  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cartItems = cart?.items ?? [];
  const cartTotal = cart?.total_usd ?? 0;
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  // ─── Load catalog ─────────────────────────────────────────────────────────
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

  // Venta rápida: solo los productos marcados quick_sale, sin búsqueda ni paginación
  useEffect(() => {
    if (!quickSale) return;
    setLoadingProducts(true);
    fetch("/api/products?quick_sale=true")
      .then((r) => r.json())
      .then((j) => setProducts(j.data ?? []))
      .catch(() => { /* silent */ })
      .finally(() => setLoadingProducts(false));
  }, [quickSale]);

  // Single effect: immediate load on page change, debounced on search change
  useEffect(() => {
    if (quickSale) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const delay = searchQ ? 300 : 0;
    searchTimer.current = setTimeout(() => loadProducts(searchQ, page), delay);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQ, page, loadProducts, quickSale]);

  function channelStock(v: ProductJSON["variants"][0]) {
    return channel === "online" ? v.stock_online : v.stock_store;
  }

  // ─── Toggle product expander ───────────────────────────────────────────────
  function toggleExpand(productId: string) {
    setExpandedId((prev) => (prev === productId ? null : productId));
  }

  // ─── Lazy cart creation ────────────────────────────────────────────────────
  async function ensureCart(): Promise<string | null> {
    if (cartId) return cartId;
    try {
      const r = await fetch("/api/carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, note: note.trim() || undefined }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Error al crear la orden"); return null; }
      setCartId(j.id);
      setCart(j);
      window.history.replaceState(null, "", `/dashboard/carritos/${j.id}`);
      return j.id;
    } catch {
      setError("Error de conexión");
      return null;
    }
  }

  // Cart was empty and untitled — backend removed it rather than keep an orphan.
  // Returns true if this response represented a deletion (caller should stop).
  function handleDeletedCart(j: { deleted?: boolean }): boolean {
    if (!j.deleted) return false;
    setCartId(null);
    setCart(null);
    if (initialCart) {
      router.push("/dashboard/ordenes");
    } else {
      window.history.replaceState(null, "", "/dashboard/ordenes/nueva");
    }
    return true;
  }

  // ─── Update item in cart ───────────────────────────────────────────────────
  async function updateItem(variant_id: string, quantity: number) {
    setUpdating(variant_id);
    setError(null);
    try {
      const id = await ensureCart();
      if (!id) return;
      const r = await fetch(`/api/carts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: { variant_id, quantity } }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Error al actualizar"); return; }
      if (handleDeletedCart(j)) return;
      setCart(j);
    } catch { setError("Error de conexión"); }
    finally { setUpdating(null); }
  }

  function addVariant(variantId: string, maxQty: number) {
    const existing = cartItems.find((i) => i.variant_id === variantId);
    const draft = variantQty[variantId] ?? existing?.quantity ?? 1;
    const newQty = Math.min(draft, maxQty);
    updateItem(variantId, newQty);
    setVariantQty((p) => { const next = { ...p }; delete next[variantId]; return next; });
  }

  // ─── Save note ─────────────────────────────────────────────────────────────
  async function saveNote() {
    // If no cart yet and note is empty, there's nothing to persist
    if (!cartId && !note.trim()) return;
    setSavingNote(true);
    setError(null);
    try {
      const id = await ensureCart();
      if (!id) return;
      const r = await fetch(`/api/carts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Error"); return; }
      if (handleDeletedCart(j)) return;
      setCart(j);
    } catch { setError("Error de conexión"); }
    finally { setSavingNote(false); }
  }

  // ─── Cancel / delete cart ──────────────────────────────────────────────────
  async function cancelOrder() {
    if (!cartId) {
      router.refresh();
      router.push("/dashboard/ordenes");
      return;
    }
    if (!confirm("¿Cancelar esta orden? Los productos no se reservarán.")) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/carts/${cartId}`, { method: "DELETE" });
      if (!r.ok) { setError("Error al eliminar"); setDeleting(false); return; }
      router.refresh();
      router.push("/dashboard/ordenes");
    } catch { setError("Error de conexión"); setDeleting(false); }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_400px]">

      {/* ── LEFT: Catalog ── */}
      <div className="space-y-4">
        {/* Note + info */}
        {!quickSale && (
        <div className="rounded-xl border bg-white p-4 space-y-3">
          {/* Channel selector for admin before cart is created */}
          {isAdmin && !cartId ? (
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-500">Canal</Label>
              <div className="flex gap-2">
                {(["tienda", "online"] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setChannel(ch)}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-sm font-medium capitalize transition-colors",
                      channel === ch
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 text-gray-600 hover:border-gray-400"
                    )}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 capitalize">
              Canal: <span className="font-medium">{channel}</span>
            </p>
          )}

          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-sm text-gray-500">Nota de la orden (opcional)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej: Pedido Ana García, ropa verano…"
              />
            </div>
            <Button
              variant="outline" size="sm"
              disabled={savingNote || (note === (cart?.note ?? "") && !!cartId) || (!cartId && !note.trim())}
              onClick={saveNote}
            >
              {savingNote ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar
            </Button>
          </div>
        </div>
        )}

        {quickSale && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {loadingProducts ? (
              <div className="col-span-full flex items-center justify-center py-12 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                Cargando productos…
              </div>
            ) : products.length === 0 ? (
              <p className="col-span-full py-12 text-center text-sm text-gray-400">
                No hay productos configurados para venta rápida. Contacta a un administrador.
              </p>
            ) : (
              products.map((product) => {
                const variant = product.variants.find((v) => v.is_active);
                if (!variant) return null;
                const stock = channelStock(variant);
                const inCartItem = cartItems.find((i) => i.variant_id === variant.id);
                const qty = inCartItem?.quantity ?? 0;
                const isUpdating = updating === variant.id;

                return (
                  <div key={product.id} className="flex items-center gap-4 rounded-xl border bg-white p-4 sm:flex-col sm:items-center sm:gap-3 sm:text-center">
                    {product.photos[0] ? (
                      <Image
                        src={product.photos[0]}
                        alt={product.name}
                        width={64} height={64}
                        className="size-16 flex-shrink-0 rounded-lg object-cover sm:size-24"
                      />
                    ) : (
                      <div className="size-16 flex-shrink-0 rounded-lg bg-gray-100 flex items-center justify-center sm:size-24">
                        <ShoppingCart size={24} className="text-gray-300" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 sm:flex-none sm:w-full">
                      <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-400">${variant.price_bcv.toFixed(2)} · {stock} disp.</p>
                      {stock === 0 && qty === 0 && (
                        <p className="mt-1 text-sm text-orange-600">Sin stock</p>
                      )}
                    </div>

                    {!(stock === 0 && qty === 0) && (
                      <div className="flex flex-shrink-0 items-center gap-3 sm:justify-center">
                        <button
                          type="button"
                          onClick={() => updateItem(variant.id, Math.max(0, qty - 1))}
                          disabled={isUpdating || qty === 0}
                          className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
                        >
                          <Minus size={16} />
                        </button>
                        {isUpdating ? (
                          <Loader2 size={16} className="animate-spin w-8 text-center" />
                        ) : (
                          <span className="w-8 text-center text-base font-semibold">{qty}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => updateItem(variant.id, Math.min(stock, qty + 1))}
                          disabled={isUpdating || qty >= stock}
                          className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Search */}
        {!quickSale && (
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
        )}

        {/* Product list */}
        {!quickSale && (
        <div className="rounded-xl border bg-white divide-y overflow-hidden">
          {loadingProducts ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" />
              Cargando catálogo…
            </div>
          ) : products.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              {searchQ ? `Sin resultados para "${searchQ}"` : "No hay productos disponibles"}
            </p>
          ) : (
            products.map((product) => {
              const isOpen = expandedId === product.id;
              const availableVariants = product.variants.filter((v) => channelStock(v) > 0 && v.is_active);
              const inCartCount = cartItems
                .filter((i) => product.variants.some((v) => v.id === i.variant_id))
                .reduce((s, i) => s + i.quantity, 0);

              return (
                <div key={product.id}>
                  {/* Product row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-shrink-0">
                      {product.photos[0] ? (
                        <Image
                          src={product.photos[0]}
                          alt={product.name}
                          width={48} height={48}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                          <ShoppingCart size={16} className="text-gray-300" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-400">
                        {[product.color, product.type].filter(Boolean).join(" · ")}
                        {" · "}
                        {availableVariants.length} talla{availableVariants.length !== 1 ? "s" : ""}
                        {availableVariants.length > 0 && (
                          <span className="ml-1">
                            · desde ${Math.min(...availableVariants.map((v) => v.price_bcv)).toFixed(2)}
                          </span>
                        )}
                      </p>
                    </div>

                    {inCartCount > 0 && (
                      <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {inCartCount} agregado{inCartCount !== 1 ? "s" : ""}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleExpand(product.id)}
                      disabled={availableVariants.length === 0}
                      className={cn(
                        "flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                        availableVariants.length === 0
                          ? "border-gray-200 text-gray-300 cursor-not-allowed"
                          : isOpen
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-300 text-gray-600 hover:border-gray-900 hover:bg-gray-900 hover:text-white"
                      )}
                      title={availableVariants.length === 0 ? "Sin stock" : isOpen ? "Cerrar" : "Agregar a la orden"}
                    >
                      {isOpen ? <X size={14} /> : <Plus size={14} />}
                    </button>
                  </div>

                  {/* Variant expander */}
                  {isOpen && (
                    <div className="bg-gray-50 border-t px-4 py-3 space-y-2">
                      {availableVariants.length === 0 ? (
                        <p className="text-xs text-gray-400 py-1">Sin stock en {channel}</p>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-gray-500 mb-2">Seleccionar talla y cantidad</p>
                          {availableVariants.map((v) => {
                            const stock = channelStock(v);
                            const inCartItem = cartItems.find((i) => i.variant_id === v.id);
                            const qty = variantQty[v.id] ?? inCartItem?.quantity ?? 1;
                            const isUpdating = updating === v.id;

                            return (
                              <div key={v.id} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
                                <span className="min-w-10 shrink-0 whitespace-nowrap text-sm font-semibold text-gray-800">{v.size}</span>

                                <span className="text-sm text-gray-500 flex-1">
                                  ${v.price_bcv.toFixed(2)} · {stock} disp.
                                </span>

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

                                <Button
                                  size="sm"
                                  disabled={isUpdating}
                                  onClick={() => addVariant(v.id, stock)}
                                >
                                  {isUpdating ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : inCartItem ? (
                                    "Actualizar"
                                  ) : (
                                    "Agregar"
                                  )}
                                </Button>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        )}

        {/* Pagination */}
        {!quickSale && totalPages > 1 && (
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
      </div>

      {/* ── RIGHT: Order panel ── */}
      <div className="space-y-4">
        <div className="sticky top-4 space-y-4">
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-700">
                <ShoppingCart size={16} />
                Productos seleccionados
                {cartCount > 0 && (
                  <span className="rounded-full bg-gray-900 px-1.5 py-0.5 text-xs text-white">
                    {cartCount}
                  </span>
                )}
              </h2>
              {cartCount > 0 && (
                <span className="text-sm font-semibold">${cartTotal.toFixed(2)} USD</span>
              )}
            </div>

            {cart?.has_stock_issues && (
              <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2.5">
                <AlertTriangle size={15} className="text-orange-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-orange-700">
                  Algunos productos ya no tienen stock suficiente.
                </p>
              </div>
            )}

            {cartItems.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">
                Usa el <strong>+</strong> en un producto para agregar aquí
              </p>
            ) : (
              <div className="divide-y -mx-1">
                {cartItems.map((item) => (
                  <div
                    key={item.variant_id}
                    className={cn(
                      "flex items-center gap-2 py-2.5 px-1 rounded",
                      item.stock_warning && "bg-orange-50"
                    )}
                  >
                    {item.variant.product.photos[0] && (
                      <Image
                        src={item.variant.product.photos[0]}
                        alt={item.variant.product.name}
                        width={40} height={40}
                        className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.variant.product.name}</p>
                      <p className="text-sm text-gray-400">
                        {item.variant.size}
                        {item.stock_warning && (
                          <span className="ml-1 text-orange-500">
                            · solo {item.stock_available} disp.
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateItem(item.variant_id, Math.max(1, item.quantity - 1))}
                        disabled={!!updating}
                        className="h-6 w-6 rounded flex items-center justify-center hover:bg-gray-100 disabled:opacity-40"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateItem(item.variant_id, Math.min(item.stock_available, item.quantity + 1))}
                        disabled={!!updating || item.quantity >= item.stock_available}
                        className="h-6 w-6 rounded flex items-center justify-center hover:bg-gray-100 disabled:opacity-40"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <span className="text-sm font-semibold w-16 text-right">
                      ${(item.unit_price_usd * item.quantity).toFixed(2)}
                    </span>
                    {updating === item.variant_id ? (
                      <Loader2 size={14} className="animate-spin text-gray-400 flex-shrink-0" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateItem(item.variant_id, 0)}
                        className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle size={14} />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {cartId && cartItems.length > 0 && (
            <>
              {cart?.has_stock_issues && (
                <p className="text-sm text-center text-orange-600">
                  Corrige el stock antes de continuar
                </p>
              )}
              <Button
                className="w-full"
                disabled={!!cart?.has_stock_issues}
                onClick={() => router.push(`/dashboard/carritos/${cartId}/completar`)}
              >
                Completar orden
                <ChevronRight size={14} className="ml-1" />
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={cancelOrder}
            disabled={deleting}
            className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            {deleting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Trash2 size={14} className="mr-1.5" />}
            Cancelar orden
          </Button>
        </div>
      </div>
    </div>
  );
}
