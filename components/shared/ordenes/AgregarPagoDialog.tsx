"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Loader2, Upload, AlertCircle } from "lucide-react";
import { PAYMENT_TYPE_LABELS } from "@/lib/order-utils";
import type { PaymentType } from "@/app/generated/prisma/client";

type Props = {
  orderId: string;
  orderNumber: string;
  totalUsd: number;
  paidUsd: number;
};

export function AgregarPagoDialog({ orderId, orderNumber, totalUsd, paidUsd }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const photoRef = useRef<HTMLInputElement | null>(null);

  const remaining = Math.max(0, totalUsd - paidUsd);

  const makeEmpty = () => ({
    payment_type: "transferencia" as PaymentType,
    amount_usd: "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_time: "",
    reference: "",
    payment_photo: "",
  });

  const [form, setForm] = useState(makeEmpty);

  function handleOpen() {
    setForm(makeEmpty());
    setError(null);
    setOpen(true);
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (r.ok) setForm((p) => ({ ...p, payment_photo: j.url }));
      else setError(j.error ?? "Error al subir el comprobante");
    } catch {
      setError("Error de conexión al subir el comprobante");
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit() {
    setError(null);
    const amt = parseFloat(form.amount_usd);
    if (isNaN(amt) || amt <= 0) { setError("Monto inválido"); return; }
    if (amt > remaining + 0.005) {
      setError(`El monto ($${amt.toFixed(2)}) supera el saldo pendiente ($${remaining.toFixed(2)} USD)`);
      return;
    }
    if (form.payment_type !== "efectivo" && !form.reference.trim()) {
      setError("La referencia es requerida para este método de pago");
      return;
    }

    start(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/agregar-pago`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_type: form.payment_type,
            amount_usd: amt,
            payment_date: form.payment_date,
            payment_time: form.payment_time || null,
            reference: form.reference,
            payment_photo: form.payment_photo || null,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Error al agregar el pago");
          return;
        }
        setOpen(false);
        router.refresh();
      } catch {
        setError("Error de conexión");
      }
    });
  }

  const isEfectivo = form.payment_type === "efectivo";

  return (
    <>
      <Button size="sm" onClick={handleOpen}>
        <Plus size={13} className="mr-1.5" />
        Agregar pago
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar pago</DialogTitle>
            <DialogDescription>
              Orden <span className="font-mono font-medium">{orderNumber}</span>
              {remaining > 0 && (
                <> · Saldo pendiente: <strong>${remaining.toFixed(2)} USD</strong></>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select
                  value={form.payment_type}
                  onValueChange={(v) => {
                    const now = new Date();
                    const ef = v === "efectivo";
                    setForm((p) => ({
                      ...p,
                      payment_type: v as PaymentType,
                      reference: ef ? "" : p.reference,
                      payment_date: ef ? now.toISOString().slice(0, 10) : p.payment_date,
                      payment_time: ef
                        ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
                        : p.payment_time,
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Monto USD *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount_usd}
                  onChange={(e) => setForm((p) => ({ ...p, amount_usd: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            {!isEfectivo && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Fecha</Label>
                    <Input
                      type="date"
                      value={form.payment_date}
                      onChange={(e) => setForm((p) => ({ ...p, payment_date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hora</Label>
                    <Input
                      type="time"
                      value={form.payment_time}
                      onChange={(e) => setForm((p) => ({ ...p, payment_time: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Referencia *</Label>
                  <Input
                    value={form.reference}
                    onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
                    placeholder="Número de confirmación o referencia"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Comprobante</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.payment_photo}
                      onChange={(e) => setForm((p) => ({ ...p, payment_photo: e.target.value }))}
                      placeholder="URL de la imagen"
                      className="flex-1"
                    />
                    <input
                      ref={photoRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadPhoto(f);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => photoRef.current?.click()}
                    >
                      {uploading
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Upload size={13} />
                      }
                    </Button>
                  </div>
                  {form.payment_photo && (
                    <Image
                      src={form.payment_photo}
                      alt="Comprobante"
                      width={80}
                      height={80}
                      className="mt-1 h-16 w-16 rounded object-cover"
                    />
                  )}
                </div>
              </>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle size={14} />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isPending || uploading || !form.amount_usd}
              >
                {isPending
                  ? <Loader2 size={14} className="animate-spin mr-2" />
                  : <Plus size={14} className="mr-2" />
                }
                Agregar pago
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
