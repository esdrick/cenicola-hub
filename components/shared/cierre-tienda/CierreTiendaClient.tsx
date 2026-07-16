"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Loader2 } from "lucide-react";
import { calcularRangoFechas } from "@/lib/cierre-tienda";
import { TIPO_CIERRE_LABELS, CANAL_LABELS, MONEDA_CLASSES, dateInputValue, formatFechaCorta, formatNumeroOrdenCorto } from "./cierre-format";
import type { CierrePreviewJSON } from "@/types";

type TipoCierre = "diario" | "semanal" | "quincenal" | "mensual";
type Canal = "tienda" | "online";

const todayStr = dateInputValue(new Date());

// calcularRangoFechas calcula el período de calendario completo (ej. mes entero) sin
// importar la fecha de hoy — si hoy cae a mitad del período, su fechaFin puede quedar en el
// futuro. Un cierre nunca debería filtrar por fechas que aún no ocurrieron, así que aquí sí
// se recorta al día de hoy (esto es solo para el prellenado de la UI, no para el cálculo
// general del período, que otros usos como la navegación por offset sí necesitan intacto).
function clampAFuturo(fecha: string): string {
  return fecha > todayStr ? todayStr : fecha;
}

// Si el admin edita Desde/Hasta a mano y el rango ya no coincide con lo que ese tipo
// generaría automáticamente, el cierre deja de ser un "Diario"/"Semanal"/etc. real — se
// guarda y se muestra como "Personalizado" en vez de seguir mostrando la etiqueta vieja.
function esPersonalizado(tipo: TipoCierre, fechaInicio: string, fechaFin: string): boolean {
  const rango = calcularRangoFechas(tipo);
  const esperadoInicio = dateInputValue(rango.fechaInicio);
  const esperadoFin = clampAFuturo(dateInputValue(rango.fechaFin));
  return fechaInicio !== esperadoInicio || fechaFin !== esperadoFin;
}

