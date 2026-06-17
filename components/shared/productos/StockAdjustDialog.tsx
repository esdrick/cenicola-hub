"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  variantId: string;
  productName: string;
  size: string;
  currentOnline: number;
  currentStore: number;
};

export function StockAdjustDialog({
  open, onClose, onSuccess,
  variantId, productName, size,
  currentOnline, currentStore,
}: Props) {
  const [newOnline, setNewOnline] = useState<string>(String(currentOnline));
  const [newStore, setNewStore] = useState<string>(String(currentStore));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset on open
  function handleOpenChange(v: boolean) {
    if (!v) {
      setNewOnline(String(currentOnline));
      setNewStore(String(currentStore));
      setReason("");
      setError(null);
      onClose();
    }
  }

  const previewTotal = (parseInt(newOnline) || 0) + (parseInt(newStore) || 0);
  const hasChanges =
    parseInt(newOnline) !== currentOnline || parseInt(newStore) !== currentStore;

  async function handleSave() {
    setError(null);
    if (!reason.trim()) { setError("El motivo es requerido"); return; }
    if (parseInt(newOnline) < 0 || parseInt(newStore) < 0) {
      setError("El stock no puede ser negativo"); return;
    }
    if (!hasChanges) { setError("No hay cambios que guardar"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variant_id: variantId,
          new_stock_online: parseInt(newOnline) || 0,
          new_stock_store: parseInt(newStore) || 0,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al ajustar el stock"); return; }
      onSuccess();
      handleOpenChange(false);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
          <p className="text-sm text-gray-500">
            {productName} — talla <strong>{size}</strong>
          </p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertCircle size={15} />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Stock actual */}
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3 text-center text-sm">
            <div>
              <p className="text-xs text-gray-500">Online actual</p>
              <p className="font-semibold">{currentOnline}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Tienda actual</p>
              <p className="font-semibold">{currentStore}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total actual</p>
              <p className="font-semibold">{currentOnline + currentStore}</p>
            </div>
          </div>

          {/* Nuevos valores */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nuevo stock online</Label>
              <Input type="number" min="0" value={newOnline}
                onChange={(e) => setNewOnline(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-1.5">
              <Label>Nuevo stock tienda</Label>
              <Input type="number" min="0" value={newStore}
                onChange={(e) => setNewStore(e.target.value)} disabled={loading} />
            </div>
          </div>

          {/* Preview del total */}
          <div className="rounded-md border border-dashed p-3 text-center">
            <p className="text-xs text-gray-500">Total después del ajuste</p>
            <p className={`text-xl font-bold ${previewTotal < 3 ? "text-amber-600" : "text-gray-900"}`}>
              {previewTotal}
            </p>
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <Label>Motivo del ajuste *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Corrección de inventario físico, devolución, etc." rows={2}
              disabled={loading} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || !hasChanges}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : "Guardar ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
