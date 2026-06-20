"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, ChevronRight, AlertTriangle, Trash2, Loader2, ChevronDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CartJSON } from "@/types";

function CartCard({ cart, onDelete }: { cart: CartJSON; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm("¿Cancelar esta orden en proceso?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/carts/${cart.id}`, { method: "DELETE" });
      onDelete(cart.id);
    } catch {
      setDeleting(false);
    }
  }

  const preview = cart.items.slice(0, 3);
  const extra = cart.items.length - preview.length;
  const label = cart.note || `Orden del ${new Date(cart.created_at).toLocaleDateString("es-VE")}`;

  return (
    <div className="relative rounded-xl border bg-white p-4 space-y-3 hover:border-gray-300 transition-colors">
      {/* Delete button */}
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="absolute right-3 top-3 text-gray-300 hover:text-red-500 transition-colors"
        title="Eliminar preorden"
      >
        {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>

      {/* Header */}
      <div className="pr-6">
        <p className="text-sm font-semibold text-gray-900 truncate">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5 capitalize">
          {cart.channel} · {cart.items.length} producto{cart.items.length !== 1 ? "s" : ""} · ${cart.total_usd.toFixed(2)} USD
        </p>
      </div>

      {/* Stock warning */}
      {cart.has_stock_issues && (
        <p className="flex items-center gap-1 text-xs text-orange-600">
          <AlertTriangle size={11} />
          Stock insuficiente en algunos productos
        </p>
      )}

      {/* Product thumbnails */}
      {cart.items.length > 0 && (
        <div className="flex items-center gap-1.5">
          {preview.map((item) => (
            item.variant.product.photos[0] ? (
              <Image
                key={item.id}
                src={item.variant.product.photos[0]}
                alt={item.variant.product.name}
                width={32} height={32}
                className="h-8 w-8 rounded object-cover border"
                title={`${item.variant.product.name} ${item.variant.size}`}
              />
            ) : (
              <div key={item.id} className="h-8 w-8 rounded border bg-gray-100 flex items-center justify-center">
                <ShoppingCart size={12} className="text-gray-400" />
              </div>
            )
          ))}
          {extra > 0 && (
            <span className="h-8 w-8 rounded border bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-medium">
              +{extra}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Link
          href={`/dashboard/carritos/${cart.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs h-7 px-2.5")}
        >
          Editar
        </Link>
        {cart.items.length > 0 && (
          <Link
            href={`/dashboard/carritos/${cart.id}/completar`}
            className={cn(buttonVariants({ size: "sm" }), "text-xs h-7 px-2.5")}
          >
            Completar
            <ChevronRight size={12} className="ml-1" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function CartsSection({ initialCarts }: { initialCarts: CartJSON[] }) {
  const [carts, setCarts] = useState<CartJSON[]>(initialCarts);
  const [collapsed, setCollapsed] = useState(false);

  function handleDelete(id: string) {
    setCarts((prev) => prev.filter((c) => c.id !== id));
  }

  if (carts.length === 0) return null;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
      >
        <ShoppingCart size={15} />
        Órdenes en proceso
        <span className="rounded-full bg-gray-900 px-1.5 py-0.5 text-xs text-white">
          {carts.length}
        </span>
        <ChevronDown size={14} className={cn("text-gray-400 transition-transform", collapsed && "-rotate-90")} />
      </button>

      {!collapsed && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {carts.map((cart) => (
            <CartCard key={cart.id} cart={cart} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
