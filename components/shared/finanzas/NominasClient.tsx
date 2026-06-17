"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Loader2 } from "lucide-react";

const ROL_LABELS: Record<string, string> = {
  vendedora_online: "Online",
  vendedora_tienda: "Tienda",
};

type VendedoraStats = {
  userId: string;
  nombre: string;
  rol: string;
  ordenes_count: number;
  total_ventas: number;
  comision: number;
  status: string;
  paid_at: string | null;
};

type Props = {
  data: VendedoraStats[];
  mes: number;
  anio: number;
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function NominasClient({ data, mes, anio }: Props) {
  const router = useRouter();
  const [isPending, start] = useTransition();

  const [selectedMes, setSelectedMes] = useState(mes);
  const [selectedAnio, setSelectedAnio] = useState(anio);

  const [comisiones, setComisiones] = useState<Record<string, string>>(
    Object.fromEntries(data.map((d) => [d.userId, String(d.comision)]))
  );

  const [confirmRow, setConfirmRow] = useState<VendedoraStats | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  function applyFilter() {
    router.push(
      `/dashboard/finanzas/nominas?mes=${selectedMes}&anio=${selectedAnio}`
    );
  }

  function openConfirm(row: VendedoraStats) {
    setApiError(null);
    setConfirmRow(row);
  }

  async function handlePagar() {
    if (!confirmRow) return;
    setApiError(null);
    setProcessingId(confirmRow.userId);
    setConfirmRow(null);

    start(async () => {
      try {
        const res = await fetch(
          `/api/finanzas/nominas/${confirmRow.userId}/pagar`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mes,
              anio,
              comision: parseFloat(comisiones[confirmRow.userId] ?? "0") || 0,
              total_ventas: confirmRow.total_ventas,
            }),
          }
        );
        const json = await res.json();
        if (!res.ok) {
          setApiError(json.error ?? "Error al marcar como pagada");
        } else {
          router.refresh();
        }
      } catch {
        setApiError("Error de conexión");
      } finally {
        setProcessingId(null);
      }
    });
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-5">
      {/* Selector de período */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-white p-4">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Mes</Label>
          <select
            value={selectedMes}
            onChange={(e) => setSelectedMes(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm"
          >
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Año</Label>
          <select
            value={selectedAnio}
            onChange={(e) => setSelectedAnio(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <Button size="sm" onClick={applyFilter}>
          Ver período
        </Button>
      </div>

      {apiError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-xl border bg-white">
        <div className="border-b px-5 py-3">
          <h2 className="font-semibold text-gray-900">
            Nóminas — {MESES[mes - 1]} {anio}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Solo órdenes en estado completada
          </p>
        </div>

        {data.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No hay vendedoras activas registradas.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Vendedora</TableHead>
                <TableHead className="text-center">Órdenes</TableHead>
                <TableHead className="text-right">Total vendido</TableHead>
                <TableHead className="text-right w-36">Comisión (USD)</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-center">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => {
                const isPaid = row.status === "pagada";
                const isProcessingThis = processingId === row.userId;

                return (
                  <TableRow key={row.userId}>
                    <TableCell>
                      <p className="font-medium text-sm">{row.nombre}</p>
                      <p className="text-xs text-gray-400">{ROL_LABELS[row.rol] ?? row.rol}</p>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {row.ordenes_count}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      ${row.total_ventas.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {isPaid ? (
                        <span className="text-sm font-semibold text-gray-800">
                          ${row.comision.toFixed(2)}
                        </span>
                      ) : (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={comisiones[row.userId] ?? "0"}
                          onChange={(e) =>
                            setComisiones((prev) => ({
                              ...prev,
                              [row.userId]: e.target.value,
                            }))
                          }
                          className="w-28 ml-auto text-right text-sm"
                          disabled={isProcessingThis || isPending}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={
                          isPaid
                            ? "bg-emerald-100 text-emerald-800 border-0"
                            : "bg-yellow-100 text-yellow-800 border-0"
                        }
                      >
                        {isPaid ? "Pagada" : "Pendiente"}
                      </Badge>
                      {isPaid && row.paid_at && (
                        <p className="mt-0.5 text-[10px] text-gray-400 text-center" suppressHydrationWarning>
                          {new Date(row.paid_at).toLocaleDateString("es-VE")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {isProcessingThis ? (
                        <Loader2 size={16} className="mx-auto animate-spin text-gray-400" />
                      ) : isPaid ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7 px-3 text-xs"
                          disabled={isPending || row.ordenes_count === 0}
                          onClick={() => openConfirm(row)}
                        >
                          <CheckCircle2 size={13} className="mr-1" />
                          Marcar pagada
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Confirm dialog */}
      <Dialog open={confirmRow !== null} onOpenChange={(o) => !o && setConfirmRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pago de nómina</DialogTitle>
            <DialogDescription>
              ¿Marcar la nómina de <strong>{confirmRow?.nombre}</strong> como pagada
              para <strong>{MESES[(mes ?? 1) - 1]} {anio}</strong>?
              <br />
              Comisión a registrar:{" "}
              <strong>
                ${parseFloat(comisiones[confirmRow?.userId ?? ""] ?? "0").toFixed(2)}
              </strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRow(null)}>
              Cancelar
            </Button>
            <Button onClick={handlePagar}>
              <CheckCircle2 size={14} className="mr-2" />
              Confirmar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
