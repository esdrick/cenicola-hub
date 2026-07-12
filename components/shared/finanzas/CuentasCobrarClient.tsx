"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { shortOrderNumber } from "@/lib/order-utils";
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
import { CreditCard, Loader2 } from "lucide-react";

type CuentaJSON = {
  id: string;
  description: string;
  debtor_name: string;
  amount_usd: number;
  amount_paid_usd: number;
  amount_pending: number;
  due_date: string;
  status: string;
  order: {
    id: string;
    order_number: string;
    customer_name: string;
    customer_lastname: string;
    manager: { id: string; name: string };
  } | null;
  creator: { id: string; name: string };
  created_at: string;
};

type Props = {
  data: CuentaJSON[];
};

const STATUS_LABELS: Record<string, string> = {
  pendiente:       "Pendiente",
  cobrado_parcial: "Parcial",
  cobrado:         "Cobrado",
  vencido:         "Vencido",
};

const STATUS_CLASSES: Record<string, string> = {
  pendiente:       "bg-yellow-100 text-yellow-800",
  cobrado_parcial: "bg-orange-100 text-orange-800",
  cobrado:         "bg-emerald-100 text-emerald-800",
  vencido:         "bg-red-100 text-red-800",
};

const METODOS: { value: string; label: string }[] = [
  { value: "efectivo_bs",  label: "Efectivo Bs" },
  { value: "efectivo_usd", label: "Efectivo USD" },
  { value: "transferencia", label: "Transferencia" },
  { value: "zelle",        label: "Zelle" },
  { value: "pago_movil",   label: "Pago Móvil" },
  { value: "usdt",         label: "USDT" },
];

export function CuentasCobrarClient({ data }: Props) {
  const router = useRouter();
  const [isPending, start] = useTransition();

  const [abonoTarget, setAbonoTarget] = useState<CuentaJSON | null>(null);
  const [monto,       setMonto]       = useState("");
  const [metodo,      setMetodo]      = useState("transferencia");
  const [referencia,  setReferencia]  = useState("");
  const [formError,   setFormError]   = useState<string | null>(null);

  function openAbono(cuenta: CuentaJSON) {
    setAbonoTarget(cuenta);
    setMonto("");
    setMetodo("transferencia");
    setReferencia("");
    setFormError(null);
  }

  async function handleAbono() {
    if (!abonoTarget) return;
    setFormError(null);

    if (!monto || isNaN(Number(monto)) || Number(monto) <= 0) {
      setFormError("Ingresa un monto válido");
      return;
    }
    if (Number(monto) > abonoTarget.amount_pending) {
      setFormError(`El abono no puede ser mayor al pendiente ($${abonoTarget.amount_pending.toFixed(2)})`);
      return;
    }
    if (metodo !== "efectivo_bs" && metodo !== "efectivo_usd" && !referencia.trim()) {
      setFormError("La referencia es requerida para este método de pago");
      return;
    }

    start(async () => {
      try {
        const res = await fetch(
          `/api/finanzas/cuentas-cobrar/${abonoTarget.id}/abonar`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              monto: Number(monto),
              metodo_pago: metodo,
              referencia: referencia.trim() || null,
            }),
          }
        );
        const json = await res.json();
        if (!res.ok) {
          setFormError(json.error ?? "Error al registrar abono");
          return;
        }
        setAbonoTarget(null);
        router.refresh();
      } catch {
        setFormError("Error de conexión");
      }
    });
  }

  const totalPendiente = data.reduce((s, c) => s + c.amount_pending, 0);

  return (
    <div className="space-y-5">
      {/* Table */}
      <div className="rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold text-gray-900">
            Cuentas por cobrar pendientes
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({data.length})
            </span>
          </h2>
          <span className="text-sm font-semibold text-amber-600">
            Saldo pendiente: ${totalPendiente.toFixed(2)}
          </span>
        </div>

        {data.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No hay cuentas por cobrar pendientes.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Cliente / Deudor</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>Gestionó</TableHead>
                <TableHead className="text-right">Monto total</TableHead>
                <TableHead className="text-right">Abonado</TableHead>
                <TableHead className="text-right">Saldo pendiente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="text-center">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <p className="text-sm font-medium">{c.debtor_name}</p>
                    {c.order && (
                      <p className="text-xs text-gray-400">
                        {c.order.customer_name} {c.order.customer_lastname}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">{c.description}</p>
                  </TableCell>
                  <TableCell>
                    {c.order ? (
                      <span className="font-mono text-xs text-blue-600">
                        {shortOrderNumber(c.order.order_number)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-700">
                    {c.order?.manager.name ?? (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    ${c.amount_usd.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-emerald-700">
                    ${c.amount_paid_usd.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold text-amber-700">
                    ${c.amount_pending.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs border-0 ${STATUS_CLASSES[c.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500" suppressHydrationWarning>
                    {new Date(c.created_at).toLocaleDateString("es-VE")}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => openAbono(c)}
                    >
                      <CreditCard size={12} className="mr-1" />
                      Abonar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Abono dialog */}
      <Dialog open={abonoTarget !== null} onOpenChange={(o) => !o && setAbonoTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar abono</DialogTitle>
            <DialogDescription>
              Cliente: <strong>{abonoTarget?.debtor_name}</strong>
              <br />
              Saldo pendiente:{" "}
              <strong className="text-amber-700">
                ${abonoTarget?.amount_pending.toFixed(2)}
              </strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {(() => {
              const num = Number(monto);
              const montoError =
                monto && (isNaN(num) || num <= 0)
                  ? "Ingresa un monto válido"
                  : monto && abonoTarget && num > abonoTarget.amount_pending
                  ? `No puede superar el saldo pendiente ($${abonoTarget.amount_pending.toFixed(2)})`
                  : null;
              return (
                <div className="space-y-1">
                  <Label>Monto del abono (USD) *</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={abonoTarget?.amount_pending}
                    value={monto}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="0.00"
                    disabled={isPending}
                    className={montoError ? "border-red-400 focus-visible:ring-red-400" : ""}
                  />
                  {montoError && (
                    <p className="text-xs text-red-600">{montoError}</p>
                  )}
                </div>
              );
            })()}
            <div className="space-y-1">
              <Label>Método de pago *</Label>
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
                disabled={isPending}
              >
                {METODOS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Referencia {metodo !== "efectivo_bs" && metodo !== "efectivo_usd" ? "*" : "(opcional)"}</Label>
              <Input
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Número de referencia"
                disabled={isPending}
              />
            </div>

            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAbonoTarget(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleAbono}
              disabled={
                isPending ||
                !monto ||
                isNaN(Number(monto)) ||
                Number(monto) <= 0 ||
                (abonoTarget !== null && Number(monto) > abonoTarget.amount_pending)
              }
            >
              {isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
              Registrar abono
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
