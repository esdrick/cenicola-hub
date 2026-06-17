"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, PackageCheck } from "lucide-react";

type Props = { orderId: string; orderNumber: string };

export function CompletarOrdenButton({ orderId, orderNumber }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompletar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/embalaje/${orderId}/completar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al completar la orden"); return; }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PackageCheck size={14} className="mr-1.5" />
        Marcar como completada
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Marcar orden {orderNumber} como completada?</DialogTitle>
            <DialogDescription>
              Esto indica que el paquete fue entregado al cliente. La orden pasará
              a estado <strong>Completada</strong> y no podrá revertirse.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle size={14} />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleCompletar} disabled={loading}>
              {loading
                ? <Loader2 size={14} className="mr-2 animate-spin" />
                : <PackageCheck size={14} className="mr-2" />
              }
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
