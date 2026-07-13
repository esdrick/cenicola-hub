"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { TIPO_CIERRE_LABELS, formatFechaCorta } from "@/components/shared/cierre-tienda/cierre-format";

type Props = {
  orderId: string;
  orderNumber: string;
  incluidoEnCierre: { id: string; tipo: string; fecha_inicio: Date; fecha_fin: Date } | null;
};

export function DevolucionForzadaButton({ orderId, orderNumber, incluidoEnCierre }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/devolucion-forzada`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al procesar la devolución"); return; }
      router.refresh();
      setOpen(false);
      setMotivo("");
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <AlertTriangle size={14} className="mr-1.5" />
        Forzar devolución
      </Button>

      <Dialog open={open} onOpenChange={(v) => !loading && !v && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Forzar devolución de la orden {orderNumber}?</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm text-gray-600">
            <p>Esta acción:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Cambiará el estado a <strong>Cancelada</strong></li>
              <li>Devolverá el stock de todos los productos al inventario</li>
              <li>Rechazará todos los pagos verificados de esta orden</li>
              <li>No se puede deshacer</li>
            </ul>
          </div>

          {incluidoEnCierre && (
            <Alert variant="destructive">
              <AlertTriangle size={14} />
              <AlertDescription>
                <strong>Ya incluida en un cierre de tienda.</strong> Esta orden ya fue incluida en un cierre{" "}
                {TIPO_CIERRE_LABELS[incluidoEnCierre.tipo] ?? incluidoEnCierre.tipo}{" "}
                ({formatFechaCorta(incluidoEnCierre.fecha_inicio.toString())} – {formatFechaCorta(incluidoEnCierre.fecha_fin.toString())}).
                Ese cierre ya está cerrado y no se corregirá automáticamente.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2 py-2">
            <Label>Motivo de la devolución *</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Cliente rechazó el paquete, producto dañado en tránsito…"
              rows={3}
              disabled={loading}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle size={14} />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Volver
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={loading || !motivo.trim()}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : "Sí, forzar devolución"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
