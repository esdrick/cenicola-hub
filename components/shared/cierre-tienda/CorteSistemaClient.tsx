"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Loader2 } from "lucide-react";
import { dateInputValue, formatFechaCorta } from "./cierre-format";

type Props = { corteActivo: string | null };

export function CorteSistemaClient({ corteActivo }: Props) {
  const router = useRouter();
  const todayStr = dateInputValue(new Date());

  const [fecha, setFecha] = useState(todayStr);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleConfirm() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/cierre-sistema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Error al guardar el corte");
        setSaving(false);
        return;
      }
      setConfirmOpen(false);
      setSaving(false);
      router.refresh();
    } catch {
      setSaveError("Error de conexión");
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Corte de Sistema</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-600">
          {corteActivo
            ? <>Corte activo: <span className="font-semibold text-gray-900">{formatFechaCorta(corteActivo)}</span>. Ventas, Pagos y Envíos muestran por defecto solo lo resuelto desde esa fecha.</>
            : "Sin corte configurado — todas las vistas muestran el historial completo por defecto."}
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-gray-500">Nueva fecha de corte</Label>
            <Input
              type="date"
              value={fecha}
              max={todayStr}
              onChange={(e) => setFecha(e.target.value)}
              className="w-40 appearance-none text-sm"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={() => setConfirmOpen(true)} disabled={!fecha}>
          Confirmar Corte de Sistema
        </Button>
      </CardFooter>

      <Dialog open={confirmOpen} onOpenChange={(v) => !saving && setConfirmOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Confirmar corte de sistema al {formatFechaCorta(new Date(`${fecha}T00:00:00`).toISOString())}?</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm text-gray-600">
            <p>Esta acción:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Hace que Ventas, Pagos (verificados) y Envíos (historial) muestren por defecto solo lo resuelto desde esta fecha</li>
              <li>Órdenes aún pendientes o en curso siguen visibles sin importar su fecha</li>
              <li>Todo lo anterior sigue disponible con &quot;Ver Historial&quot;</li>
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
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Sí, confirmar corte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
