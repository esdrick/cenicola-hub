"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, X, AlertCircle, Loader2 } from "lucide-react";
import { optimizeImage, validateImageFile } from "@/lib/image-optimizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const [foto1Preview, setFoto1Preview] = useState<string | null>(null);
  const [foto2Preview, setFoto2Preview] = useState<string | null>(null);
  const [tracking, setTracking] = useState("");
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const foto1InputRef = useRef<HTMLInputElement>(null);
  const foto2InputRef = useRef<HTMLInputElement>(null);

  // Revoke object URLs on cleanup
  useEffect(() => {
    return () => {
      if (foto1Preview) URL.revokeObjectURL(foto1Preview);
      if (foto2Preview) URL.revokeObjectURL(foto2Preview);
    };
  }, [foto1Preview, foto2Preview]);

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

  async function handleConfirm() {
    if (!foto1) return;
    setSubmitting(true);
    setError(null);

    try {
      // Step 1: Upload photos
      const fd = new FormData();
      fd.append("foto1", foto1);
      if (foto2) fd.append("foto2", foto2);

      const fotosRes = await fetch(`/api/embalaje/${order.id}/fotos`, {
        method: "POST",
        body: fd,
      });

      if (!fotosRes.ok) {
        const data = await fotosRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Error al subir las fotos");
      }

      const { foto1Url, foto2Url } = await fotosRes.json();

      // Step 2: Confirm shipment
      const confirmarRes = await fetch(`/api/embalaje/${order.id}/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foto1Url,
          foto2Url: foto2Url ?? undefined,
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
            <CardHeader>
              <CardTitle className="text-base">Información del cliente</CardTitle>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Talla</TableHead>
                    <TableHead className="text-center">Cant.</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => {
                    const snap = item.variant_snapshot as Record<string, unknown> | null;
                    const productName = item.variant?.product?.name ?? (snap?.product_name as string | undefined) ?? "—";
                    const color = (item.variant?.product?.color ?? (snap?.color as string | undefined)) ?? "—";
                    const size = item.variant?.size ?? (snap?.size as string | undefined) ?? "—";
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{productName}</TableCell>
                        <TableCell>{color}</TableCell>
                        <TableCell>{size}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">${item.unit_price_usd.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${item.subtotal_usd.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
    </div>
  );
}
