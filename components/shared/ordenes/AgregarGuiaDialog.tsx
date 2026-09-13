"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Truck, Upload, Mail, Check, AlertCircle, Loader2, Hash, Send,
} from "lucide-react";
import { shortOrderNumber } from "@/lib/order-utils";
import { formatVenezuelaDateTime } from "@/lib/date-utils";
import { validateImageFile, optimizeImage } from "@/lib/image-optimizer";
import Image from "next/image";

const VALID_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

interface AgregarGuiaDialogProps {
  orderId: string;
  orderNumber: string;
  shippingCompany?: string | null;
  initialTrackingNumber?: string | null;
  initialGuidePhoto?: string | null;
  initialCustomerEmail?: string | null;
  initialGuideEmailSentAt?: string | null;
  initialGuideEmailSentTo?: string | null;
  disabled?: boolean;
  disabledReason?: string;
  onSuccess?: () => void;
  triggerButton?: React.ReactElement;
}

export function AgregarGuiaDialog({
  orderId,
  orderNumber,
  shippingCompany,
  initialTrackingNumber,
  initialGuidePhoto,
  initialCustomerEmail,
  initialGuideEmailSentAt,
  initialGuideEmailSentTo,
  disabled = false,
  disabledReason,
  onSuccess,
  triggerButton,
}: AgregarGuiaDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber ?? "");
  const [customerEmail, setCustomerEmail] = useState(initialCustomerEmail ?? "");
  const [sendEmail, setSendEmail] = useState(!initialGuideEmailSentAt);

  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTrackingNumber(initialTrackingNumber ?? "");
      setCustomerEmail(initialCustomerEmail ?? "");
      setSendEmail(!initialGuideEmailSentAt);
      setFotoFile(null);
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
      setFotoPreview(null);
      setError(null);
      setSuccessMsg(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    };
  }, [fotoPreview]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const typeErr = validateImageFile(file, { validTypes: VALID_IMAGE_TYPES });
    if (typeErr) {
      setError(typeErr);
      return;
    }
    setError(null);
    try {
      const optimized = await optimizeImage(file);
      setFotoFile(optimized);
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
      setFotoPreview(URL.createObjectURL(optimized));
    } catch {
      setError("Error al procesar la imagen de la guía");
    }
  }

  async function handleSubmit() {
    setError(null);
    setSuccessMsg(null);

    const cleanTracking = trackingNumber.trim();
    const cleanEmail = customerEmail.trim();

    if (!cleanTracking && !fotoFile && !initialGuidePhoto) {
      setError("Debes ingresar un número de guía o adjuntar una foto de la guía");
      return;
    }

    if (sendEmail && !cleanEmail) {
      setError("Ingresa el correo electrónico del cliente para enviarle la guía");
      return;
    }

    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.append("tracking_number", cleanTracking);
      fd.append("customer_email", cleanEmail);
      fd.append("send_email", sendEmail ? "true" : "false");
      if (fotoFile) {
        fd.append("foto_guia", fotoFile);
      }

      const res = await fetch(`/api/orders/${orderId}/guia`, {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al guardar la guía");
      }

      if (data.emailSent) {
        setSuccessMsg("¡Guía guardada y correo enviado con éxito al cliente!");
      } else if (sendEmail && !data.emailSent) {
        setSuccessMsg("Guía guardada correctamente (El envío del correo quedó registrado en modo de pruebas).");
      } else {
        setSuccessMsg("Guía guardada correctamente.");
      }

      setTimeout(() => {
        setOpen(false);
        if (onSuccess) onSuccess();
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  const currentGuideImage = fotoPreview || initialGuidePhoto;

  return (
    <Dialog open={disabled ? false : open} onOpenChange={(v) => { if (!disabled) setOpen(v); }}>
      <DialogTrigger
        disabled={disabled}
        render={
          triggerButton ?? (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              title={disabled ? (disabledReason || "No disponible") : undefined}
              className="gap-1.5 border-sky-200 text-sky-700 hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Truck size={14} />
              {initialGuidePhoto || initialTrackingNumber ? "Editar Guía" : "Agregar Guía / Enviar Correo"}
            </Button>
          )
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="text-sky-600" size={18} />
            Guía de Seguimiento — {shortOrderNumber(orderNumber)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertCircle size={14} />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {successMsg && (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
              <Check size={14} className="text-emerald-600" />
              <AlertDescription>{successMsg}</AlertDescription>
            </Alert>
          )}

          {/* Empresa de envío (informativo) */}
          {shippingCompany && (
            <div className="rounded-lg bg-sky-50 border border-sky-100 p-3 text-xs text-sky-900 flex items-center justify-between">
              <span className="text-sky-600 font-medium">Empresa de Envío:</span>
              <span className="font-semibold text-sky-950">{shippingCompany}</span>
            </div>
          )}

          {/* Número de Guía */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Hash size={13} className="text-gray-500" />
              Número de Guía (Tracking)
            </Label>
            <Input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Ej: 123456789"
              className="font-mono text-sm"
            />
          </div>

          {/* Foto de la guía */}
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span>Foto de la Guía de Seguimiento</span>
              <span className="text-xs text-gray-400 font-normal">JPG, PNG, WEBP max 5MB</span>
            </Label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />

            {currentGuideImage ? (
              <div className="relative group aspect-video w-full rounded-lg overflow-hidden border bg-gray-50 flex items-center justify-center">
                <Image
                  src={currentGuideImage}
                  alt="Foto de la guía"
                  fill
                  className="object-contain"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs gap-1"
                  >
                    <Upload size={13} />
                    Cambiar foto
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-sky-200 hover:border-sky-400 bg-sky-50/50 hover:bg-sky-50 rounded-lg p-5 flex flex-col items-center justify-center text-center transition-colors space-y-1"
              >
                <Upload size={24} className="text-sky-500" />
                <p className="text-xs font-semibold text-sky-800">Haz clic para adjuntar foto de la guía</p>
                <p className="text-[11px] text-sky-600">Foto del comprobante con número y detalles</p>
              </div>
            )}
          </div>

          {/* Correo del cliente */}
          <div className="space-y-1.5 border-t pt-3">
            <Label className="flex items-center gap-1.5">
              <Mail size={13} className="text-gray-500" />
              Correo Electrónico del Cliente
            </Label>
            <Input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="cliente@ejemplo.com"
              className="text-sm"
            />
          </div>

          {/* Aviso si ya fue enviado el correo previamente */}
          {initialGuideEmailSentAt && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
              <Check size={15} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-950">Correo enviado previamente</p>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  La guía ya fue enviada por correo el{" "}
                  {formatVenezuelaDateTime(initialGuideEmailSentAt, {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {initialGuideEmailSentTo ? ` a ${initialGuideEmailSentTo}` : ""}.
                </p>
              </div>
            </div>
          )}

          {/* Opción Enviar Correo */}
          <div className="flex items-center gap-2 rounded-lg border bg-gray-50 p-3">
            <input
              type="checkbox"
              id="sendEmailCheck"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 h-4 w-4 cursor-pointer"
            />
            <label htmlFor="sendEmailCheck" className="text-xs font-medium text-gray-700 cursor-pointer select-none">
              {initialGuideEmailSentAt
                ? "Reenviar correo al cliente con la guía de seguimiento y fotos"
                : "Enviar correo al cliente con la guía de seguimiento y fotos"}
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Send size={14} />
                {sendEmail
                  ? initialGuideEmailSentAt
                    ? "Guardar y Reenviar Correo"
                    : "Guardar y Enviar Correo"
                  : "Guardar Guía"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
