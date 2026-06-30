"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, PackageOpen } from "lucide-react";

type Props = { orderId: string; orderNumber: string };

export function ConfirmarOrdenButton({ orderId, orderNumber }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/confirmar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al confirmar la orden"); return; }
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
      <Button size="sm" onClick={() => setOpen(true)}>
        <PackageOpen size={14} className="mr-1.5" />
        Confirmar y enviar a embalaje
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar orden {orderNumber}</DialogTitle>
            <DialogDescription>
              El pago fue verificado. Al confirmar, la orden pasará a{" "}
              <strong>En embalaje</strong> para su preparación y envío.
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
            <Button onClick={handleConfirmar} disabled={loading}>
              {loading
                ? <Loader2 size={14} className="mr-2 animate-spin" />
                : <PackageOpen size={14} className="mr-2" />
              }
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