export function CierreTiendaClient() {
  const router = useRouter();

  const [tipo, setTipo] = useState<TipoCierre>("diario");
  const [canal, setCanal] = useState<Canal>("tienda");
  const initialRango = calcularRangoFechas("diario");
  const [fechaInicio, setFechaInicio] = useState(dateInputValue(initialRango.fechaInicio));
  const [fechaFin, setFechaFin] = useState(clampAFuturo(dateInputValue(initialRango.fechaFin)));

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CierrePreviewJSON | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const tipoEfectivo: TipoCierre | "personalizado" =
    esPersonalizado(tipo, fechaInicio, fechaFin) ? "personalizado" : tipo;

  function handleTipoChange(value: string | null) {
    if (!value) return;
    const next = value as TipoCierre;
    setTipo(next);
    const rango = calcularRangoFechas(next);
    setFechaInicio(dateInputValue(rango.fechaInicio));
    setFechaFin(clampAFuturo(dateInputValue(rango.fechaFin)));
    setPreview(null);
  }

  function handleCanalChange(value: string | null) {
    if (!value) return;
    setCanal(value as Canal);
    setPreview(null);
  }

  async function handlePreview() {
    setLoadingPreview(true);
    setPreviewError(null);
    setPreview(null);
    try {
      const params = new URLSearchParams({ fechaInicio, fechaFin, canal });
      const res = await fetch(`/api/cierre-tienda/preview?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setPreviewError(data.error ?? "Error al generar la vista previa");
        return;
      }
      setPreview(data);
    } catch {
      setPreviewError("Error de conexión");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleConfirm() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/cierre-tienda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: tipoEfectivo, canal, fechaInicio, fechaFin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Error al guardar el cierre");
        setSaving(false);
        return;
      }
      router.push(`/dashboard/cierre-tienda/${data.id}`);
    } catch {
      setSaveError("Error de conexión");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generar cierre</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-gray-500">Canal</Label>
            <Select value={canal} onValueChange={handleCanalChange}>
              <SelectTrigger className="w-32">
                <SelectValue>{CANAL_LABELS[canal]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tienda">Tienda</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-gray-500">Tipo de cierre</Label>
            <Select value={tipo} onValueChange={handleTipoChange}>
              <SelectTrigger className="w-40">
                <SelectValue>{TIPO_CIERRE_LABELS[tipoEfectivo]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Diario</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="quincenal">Quincenal</SelectItem>
                <SelectItem value="mensual">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-gray-500">Desde</Label>
            <Input
              type="date"
              value={fechaInicio}
              max={todayStr}
              onChange={(e) => { setFechaInicio(e.target.value); setPreview(null); }}
              className="w-40 appearance-none text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-gray-500">Hasta</Label>
            <Input
              type="date"
              value={fechaFin}
              max={todayStr}
              onChange={(e) => { setFechaFin(e.target.value); setPreview(null); }}
              className="w-40 appearance-none text-sm"
            />
          </div>

          <Button onClick={handlePreview} disabled={loadingPreview || !fechaInicio || !fechaFin}>
            {loadingPreview && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            Generar Vista Previa
          </Button>
        </CardContent>
      </Card>

      {previewError && (
        <Alert variant="destructive">
          <AlertCircle size={14} />
          <AlertDescription>{previewError}</AlertDescription>
        </Alert>
      )}

      {preview && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                Vista previa {CANAL_LABELS[canal]} · {formatFechaCorta(preview.fechaInicio)} – {formatFechaCorta(preview.fechaFin)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Orden</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Piezas</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Método de pago</TableHead>
                    <TableHead>Referencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.ordenes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-gray-400">
                        No hay órdenes elegibles en este rango
                      </TableCell>
                    </TableRow>
                  ) : (
                    preview.ordenes.map((o) => (
                      <TableRow key={o.orderId}>
                        <TableCell className="font-mono text-xs font-semibold">{formatNumeroOrdenCorto(o.numeroOrden)}</TableCell>
                        <TableCell className="text-sm">{o.clienteNombre}</TableCell>
                        <TableCell className="text-right text-sm">{o.cantidadPiezas}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">${o.monto.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className={`border-0 text-xs ${MONEDA_CLASSES[o.moneda] ?? "bg-gray-100 text-gray-700"}`}>
                            {o.moneda}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{o.metodoPago}</TableCell>
                        <TableCell className="font-mono text-xs text-gray-600">{o.referencia}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {preview.ordenes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resumen del cierre</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600">
                  Total de piezas: <span className="font-semibold text-gray-900">{preview.totalPiezas}</span>
                  {" · "}
                  {preview.ordenes.length} orden{preview.ordenes.length !== 1 ? "es" : ""}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {preview.resumenTotales.map((r) => (
                    <div key={`${r.moneda}-${r.metodoPago}`} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`border-0 text-xs ${MONEDA_CLASSES[r.moneda] ?? "bg-gray-100 text-gray-700"}`}>
                          {r.moneda}
                        </Badge>
                        <span className="text-xs text-gray-600">{r.metodoPago}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">${r.monto.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="justify-end">
                <Button onClick={() => setConfirmOpen(true)}>
                  Confirmar y Guardar Cierre
                </Button>
              </CardFooter>
            </Card>
          )}
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={(v) => !saving && setConfirmOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Confirmar cierre {TIPO_CIERRE_LABELS[tipoEfectivo]} de {CANAL_LABELS[canal]}?</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm text-gray-600">
            <p>Esta acción:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Guardará un snapshot permanente de {preview?.ordenes.length ?? 0} orden(es)</li>
              <li>Excluirá esas órdenes de cualquier cierre futuro</li>
              <li>No se puede deshacer</li>
            </ul>
          </div>

          {saveError && (
            <Alert variant="destructive">
              <AlertCircle size={14} />
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Volver
            </Button>
            <Button onClick={handleConfirm} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Sí, generar cierre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
