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
import { CheckCircle2, Plus, Loader2 } from "lucide-react";
import { DialogTrigger } from "@/components/ui/dialog";

type CuentaPagarJSON = {
  id: string;
  proveedor: string;
  descripcion: string;
  monto: number;
  fecha_vencimiento: string | null;
  status: string;
  paid_at: string | null;
  creator: { id: string; name: string };
  created_at: string;
};

type Props = {
  data: CuentaPagarJSON[];
};

export function CuentasPagarClient({ data }: Props) {
  const router = useRouter();
  const [isPending, start] = useTransition();

  // Form
  const [proveedor, setProveedor] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fechaVenc, setFechaVenc] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);

  // Confirm dialog
  const [confirmTarget, setConfirmTarget] = useState<CuentaPagarJSON | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!proveedor.trim()) { setFormError("Nombre del proveedor requerido"); return; }
    if (!descripcion.trim()) { setFormError("Descripción requerida"); return; }
    if (!monto || isNaN(Number(monto)) || Number(monto) <= 0) { setFormError("Monto inválido"); return; }

    start(async () => {
      try {
        const res = await fetch("/api/finanzas/cuentas-pagar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proveedor: proveedor.trim(),
            descripcion: descripcion.trim(),
            monto: Number(monto),
            fecha_vencimiento: fechaVenc || null,
          }),
        });
        const json = await res.json();
        if (!res.ok) { setFormError(json.error ?? "Error al guardar"); return; }
        setProveedor(""); setDescripcion(""); setMonto(""); setFechaVenc("");
        setCreateOpen(false);
        router.refresh();
      } catch {
        setFormError("Error de conexión");
      }
    });
  }

  async function handlePagar() {
    if (!confirmTarget) return;
    start(async () => {
      try {
        const res = await fetch(
          `/api/finanzas/cuentas-pagar/${confirmTarget.id}/pagar`,
          { method: "POST" }
        );
        const json = await res.json();
        if (!res.ok) {
          setFormError(json.error ?? "Error al marcar como pagada");
        } else {
          router.refresh();
        }
      } catch {
        setFormError("Error de conexión");
      } finally {
        setConfirmTarget(null);
      }
    });
  }

  const pendientes = data.filter((c) => c.status === "pendiente");
  const totalPendiente = pendientes.reduce((s, c) => s + c.monto, 0);

  return (
    <div className="space-y-5">
      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setFormError(null); }}>
        <DialogTrigger render={<Button className="gap-2" />}>
          <Plus size={15} /> Agregar cuenta
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar deuda a proveedor</DialogTitle>
            <DialogDescription>Completa los campos para agregar una nueva cuenta por pagar.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Proveedor *</Label>
              <Input
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Nombre del proveedor"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descripción *</Label>
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Pago de mercancía"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Monto (USD) *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={monto}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                disabled={isPending}
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label className="text-xs">Fecha de vencimiento</Label>
              <Input
                type="date"
                value={fechaVenc}
                onChange={(e) => setFechaVenc(e.target.value)}
                disabled={isPending}
                className="appearance-none"
              />
            </div>
            {formError && (
              <p className="sm:col-span-2 text-sm text-red-600">{formError}</p>
            )}
            <DialogFooter className="sm:col-span-2">
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <div className="rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold text-gray-900">
            Cuentas por pagar
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({data.length} total)
            </span>
          </h2>
          <span className="text-sm font-semibold text-orange-600">
            Pendiente: ${totalPendiente.toFixed(2)}
          </span>
        </div>

        {data.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No hay cuentas por pagar registradas.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Proveedor</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Registrado</TableHead>
                <TableHead className="text-center">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => {
                const isPaid = c.status === "pagada";
                const isOverdue =
                  !isPaid &&
                  c.fecha_vencimiento &&
                  new Date(c.fecha_vencimiento) < new Date();

                return (
                  <TableRow key={c.id} className={isPaid ? "opacity-60" : ""}>
                    <TableCell className="font-medium text-sm">{c.proveedor}</TableCell>
                    <TableCell className="text-sm text-gray-600">{c.descripcion}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      ${c.monto.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {c.fecha_vencimiento ? (
                        <span className={`text-xs ${isOverdue ? "font-semibold text-red-600" : "text-gray-500"}`} suppressHydrationWarning>
                          {new Date(c.fecha_vencimiento + "T00:00:00").toLocaleDateString("es-VE")}
                          {isOverdue && " ⚠"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs border-0 ${isPaid ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"}`}>
                        {isPaid ? "Pagada" : "Pendiente"}
                      </Badge>
                      {isPaid && c.paid_at && (
                        <p className="mt-0.5 text-[10px] text-gray-400" suppressHydrationWarning>
                          {new Date(c.paid_at).toLocaleDateString("es-VE")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500" suppressHydrationWarning>
                      {new Date(c.created_at).toLocaleDateString("es-VE")}
                    </TableCell>
                    <TableCell className="text-center">
                      {isPaid ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={isPending}
                          onClick={() => setConfirmTarget(c)}
                        >
                          <CheckCircle2 size={12} className="mr-1" />
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
      <Dialog open={confirmTarget !== null} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar cuenta como pagada</DialogTitle>
            <DialogDescription>
              ¿Confirmas que la deuda con <strong>{confirmTarget?.proveedor}</strong> por{" "}
              <strong>${confirmTarget?.monto.toFixed(2)}</strong> ha sido pagada?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTarget(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handlePagar} disabled={isPending}>
              {isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
              <CheckCircle2 size={14} className="mr-2" />
              Confirmar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
