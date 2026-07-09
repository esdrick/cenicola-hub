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
import { Plus, Loader2, Upload, AlertCircle, AlertTriangle } from "lucide-react";
import { PAYMENT_TYPE_LABELS } from "@/lib/order-utils";
import { optimizeImage, validateImageFile } from "@/lib/image-optimizer";
import type { PaymentType } from "@/app/generated/prisma/client";

type TasaInfo = {
  id: string;
  rate: number;
  eur_rate: number | null;
  paralelo_rate: number | null;
  date: string;
  stale: boolean;
};

const BCV_METHODS = ["efectivo_bs", "transferencia", "pago_movil"] as const;
const DIVISAS_METHODS = ["efectivo_usd", "zelle", "usdt"] as const;

type Props = {
  orderId: string;
  orderNumber: string;
  totalUsd: number;
  paidUsd: number;
  pricingMethod: "bcv" | "divisas" | null;
};

function fmtBs(n: number) {
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function AgregarPagoDialog({ orderId, orderNumber, totalUsd, paidUsd, pricingMethod }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tasa, setTasa] = useState<TasaInfo | null>(null);
  const [tasaLoading, setTasaLoading] = useState(false);
  const photoRef = useRef<HTMLInputElement | null>(null);

  const remaining = Math.max(0, totalUsd - paidUsd);
  const maxAmount = remaining + 2.00;

  const allowedMethods: PaymentType[] =
    pricingMethod === "bcv" ? [...BCV_METHODS] :
    pricingMethod === "divisas" ? [...DIVISAS_METHODS] :
    Object.keys(PAYMENT_TYPE_LABELS) as PaymentType[];

  const makeEmpty = () => ({
    payment_type: (pricingMethod === "divisas" ? "zelle" : "transferencia") as PaymentType,
    amount_usd: "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_time: "",
    reference: "",
    payment_photo: "",
  });

  const [form, setForm] = useState(makeEmpty);

  async function handleOpen() {
    setForm(makeEmpty());
    setError(null);
    setOpen(true);

    setTasaLoading(true);
    try {
      const res = await fetch("/api/tasa");
      if (res.ok) {
        const data = await res.json();
        setTasa(data);
      } else {
        setTasa(null);
      }
    } catch {
      setTasa(null);
    } finally {
      setTasaLoading(false);
    }
  }

  async function uploadPhoto(file: File) {
    const validationError = validateImageFile(file, { maxMb: 20 });
    if (validationError) { setError(validationError); return; }
    setUploading(true);
    try {
      const optimized = await optimizeImage(file);
      const fd = new FormData();
      fd.append("file", optimized);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (r.ok) setForm((p) => ({ ...p, payment_photo: j.url }));
      else setError(j.error ?? "Error al subir el comprobante");
    } catch {
      setError("Error al procesar o subir el comprobante. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit() {
    setError(null);
    const amt = parseFloat(form.amount_usd);
    if (isNaN(amt) || amt <= 0) { setError("Monto inválido"); return; }
    if (amt > maxAmount) {
      setError(`El monto excede el límite de redondeo. Máximo $${maxAmount.toFixed(2)}`);
      return;
    }
    if (form.payment_type !== "efectivo_bs" && form.payment_type !== "efectivo_usd") {
      const ref = form.reference.trim();
      if (!ref) {
        setError("La referencia es requerida para este método de pago");
        return;
      }
      if (ref.length < 6 || ref.length > 30) {
        setError("La referencia debe tener entre 6 y 30 caracteres");
        return;
      }
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
            exchange_rate_id: tasa?.id ?? null,
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

  const isEfectivo = form.payment_type === "efectivo_bs" || form.payment_type === "efectivo_usd";
  const amountNum = parseFloat(form.amount_usd);
  const amountBs = tasa && !isNaN(amountNum) && amountNum > 0
    ? amountNum * tasa.rate
    : null;

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
            {/* Tasas de referencia */}
            {tasaLoading && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Loader2 size={11} className="animate-spin" /> Cargando tasas…
              </div>
            )}
            {!tasaLoading && tasa && (
              <span className="inline-flex items-center gap-3 rounded-full border bg-gray-50 px-4 py-1.5 text-xs text-gray-600">
                <span><span className="font-semibold text-gray-800">USD</span> {fmtBs(tasa.rate)}{tasa.stale && <AlertTriangle size={9} className="inline ml-0.5 text-amber-500" />}</span>
                {tasa.eur_rate != null && <><span className="text-gray-300">·</span><span><span className="font-semibold text-gray-800">EUR</span> {fmtBs(tasa.eur_rate)}</span></>}
                {tasa.paralelo_rate != null && <><span className="text-gray-300">·</span><span><span className="font-semibold text-gray-800">Par.</span> {fmtBs(tasa.paralelo_rate)}</span></>}
              </span>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select
                  value={form.payment_type}
                  onValueChange={(v) => {
                    const now = new Date();
                    const ef = v === "efectivo_bs" || v === "efectivo_usd";
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
                  <SelectTrigger>
                    <SelectValue>{PAYMENT_TYPE_LABELS[form.payment_type]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_TYPE_LABELS)
                      .filter(([k]) => allowedMethods.includes(k as PaymentType))
                      .map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Monto USD *</Label>
                {(() => {
                  const num = parseFloat(form.amount_usd);
                  const montoError =
                    form.amount_usd && (isNaN(num) || num <= 0)
                      ? "Monto inválido"
                      : form.amount_usd && num > maxAmount
                      ? `Máximo $${maxAmount.toFixed(2)} (redondeo)`
                      : null;
                  return (
                    <div className="space-y-1">
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.amount_usd}
                        onChange={(e) => setForm((p) => ({ ...p, amount_usd: e.target.value }))}
                        placeholder="0.00"
                        className={montoError ? "border-red-400 focus-visible:ring-red-400" : ""}
                      />
                      {montoError && (
                        <p className="text-xs text-red-600">{montoError}</p>
                      )}
                      {/* Conversión a Bs en tiempo real */}
                      {tasaLoading && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" />
                          Cargando tasa…
                        </p>
                      )}
                      {!tasaLoading && tasa && amountBs !== null && (
                        <div className="rounded-md bg-emerald-50 border border-emerald-100 px-2.5 py-1.5">
                          <p className="text-xs text-emerald-700 font-medium">
                            ≈ Bs. {fmtBs(amountBs)}
                          </p>
                          <p className="text-[10px] text-emerald-500 mt-0.5">
                            Tasa: Bs. {fmtBs(tasa.rate)} × $1
                            {tasa.stale && (
                              <span className="ml-1 inline-flex items-center gap-0.5 text-amber-600">
                                <AlertTriangle size={9} />
                                desactualizada
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                      {!tasaLoading && !tasa && (
                        <p className="text-xs text-gray-400">Sin tasa disponible</p>
                      )}
                    </div>
                  );
                })()}
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
                      max={new Date().toISOString().slice(0, 10)}
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
                    maxLength={30}
                  />
                  <p className="text-xs text-gray-400">Entre 6 y 30 caracteres</p>
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
                      accept="image/jpeg,image/png,image/webp"
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
                disabled={
                  isPending ||
                  uploading ||
                  !form.amount_usd ||
                  isNaN(parseFloat(form.amount_usd)) ||
                  parseFloat(form.amount_usd) <= 0 ||
                  parseFloat(form.amount_usd) > maxAmount
                }
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
