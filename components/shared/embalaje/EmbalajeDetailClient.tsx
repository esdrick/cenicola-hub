"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Upload, X, AlertCircle, Loader2, ZoomIn, Copy, Check } from "lucide-react";
import { optimizeImage, validateImageFile } from "@/lib/image-optimizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { EmbalajeOrdenDetailJSON } from "@/types";

interface EmbalajeDetailClientProps {
  order: EmbalajeOrdenDetailJSON;
}

const CHANNEL_LABELS: Record<string, string> = {
  online: "Online",
  tienda: "Tienda",
};

export function EmbalajeDetailClient({ order }: EmbalajeDetailClientProps) {
  const router = useRouter();

  const [foto1, setFoto1] = useState<File | null>(null);
  const [foto2, setFoto2] = useState<File | null>(null);
  const [foto3, setFoto3] = useState<File | null>(null);
  const [foto1Preview, setFoto1Preview] = useState<string | null>(null);
  const [foto2Preview, setFoto2Preview] = useState<string | null>(null);
  const [foto3Preview, setFoto3Preview] = useState<string | null>(null);
  const [tracking, setTracking] = useState("");
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const foto1InputRef = useRef<HTMLInputElement>(null);
  const foto2InputRef = useRef<HTMLInputElement>(null);
  const foto3InputRef = useRef<HTMLInputElement>(null);

  // Revoke object URLs on cleanup
  useEffect(() => {
    return () => {
      if (foto1Preview) URL.revokeObjectURL(foto1Preview);
      if (foto2Preview) URL.revokeObjectURL(foto2Preview);
      if (foto3Preview) URL.revokeObjectURL(foto3Preview);
    };
  }, [foto1Preview, foto2Preview, foto3Preview]);

  async function handleFoto1Change(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const typeError = validateImageFile(file, { validTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"] });
    if (typeError) { setError(typeError); return; }
    if (file.size > 20 * 1024 * 1024) {
      setError("La foto del paquete no puede superar 20MB");
      return;
    }
    if (foto1Preview) URL.revokeObjectURL(foto1Preview);
    setError(null);
    try {
      const optimized = await optimizeImage(file);
      setFoto1(optimized);
      setFoto1Preview(URL.createObjectURL(optimized));
    } catch {
      setError("No se pudo comprimir la imagen. Intenta con otro archivo.");
      setFoto1(null);
      setFoto1Preview(null);
      if (foto1InputRef.current) foto1InputRef.current.value = "";
    }
  }

  async function handleFoto2Change(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const typeError = validateImageFile(file, { validTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"] });
    if (typeError) { setError(typeError); return; }
    if (file.size > 20 * 1024 * 1024) {
      setError("La foto del recibo no puede superar 20MB");
      return;
    }
    if (foto2Preview) URL.revokeObjectURL(foto2Preview);
    setError(null);
    try {
      const optimized = await optimizeImage(file);
      setFoto2(optimized);
      setFoto2Preview(URL.createObjectURL(optimized));
    } catch {
      setError("No se pudo comprimir la imagen. Intenta con otro archivo.");
      setFoto2(null);
      setFoto2Preview(null);
      if (foto2InputRef.current) foto2InputRef.current.value = "";
    }
  }

  function removeFoto1() {
    if (foto1Preview) URL.revokeObjectURL(foto1Preview);
    setFoto1(null);
    setFoto1Preview(null);
    if (foto1InputRef.current) foto1InputRef.current.value = "";
  }

  function removeFoto2() {
    if (foto2Preview) URL.revokeObjectURL(foto2Preview);
    setFoto2(null);
    setFoto2Preview(null);
    if (foto2InputRef.current) foto2InputRef.current.value = "";
  }

  async function handleFoto3Change(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const typeError = validateImageFile(file, { validTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"] });
    if (typeError) { setError(typeError); return; }
    if (file.size > 20 * 1024 * 1024) {
      setError("La foto de la guía no puede superar 20MB");
      return;
    }
    if (foto3Preview) URL.revokeObjectURL(foto3Preview);
    setError(null);
    try {
      const optimized = await optimizeImage(file);
      setFoto3(optimized);
      setFoto3Preview(URL.createObjectURL(optimized));
    } catch {
      setError("No se pudo comprimir la imagen. Intenta con otro archivo.");
      setFoto3(null);
      setFoto3Preview(null);
      if (foto3InputRef.current) foto3InputRef.current.value = "";
    }
  }

  function removeFoto3() {
    if (foto3Preview) URL.revokeObjectURL(foto3Preview);
    setFoto3(null);
    setFoto3Preview(null);
    if (foto3InputRef.current) foto3InputRef.current.value = "";
  }

  async function handleConfirm() {
    if (!foto1) return;
    setSubmitting(true);
    setError(null);

    try {
      // Step 1: Upload photos
      const fd = new FormData();
      fd.append("foto1", foto1);
      if (foto2) fd.append("foto2", foto2);
      if (foto3) fd.append("foto3", foto3);

      const fotosRes = await fetch(`/api/embalaje/${order.id}/fotos`, {
        method: "POST",
        body: fd,
      });

      if (!fotosRes.ok) {
        const data = await fotosRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Error al subir las fotos");
      }

      const { foto1Url, foto2Url, foto3Url } = await fotosRes.json();

      // Step 2: Confirm shipment
      const confirmarRes = await fetch(`/api/embalaje/${order.id}/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foto1Url,
          foto2Url: foto2Url ?? undefined,
          foto3Url: foto3Url ?? undefined,
          tracking: tracking.trim() || undefined,
          notas: notas.trim() || undefined,
        }),
      });

      if (!confirmarRes.ok) {
        const data = await confirmarRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Error al confirmar el envío");
      }

      router.push("/dashboard/embalaje");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyCustomerData() {
    const lines = [
      `${order.customer_name} ${order.customer_lastname}`.trim(),
      `Cédula: ${order.customer_id_doc}`,
      order.customer_phone && `Teléfono: ${order.customer_phone}`,
      order.address && `Dirección: ${order.address}`,
      order.shipping_company && `Envío: ${order.shipping_company}`,
    ].filter(Boolean).join("\n");

    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar los datos del cliente");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/embalaje"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          ← Volver a Embalaje
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">
          Orden <span className="font-mono">{order.order_number}</span>
        </h1>
        <Badge className="bg-purple-100 text-purple-800">En embalaje</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order info card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">Información del cliente</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={handleCopyCustomerData}>
                {copied ? (
                  <>
                    <Check size={14} className="mr-1.5 text-emerald-600" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy size={14} className="mr-1.5" />
                    Copiar datos
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Cliente</dt>
                  <dd className="font-medium">
                    {order.customer_name} {order.customer_lastname}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Cédula</dt>
                  <dd className="font-medium">{order.customer_id_doc}</dd>
                </div>
                {order.customer_phone && (
                  <div>
                    <dt className="text-gray-500">Teléfono</dt>
                    <dd className="font-medium">{order.customer_phone}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500">Canal</dt>
                  <dd className="font-medium">{CHANNEL_LABELS[order.channel] ?? order.channel}</dd>
                </div>
                {order.address && (
                  <div className="col-span-2">
                    <dt className="text-gray-500">Dirección</dt>
                    <dd className="font-medium">{order.address}</dd>
                  </div>
                )}
                {order.shipping_company && (
                  <div>
                    <dt className="text-gray-500">Empresa de envío</dt>
                    <dd className="font-medium">{order.shipping_company}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500">Total</dt>
                  <dd className="font-medium">${order.total_usd.toFixed(2)}</dd>
                </div>
                {order.notes && (
                  <div className="col-span-2">
                    <dt className="text-gray-500">Notas</dt>
                    <dd className="font-medium">{order.notes}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500">Vendedora</dt>
                  <dd className="font-medium">{order.creator.name}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Items table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Productos ({order.items.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {order.items.map((item) => {
                  const snap = item.variant_snapshot as Record<string, unknown> | null;
                  const productName = item.variant?.product?.name ?? (snap?.product_name as string | undefined) ?? "—";
                  const color = (item.variant?.product?.color ?? (snap?.color as string | undefined)) ?? "—";
                  const size = item.variant?.size ?? (snap?.size as string | undefined) ?? "—";
                  const photo = item.variant?.product?.photos?.[0] ?? null;
                  return (
                    <div key={item.id} className="flex items-center gap-4 px-4 py-3">
                      {/* Photo */}
                      {photo ? (
                        <button
                          type="button"
                          onClick={() => setLightboxSrc(photo)}
                          className="group relative flex-shrink-0 h-20 w-20 overflow-hidden rounded-lg border bg-gray-50"
                        >
                          <Image src={photo} alt={productName} fill className="object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                            <ZoomIn size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ) : (
                        <div className="flex-shrink-0 h-20 w-20 rounded-lg border bg-gray-100" />
                      )}
                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{productName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{color} · Talla {size}</p>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{item.variant?.sku}</p>
                      </div>
                      {/* Qty + price */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-2xl font-bold text-gray-900">×{item.quantity}</p>
                        <p className="text-xs text-gray-400">${item.subtotal_usd.toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-3 border-t text-right text-sm font-semibold">
                Total: ${order.total_usd.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Photos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fotos del envío</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Foto 1 - required */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Foto del paquete <span className="text-red-500">*</span>
                </Label>
                <input
                  ref={foto1InputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFoto1Change}
                />
                {!foto1Preview ? (
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-300 transition-colors"
                    onClick={() => foto1InputRef.current?.click()}
                  >
                    <Upload className="mx-auto text-gray-400 mb-2" size={24} />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); foto1InputRef.current?.click(); }}
                    >
                      Seleccionar foto
                    </Button>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP — máx 20MB</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative aspect-square w-full rounded-md overflow-hidden border bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={foto1Preview}
                        alt="Preview foto 1"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="truncate max-w-[180px]">{foto1?.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1 text-gray-400 hover:text-red-500"
                        onClick={removeFoto1}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Foto 2 - optional */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Foto del recibo{" "}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <input
                  ref={foto2InputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFoto2Change}
                />
                {!foto2Preview ? (
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-300 transition-colors"
                    onClick={() => foto2InputRef.current?.click()}
                  >
                    <Upload className="mx-auto text-gray-400 mb-2" size={24} />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); foto2InputRef.current?.click(); }}
                    >
                      Seleccionar foto
                    </Button>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP — máx 20MB</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative aspect-square w-full rounded-md overflow-hidden border bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={foto2Preview}
                        alt="Preview foto 2"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="truncate max-w-[180px]">{foto2?.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1 text-gray-400 hover:text-red-500"
                        onClick={removeFoto2}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Foto 3 - optional */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Foto de la guía{" "}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <input
                  ref={foto3InputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFoto3Change}
                />
                {!foto3Preview ? (
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-300 transition-colors"
                    onClick={() => foto3InputRef.current?.click()}
                  >
                    <Upload className="mx-auto text-gray-400 mb-2" size={24} />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); foto3InputRef.current?.click(); }}
                    >
                      Seleccionar foto
                    </Button>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP — máx 20MB</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative aspect-square w-full rounded-md overflow-hidden border bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={foto3Preview}
                        alt="Preview foto 3"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="truncate max-w-[180px]">{foto3?.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1 text-gray-400 hover:text-red-500"
                        onClick={removeFoto3}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tracking */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tracking" className="text-sm font-medium">
                  Número de tracking{" "}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id="tracking"
                  placeholder="Ej. MRW123456"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notas" className="text-sm font-medium">
                  Notas{" "}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Textarea
                  id="notas"
                  placeholder="Observaciones del paquete..."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle size={16} />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Submit */}
          <Button
            className="w-full"
            size="lg"
            disabled={!foto1 || submitting}
            onClick={handleConfirm}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Confirmando envío...
              </>
            ) : (
              "Confirmar envío"
            )}
          </Button>
          {!foto1 && (
            <p className="text-xs text-center text-gray-400">
              Selecciona la foto del paquete para continuar
            </p>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            <X size={28} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="Foto del producto"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
