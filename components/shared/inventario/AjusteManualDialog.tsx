"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, Search } from "lucide-react";
import type { ProductJSON, ProductVariantJSON } from "@/types";

type Props = { open: boolean; onClose: () => void };

type Step = "search" | "adjust";

export function AjusteManualDialog({ open, onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("search");

  // Search state
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<ProductJSON[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Selected variant state
  const [selectedProduct, setSelectedProduct] = useState<ProductJSON | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantJSON | null>(null);

  // Adjust state
  const [newOnline, setNewOnline] = useState("");
  const [newStore, setNewStore] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Search with debounce
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(searchQ)}&pageSize=8`);
        const data = await res.json();
        setSearchResults(data.data ?? []);
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 350);
  }, [searchQ]);

  function selectVariant(product: ProductJSON, variant: ProductVariantJSON) {
    setSelectedProduct(product);
    setSelectedVariant(variant);
    setNewOnline(String(variant.stock_online));
    setNewStore(String(variant.stock_store));
    setError(null);
    setStep("adjust");
  }

  function reset() {
    setStep("search");
    setSearchQ("");
    setSearchResults([]);
    setSelectedProduct(null);
    setSelectedVariant(null);
    setNewOnline("");
    setNewStore("");
    setReason("");
    setError(null);
  }

  function handleClose() { reset(); onClose(); }

  async function handleSave() {
    if (!selectedVariant) return;
    setError(null);
    if (!reason.trim()) { setError("El motivo es requerido"); return; }
    const nOnline = parseInt(newOnline);
    const nStore = parseInt(newStore);
    if (isNaN(nOnline) || isNaN(nStore)) { setError("Stock inválido"); return; }
    if (nOnline < 0 || nStore < 0) { setError("El stock no puede ser negativo"); return; }
    if (nOnline === selectedVariant.stock_online && nStore === selectedVariant.stock_store) {
      setError("No hay cambios que guardar"); return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_id: selectedVariant.id, new_stock_online: nOnline, new_stock_store: nStore, reason }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al ajustar"); return; }
      router.refresh();
      handleClose();
    } catch { setError("Error de conexión."); }
    finally { setSaving(false); }
  }

  const previewTotal = (parseInt(newOnline) || 0) + (parseInt(newStore) || 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajuste manual de stock</DialogTitle>
        </DialogHeader>

        {step === "search" && (
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Buscar producto por nombre…" className="pl-8" autoFocus />
            </div>

            {searching && (
              <div className="flex justify-center py-4">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            )}

            {!searching && searchResults.length > 0 && (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {searchResults.map((product) => (
                  <div key={product.id} className="rounded-lg border p-3">
                    <p className="text-sm font-semibold text-gray-900">
                      {product.name}
                      {product.color && <span className="ml-1.5 text-gray-400">· {product.color}</span>}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {product.variants.filter((v) => v.is_active).map((variant) => (
                        <button key={variant.id} type="button"
                          onClick={() => selectVariant(product, variant)}
                          className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-gray-50 hover:border-gray-400 transition-colors">
                          <Badge variant="secondary" className="text-[10px] px-1">{variant.size}</Badge>
                          <span className="text-gray-600">
                            Online: {variant.stock_online} · Tienda: {variant.stock_store}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!searching && searchQ && searchResults.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-400">
                No se encontraron productos
              </p>
            )}

            {!searchQ && (
              <p className="py-4 text-center text-sm text-gray-400">
                Escribe el nombre del producto para buscarlo
              </p>
            )}
          </div>
        )}

        {step === "adjust" && selectedVariant && selectedProduct && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <div>
                <p className="text-sm font-medium">{selectedProduct.name}</p>
                <p className="text-xs text-gray-500">Talla: <strong>{selectedVariant.size}</strong></p>
              </div>
              <button type="button" onClick={() => setStep("search")}
                className="text-xs text-gray-400 hover:text-gray-600 underline">
                Cambiar
              </button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle size={14} />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-3 gap-3 rounded-lg border p-3 text-center text-sm">
              <div>
                <p className="text-xs text-gray-400">Online actual</p>
                <p className="font-semibold">{selectedVariant.stock_online}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Tienda actual</p>
                <p className="font-semibold">{selectedVariant.stock_store}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total actual</p>
                <p className="font-semibold">{selectedVariant.stock_total}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nuevo online</Label>
                <Input type="number" min="0" value={newOnline}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setNewOnline(e.target.value)} disabled={saving} />
              </div>
              <div className="space-y-1.5">
                <Label>Nuevo tienda</Label>
                <Input type="number" min="0" value={newStore}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setNewStore(e.target.value)} disabled={saving} />
              </div>
            </div>

            <div className="rounded-md border border-dashed p-3 text-center">
              <p className="text-xs text-gray-400">Total después del ajuste</p>
              <p className={`text-xl font-bold ${previewTotal < 3 ? "text-amber-600" : "text-gray-900"}`}>
                {previewTotal}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Motivo *</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: Corrección de inventario físico" rows={2} disabled={saving} />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={saving}>Cancelar</Button>
          {step === "adjust" && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Guardar ajuste"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
