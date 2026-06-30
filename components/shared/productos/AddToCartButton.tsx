"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, Minus, ShoppingCart, Loader2, ImageOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ProductJSON, CartJSON } from "@/types";

type Props = {
  product: ProductJSON;
  channel: "online" | "tienda";
  initialCarts?: CartJSON[];
  carts?: CartJSON[];
  onCartUpdate?: (cart: CartJSON) => void;
  onCartCreated?: (cart: CartJSON) => void;
  inline?: boolean;
  iconOnly?: boolean;
};

export function AddToCartButton({
  product,
  channel,
  initialCarts,
  carts: externalCarts,
  onCartUpdate,
  onCartCreated,
  inline = false,
  iconOnly = false,
}: Props) {
  const [internalCarts, setInternalCarts] = useState<CartJSON[]>(initialCarts ?? []);
  const carts = externalCarts ?? internalCarts;

  function handleCartUpdate(cart: CartJSON) {
    if (onCartUpdate) onCartUpdate(cart);
    else setInternalCarts((prev) => prev.map((c) => (c.id === cart.id ? cart : c)));
  }
  function handleCartCreated(cart: CartJSON) {
    if (onCartCreated) onCartCreated(cart);
    else setInternalCarts((prev) => [cart, ...prev]);
  }

  const [open, setOpen] = useState(false);
  const [selectedCartId, setSelectedCartId] = useState<string | "new">(
    carts[0]?.id ?? "new"
  );
  const [newCartNote, setNewCartNote] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const variants = product.variants.filter((v) => {
    const stock = channel === "online" ? v.stock_online : v.stock_store;
    return v.is_active && stock > 0;
  });

  if (variants.length === 0) return null;

  function getStock(variantId: string) {
    const v = product.variants.find((x) => x.id === variantId);
    if (!v) return 0;
    return channel === "online" ? v.stock_online : v.stock_store;
  }

  function getQty(variantId: string) {
    return qty[variantId] ?? 1;
  }

  async function addToCart(variantId: string) {
    setAdding(variantId);
    setError(null);
    try {
      let cartId = selectedCartId;

      // Create a new cart if needed
      if (cartId === "new") {
        const r = await fetch("/api/carts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel, note: newCartNote.trim() || undefined }),
        });
        const j = await r.json();
        if (!r.ok) { setError(j.error ?? "Error al crear orden"); return; }
        cartId = j.id;
        handleCartCreated(j);
        setSelectedCartId(cartId);
      }

      // Add item
      const quantity = getQty(variantId);
      const r = await fetch(`/api/carts/${cartId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: { variant_id: variantId, quantity } }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Error al agregar"); return; }
      handleCartUpdate(j);

      // Flash success
      setAdded(variantId);
      setTimeout(() => setAdded(null), 1500);
      setQty((p) => ({ ...p, [variantId]: 1 }));
    } catch {
      setError("Error de conexión");
    } finally {
      setAdding(null);
    }
  }

  const photo = product.photos[0];

  return (
    <>
      {iconOnly ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:border-gray-900 hover:bg-gray-900 hover:text-white"
          title="Agregar a la orden"
        >
          <Plus size={14} />
        </button>
      ) : inline ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-gray-300 pl-3 pr-2 py-1 text-sm text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors"
        >
          Agregar a orden
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 group-hover:bg-white/20">
            <Plus size={12} />
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm border border-gray-200 text-gray-700 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors"
          title="Agregar a la orden"
        >
          <Plus size={14} />
        </button>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setNewCartNote(""); }}>

      <DialogContent className="max-w-md">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0">
            {photo ? (
              <Image
                src={photo}
                alt={product.name}
                width={64} height={64}
                className="h-16 w-16 rounded-lg object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-gray-100 flex items-center justify-center">
                <ImageOff size={20} className="text-gray-300" />
              </div>
            )}
          </div>
          <div>
            <DialogTitle className="text-base font-semibold">{product.name}</DialogTitle>
            <DialogDescription className="text-xs text-gray-400 mt-0.5">
              {[product.color, product.type].filter(Boolean).join(" · ")}
            </DialogDescription>
          </div>
        </div>

        {/* Variant list */}
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tallas disponibles</p>
          {variants.map((v) => {
            const stock = getStock(v.id);
            const q = getQty(v.id);
            const isAdding = adding === v.id;
            const isAdded = added === v.id;

            return (
              <div key={v.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                <span className="w-12 text-sm font-semibold text-gray-800">{v.size}</span>
                <span className="flex-1 text-xs text-gray-400">
                  ${v.price_bcv.toFixed(2)} · {stock} disp.
                </span>

                {/* Qty stepper */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setQty((p) => ({ ...p, [v.id]: Math.max(1, (p[v.id] ?? 1) - 1) }))}
                    disabled={q <= 1}
                    className="h-6 w-6 rounded border flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
                  >
                    <Minus size={10} />
                  </button>
                  <Input
                    type="number"
                    min={1}
                    max={stock}
                    value={q}
                    onChange={(e) =>
                      setQty((p) => ({
                        ...p,
                        [v.id]: Math.max(1, Math.min(stock, parseInt(e.target.value) || 1)),
                      }))
                    }
                    className="h-6 w-12 text-center text-xs px-1"
                  />
                  <button
                    type="button"
                    onClick={() => setQty((p) => ({ ...p, [v.id]: Math.min(stock, (p[v.id] ?? 1) + 1) }))}
                    disabled={q >= stock}
                    className="h-6 w-6 rounded border flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
                  >
                    <Plus size={10} />
                  </button>
                </div>

                {/* Add button */}
                <Button
                  size="sm"
                  className={cn("h-7 w-20 text-xs transition-colors", isAdded && "bg-emerald-600 hover:bg-emerald-600")}
                  disabled={isAdding || !!added}
                  onClick={() => addToCart(v.id)}
                >
                  {isAdding ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : isAdded ? (
                    <><Check size={11} className="mr-1" />Listo</>
                  ) : (
                    "Agregar"
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Cart selector */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
            <ShoppingCart size={12} />
            Agregar a orden
          </p>
          <div className="space-y-1">
            {carts.map((cart) => (
              <button
                key={cart.id}
                type="button"
                onClick={() => setSelectedCartId(cart.id)}
                className={cn(
                  "w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  selectedCartId === cart.id
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className={cn(
                  "h-3.5 w-3.5 rounded-full border-2 flex-shrink-0",
                  selectedCartId === cart.id ? "border-gray-900 bg-gray-900" : "border-gray-300"
                )} />
                <span className="flex-1 truncate font-medium text-gray-800">
                  {cart.note || `Orden del ${new Date(cart.created_at).toLocaleDateString("es-VE")}`}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {cart.items.length} prod.
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedCartId("new")}
              className={cn(
                "w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                selectedCartId === "new"
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <div className={cn(
                "h-3.5 w-3.5 rounded-full border-2 flex-shrink-0",
                selectedCartId === "new" ? "border-gray-900 bg-gray-900" : "border-gray-300"
              )} />
              <span className="flex-1 font-medium text-gray-600">+ Crear nueva orden</span>
            </button>
            {selectedCartId === "new" && (
              <Input
                autoFocus
                placeholder="Nombre de la orden (opcional)"
                value={newCartNote}
                onChange={(e) => setNewCartNote(e.target.value)}
                className="text-sm h-8 mt-0.5"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        )}
      </DialogContent>
      </Dialog>
    </>
  );
}
