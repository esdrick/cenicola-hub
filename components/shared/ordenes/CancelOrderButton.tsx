"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, X } from "lucide-react";

type Props = { orderId: string; orderNumber: string };

export function CancelOrderButton({ orderId, orderNumber }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al cancelar"); return; }
      router.refresh();
      setOpen(false);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <X size={14} className="mr-1.5" />
        Cancelar orden
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Cancelar la orden {orderNumber}?</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm text-gray-600">
            <p>Esta acción:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Cambiará el estado a <strong>Cancelada</strong></li>
              <li>Devolverá el stock de todos los productos al inventario</li>
              <li>No se puede deshacer</li>
            </ul>
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
            <Button variant="destructive" onClick={handleCancel} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : "Sí, cancelar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
