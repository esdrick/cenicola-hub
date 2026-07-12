"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2, XCircle, AlertTriangle, TriangleAlert,
  Loader2, ExternalLink, ArrowLeft, Check, X,
} from "lucide-react";
import Link from "next/link";
import type { PagoOrdenDetailJSON } from "@/types";
import type { PaymentType } from "@/app/generated/prisma/client";

const METODO_LABELS: Record<PaymentType, string> = {
  efectivo_bs:   "Efectivo Bs",
  efectivo_usd:  "Efectivo USD",
  transferencia: "Transferencia",
  zelle:         "Zelle",
  pago_movil:    "Pago Móvil",
  usdt:          "USDT",
};

const METODO_CLASSES: Record<PaymentType, string> = {
  efectivo_bs:   "bg-emerald-100 text-emerald-800",
  efectivo_usd:  "bg-teal-100 text-teal-800",
  transferencia: "bg-blue-100 text-blue-800",
  zelle:         "bg-violet-100 text-violet-800",
  pago_movil:    "bg-orange-100 text-orange-800",
  usdt:          "bg-yellow-100 text-yellow-800",
};

function isBcvType(pt: PaymentType): boolean {
  return pt !== "zelle" && pt !== "usdt" && pt !== "efectivo_usd";
}

// ─── Dialog state types ───────────────────────────────────────────────────────

type GlobalDialog = "verify-all" | "reject-all" | null;
type PaymentAction = { type: "verify" | "reject"; paymentId: string } | null;

// ─── Main component ───────────────────────────────────────────────────────────

type Props = { order: PagoOrdenDetailJSON };

export function PagoDetailClient({ order }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, start] = useTransition();

  // Global dialogs
  const [globalDialog, setGlobalDialog]     = useState<GlobalDialog>(null);
  const [globalMotivo, setGlobalMotivo]     = useState("");

  // Per-payment dialogs
  const [paymentAction, setPaymentAction]   = useState<PaymentAction>(null);
  const [paymentMotivo, setPaymentMotivo]   = useState("");
  const [processingId, setProcessingId]     = useState<string | null>(null);

  const [apiError, setApiError]             = useState<string | null>(null);

  // ─── Derived values ─────────────────────────────────────────────────────────

  const totalUsd = order.total_usd;

  const paidUsd = order.payments
    .filter((p) => p.status !== "rechazado")
    .reduce((s, p) => s + p.amount_usd, 0);

  const pendingPayments = order.payments.filter((p) => p.status === "pendiente");
  const pendingUsd      = pendingPayments.reduce((s, p) => s + p.amount_usd, 0);

  const debtUsd     = Math.max(0, totalUsd - paidUsd);
  const isFullyPaid = paidUsd >= totalUsd - 0.01;

  // Only orders actively awaiting payment allow verify/reject actions
  const isActionable = order.status === "pendiente_pago" || order.status === "pago_parcial";

  // Global verify: all pending payments together cover the remaining balance
  const canVerifyAll = isActionable && (isFullyPaid || order.is_partial_agreed) && pendingPayments.length > 0;

  const hasDuplicates = order.payments.some((p) => p.duplicate_order_number !== null);

  // ─── Global actions ──────────────────────────────────────────────────────────

  function openGlobal(type: GlobalDialog) {
    setApiError(null);
    if (type === "reject-all") setGlobalMotivo("");
    setGlobalDialog(type);
  }

  async function handleVerifyAll() {
    setApiError(null);
    start(async () => {
      try {
        const res = await fetch(`/api/pagos/${order.id}/verificar`, { method: "POST" });
        const json = await res.json();
        if (!res.ok) {
          setApiError(json.error ?? "Error al verificar los pagos");
          setGlobalDialog(null);
          return;
        }
        router.push("/dashboard/pagos");
        router.refresh();
      } catch {
        setApiError("Error de conexión");
        setGlobalDialog(null);
      }
    });
  }

  async function handleRejectAll() {
    if (!globalMotivo.trim()) return;
    setApiError(null);
    start(async () => {
      try {
        const res = await fetch(`/api/pagos/${order.id}/rechazar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo: globalMotivo.trim() }),
        });
        const json = await res.json();
        if (!res.ok) {
          setApiError(json.error ?? "Error al rechazar los pagos");
          setGlobalDialog(null);
          return;
        }
        router.push("/dashboard/pagos");
        router.refresh();
      } catch {
        setApiError("Error de conexión");
        setGlobalDialog(null);
      }
    });
  }

  // ─── Per-payment actions ─────────────────────────────────────────────────────

  function openPaymentAction(type: "verify" | "reject", paymentId: string) {
    setApiError(null);
    if (type === "reject") setPaymentMotivo("");
    setPaymentAction({ type, paymentId });
  }

  async function handleVerifyPayment() {
    if (!paymentAction || paymentAction.type !== "verify") return;
    const paymentId = paymentAction.paymentId;
    setApiError(null);
    setProcessingId(paymentId);
    setPaymentAction(null);

    start(async () => {
      try {
        const res = await fetch(
          `/api/pagos/${order.id}/pago/${paymentId}/verificar`,
          { method: "POST" }
        );
        const json = await res.json();
        if (!res.ok) {
          setApiError(json.error ?? "Error al verificar el pago");
          setProcessingId(null);
          return;
        }
        if (json.advanced) {
          router.push("/dashboard/pagos");
          router.refresh();
        } else {
          router.refresh();
          setProcessingId(null);
        }
      } catch {
        setApiError("Error de conexión");
        setProcessingId(null);
      }
    });
  }

  async function handleRejectPayment() {
    if (!paymentAction || paymentAction.type !== "reject") return;
    if (!paymentMotivo.trim()) return;
    const paymentId = paymentAction.paymentId;
    setApiError(null);
    setProcessingId(paymentId);
    setPaymentAction(null);

    start(async () => {
      try {
        const res = await fetch(
          `/api/pagos/${order.id}/pago/${paymentId}/rechazar`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ motivo: paymentMotivo.trim() }),
          }
        );
        const json = await res.json();
        if (!res.ok) {
          setApiError(json.error ?? "Error al rechazar el pago");
          setProcessingId(null);
          return;
        }
        router.refresh();
        setProcessingId(null);
      } catch {
        setApiError("Error de conexión");
        setProcessingId(null);
      }
    });
  }

  const isProcessing = isPending || processingId !== null;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link
          href={sp.get("from") ?? (isActionable ? "/dashboard/pagos" : "/dashboard/pagos?tab=verificados")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 w-fit"
        >
          <ArrowLeft size={15} />
          Volver a Pagos
        </Link>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Verificación de pago</h1>
          <p className="mt-0.5 font-mono text-sm text-gray-500">{order.order_number}</p>
        </div>
        <span className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
          order.status === "pago_parcial"    ? "bg-orange-100 text-orange-800"  :
          order.status === "pendiente_pago"  ? "bg-yellow-100 text-yellow-800"  :
          order.status === "completada"      ? "bg-emerald-100 text-emerald-800" :
          order.status === "en_embalaje"     ? "bg-blue-100 text-blue-800"      :
          order.status === "enviada"         ? "bg-indigo-100 text-indigo-800"  :
          order.status === "cancelada"       ? "bg-red-100 text-red-700"        :
                                               "bg-gray-100 text-gray-700"
        }`}>
          {{
            pendiente_pago:  "Pendiente pago",
            pago_parcial:    "Pago parcial",
            pago_verificado: "Pago verificado",
            en_embalaje:     "En embalaje",
            enviada:         "Enviada",
            completada:      "Completada",
            cancelada:       "Cancelada",
          }[order.status] ?? order.status}
        </span>
      </div>

      {/* Global error */}
      {apiError && (
        <Alert variant="destructive">
          <AlertTriangle size={16} />
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      )}

      {/* Duplicate reference warning */}
      {hasDuplicates && (
        <Alert className="border-red-300 bg-red-50">
          <TriangleAlert size={16} className="text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Atención:</strong> Uno o más pagos tienen referencias duplicadas en otras órdenes.
          </AlertDescription>
        </Alert>
      )}

      {/* Partial payment alerts — only shown while the order is still awaiting payment */}
      {isActionable && !isFullyPaid && order.is_partial_agreed && (
        <Alert className="border-orange-300 bg-orange-50">
          <AlertTriangle size={16} className="text-orange-600" />
          <AlertDescription className="text-orange-800">
            Pago parcial acordado. Saldo pendiente: <strong>${debtUsd.toFixed(2)}</strong>. Se registrará una cuenta por cobrar.
          </AlertDescription>
        </Alert>
      )}
      {isActionable && !isFullyPaid && !order.is_partial_agreed && pendingUsd < totalUsd - paidUsd + pendingUsd - 0.01 && (
        <Alert className="border-red-300 bg-red-50">
          <XCircle size={16} className="text-red-600" />
          <AlertDescription className="text-red-800">
            Los pagos pendientes no cubren el total. Monto sin cubrir: <strong>${debtUsd.toFixed(2)}</strong>.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left col ── */}
        <div className="space-y-4 lg:col-span-2">
          {/* Order info */}
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 font-semibold text-gray-900">Información de la orden</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Cliente</p>
                <p className="font-medium">{order.customer_name} {order.customer_lastname}</p>
                <p className="text-gray-500">{order.customer_id_doc}</p>
              </div>
              <div>
                <p className="text-gray-500">Canal</p>
                <p className="font-medium capitalize">{order.channel}</p>
              </div>
              {order.address && (
                <div className="col-span-2">
                  <p className="text-gray-500">Dirección</p>
                  <p className="font-medium">{order.address}</p>
                  {order.shipping_company && <p className="text-gray-400">{order.shipping_company}</p>}
                </div>
              )}
              {order.notes && (
                <div className="col-span-2">
                  <p className="text-gray-500">Notas</p>
                  <p className="font-medium">{order.notes}</p>
                </div>
              )}
              <div>
                <p className="text-gray-500">Creado por</p>
                <p className="font-medium">{order.creator.name}</p>
              </div>
              <div>
                <p className="text-gray-500">Fecha</p>
                <p className="font-medium" suppressHydrationWarning>
                  {new Date(order.created_at).toLocaleDateString("es-VE", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Products — cards on mobile, table on sm+ */}
          <div className="rounded-xl border bg-white">
            <div className="border-b px-4 sm:px-5 py-3">
              <h2 className="font-semibold text-gray-900">Productos</h2>
            </div>

            {/* Mobile: card list */}
            <div className="sm:hidden divide-y">
              {order.items.map((item) => {
                const snap = item.variant_snapshot as Record<string, unknown> | null;
                const name  = item.variant?.product?.name ?? (snap?.product_name as string | undefined) ?? "—";
                const color = item.variant?.product?.color ?? (snap?.color as string | undefined) ?? null;
                const size  = item.variant?.size ?? (snap?.size as string | undefined) ?? "—";
                return (
                  <div key={item.id} className="flex items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                      <p className="text-xs text-gray-400">
                        {[color, `Talla ${size}`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold">${item.subtotal_usd.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">{item.quantity} × ${item.unit_price_usd.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Talla</TableHead>
                    <TableHead className="text-center">Cant.</TableHead>
                    <TableHead className="text-right">P/U</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => {
                    const snap = item.variant_snapshot as Record<string, unknown> | null;
                    const name  = item.variant?.product?.name ?? (snap?.product_name as string | undefined) ?? "—";
                    const color = item.variant?.product?.color ?? (snap?.color as string | undefined) ?? null;
                    const size  = item.variant?.size ?? (snap?.size as string | undefined) ?? "—";
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{name}</p>
                          {color && <p className="text-xs text-gray-400">{color}</p>}
                        </TableCell>
                        <TableCell className="text-center text-sm">{size}</TableCell>
                        <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                        <TableCell className="text-right text-sm">${item.unit_price_usd.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold text-sm">${item.subtotal_usd.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Payments — cards on mobile, table on sm+ */}
          <div className="rounded-xl border bg-white">
            <div className="border-b px-4 sm:px-5 py-3">
              <h2 className="font-semibold text-gray-900">
                Pagos registrados
                {isActionable && (
                  <span className="ml-2 hidden sm:inline text-sm font-normal text-gray-500">
                    — verifica o rechaza cada pago individualmente
                  </span>
                )}
              </h2>
            </div>

            {/* Mobile: card list */}
            <div className="sm:hidden divide-y">
              {order.payments.map((p) => {
                const isProcessingThis = processingId === p.id;
                const cardBg =
                  p.status === "rechazado"  ? "bg-red-50/70"
                  : p.status === "verificado" ? "bg-emerald-50/50"
                  : "";
                const rate = p.exchange_rate?.usd_to_ves ?? null;
                const bsAmount = isBcvType(p.payment_type) && p.status !== "rechazado"
                  ? (p.amount_ves ?? (rate !== null ? p.amount_usd * rate : null))
                  : null;
                return (
                  <div key={p.id} className={`px-4 py-3 space-y-2 ${cardBg}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <Badge className={`text-xs ${METODO_CLASSES[p.payment_type]}`} variant="outline">
                          {METODO_LABELS[p.payment_type]}
                        </Badge>
                        <div className="text-[10px] font-medium">
                          {p.status === "verificado" && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-700">
                              <Check size={10} /> Verificado
                            </span>
                          )}
                          {p.status === "rechazado" && (
                            <span className="inline-flex items-center gap-0.5 text-red-600">
                              <X size={10} /> Rechazado
                            </span>
                          )}
                          {p.status === "pendiente" && (
                            <span className="text-yellow-700">Pendiente</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${p.status === "rechazado" ? "line-through text-gray-400" : ""}`}>
                          ${p.amount_usd.toFixed(2)}
                        </p>
                        {bsAmount !== null && (
                          <p className="text-xs text-gray-500">Bs {bsAmount.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        )}
                        {rate !== null && isBcvType(p.payment_type) && p.status !== "rechazado" && (
                          <p className="text-[10px] text-gray-400">tasa Bs {Number(rate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-0.5 text-xs text-gray-500">
                      {p.reference && p.reference !== "EFECTIVO" && (
                        <p className="font-mono text-gray-700">{p.reference}</p>
                      )}
                      {p.duplicate_order_number && (
                        <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                          ⚠ Duplicado en #{p.duplicate_order_number}
                        </span>
                      )}
                      <p>
                        {p.payment_date}
                        {p.payment_time && <span className="ml-1 text-gray-400">{p.payment_time}</span>}
                      </p>
                    </div>

                    {p.status === "rechazado" && p.rejection_reason && (
                      <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                        <strong>Motivo:</strong> {p.rejection_reason}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-0.5">
                      {p.payment_photo ? (
                        <a href={p.payment_photo} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <ExternalLink size={12} /> Ver comprobante
                        </a>
                      ) : <span />}
                      {isActionable && p.status === "pendiente" && (
                        <div className="flex items-center gap-1.5">
                          {isProcessingThis ? (
                            <Loader2 size={14} className="animate-spin text-gray-400" />
                          ) : (
                            <>
                              <button
                                disabled={isProcessing}
                                onClick={() => openPaymentAction("verify", p.id)}
                                className="flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                              >
                                <Check size={11} /> Verificar
                              </button>
                              <button
                                disabled={isProcessing}
                                onClick={() => openPaymentAction("reject", p.id)}
                                className="flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100 disabled:opacity-40"
                              >
                                <X size={11} /> Rechazar
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Método</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead className="text-right">Monto USD</TableHead>
                    <TableHead>Tasa BCV</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Comprobante</TableHead>
                    <TableHead className="text-center">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.payments.map((p) => {
                    const isProcessingThis = processingId === p.id;
                    const rowBg =
                      p.status === "rechazado" ? "bg-red-50/70"
                      : p.status === "verificado" ? "bg-emerald-50/50"
                      : "";
                    const rate = p.exchange_rate?.usd_to_ves ?? null;
                    const bsAmount = isBcvType(p.payment_type) && p.status !== "rechazado"
                      ? (p.amount_ves ?? (rate !== null ? p.amount_usd * rate : null))
                      : null;

                    return (
                      <TableRow key={p.id} className={rowBg}>
                        <TableCell>
                          <Badge className={`text-xs ${METODO_CLASSES[p.payment_type]}`} variant="outline">
                            {METODO_LABELS[p.payment_type]}
                          </Badge>
                          <div className="mt-0.5">
                            {p.status === "verificado" && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700">
                                <Check size={10} /> Verificado
                              </span>
                            )}
                            {p.status === "rechazado" && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-600">
                                <X size={10} /> Rechazado
                              </span>
                            )}
                            {p.status === "pendiente" && (
                              <span className="text-[10px] font-medium text-yellow-700">Pendiente</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-xs">{p.reference}</span>
                            {p.duplicate_order_number && (
                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                                ⚠ Duplicado en #{p.duplicate_order_number}
                              </span>
                            )}
                            {p.status === "rechazado" && p.rejection_reason && (
                              <span className="mt-0.5 rounded bg-red-50 px-1.5 py-1 text-xs text-red-700 border border-red-200">
                                <strong>Motivo:</strong> {p.rejection_reason}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          <span className={p.status === "rechazado" ? "line-through text-gray-400" : ""}>
                            ${p.amount_usd.toFixed(2)}
                          </span>
                          {bsAmount !== null && (
                            <p className="text-xs font-normal text-gray-500">Bs {bsAmount.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {isBcvType(p.payment_type) && rate !== null
                            ? `Bs ${Number(rate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-gray-600">
                          {p.payment_date}
                          {p.payment_time && <span className="ml-1 text-gray-400">{p.payment_time}</span>}
                        </TableCell>
                        <TableCell>
                          {p.payment_photo ? (
                            <a href={p.payment_photo} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                              <ExternalLink size={12} /> Ver
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {isActionable && p.status === "pendiente" && (
                            <div className="flex items-center justify-center gap-1">
                              {isProcessingThis ? (
                                <Loader2 size={14} className="animate-spin text-gray-400" />
                              ) : (
                                <>
                                  <button
                                    title="Verificar este pago"
                                    disabled={isProcessing}
                                    onClick={() => openPaymentAction("verify", p.id)}
                                    className="rounded-md border border-emerald-300 bg-emerald-50 p-1 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                                  >
                                    <Check size={13} />
                                  </button>
                                  <button
                                    title="Rechazar este pago"
                                    disabled={isProcessing}
                                    onClick={() => openPaymentAction("reject", p.id)}
                                    className="rounded-md border border-red-300 bg-red-50 p-1 text-red-600 hover:bg-red-100 disabled:opacity-40"
                                  >
                                    <X size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* ── Right panel: totals + global actions ── */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 font-semibold text-gray-900">Resumen de pago</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total orden</span>
                <span className="font-semibold">${totalUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Pagado / pendiente</span>
                <span className={`font-semibold ${isFullyPaid ? "text-emerald-600" : "text-orange-600"}`}>
                  ${paidUsd.toFixed(2)}
                </span>
              </div>
              {pendingPayments.length > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">En espera de verificación</span>
                  <span className="text-yellow-700">${pendingUsd.toFixed(2)}</span>
                </div>
              )}
              {!isFullyPaid && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Saldo sin cubrir</span>
                  <span className="font-semibold text-red-600">${debtUsd.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-gray-500">Pago parcial acordado</span>
                <span className={`font-medium ${order.is_partial_agreed ? "text-blue-600" : "text-gray-400"}`}>
                  {order.is_partial_agreed ? "Sí" : "No"}
                </span>
              </div>
            </div>

            {isActionable && (
              <>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Acciones globales (todos los pendientes)</p>
                  <Button
                    className="w-full"
                    disabled={!canVerifyAll || isProcessing}
                    onClick={() => openGlobal("verify-all")}
                  >
                    {isPending && globalDialog === "verify-all"
                      ? <Loader2 size={15} className="mr-2 animate-spin" />
                      : <CheckCircle2 size={15} className="mr-2" />
                    }
                    Verificar todos
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={pendingPayments.length === 0 || isProcessing}
                    onClick={() => openGlobal("reject-all")}
                  >
                    <XCircle size={15} className="mr-2" />
                    Rechazar todos
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Global: Verify all dialog ─── */}
      <Dialog open={globalDialog === "verify-all"} onOpenChange={(o) => !o && setGlobalDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Verificar todos los pagos pendientes?</DialogTitle>
            <DialogDescription>
              Se verificarán <strong>{pendingPayments.length}</strong> pago
              {pendingPayments.length !== 1 ? "s" : ""} de la orden{" "}
              <strong>{order.order_number}</strong> por un total de{" "}
              <strong>${pendingUsd.toFixed(2)}</strong>.
              {order.channel === "online"
                ? " La orden pasará a En Embalaje."
                : " La orden se marcará como Completada."}
              {!isFullyPaid && (
                <span className="mt-2 block text-orange-700">
                  Se registrará cuenta por cobrar por ${debtUsd.toFixed(2)}.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGlobalDialog(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleVerifyAll} disabled={isPending}>
              {isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Global: Reject all dialog ─── */}
      <Dialog open={globalDialog === "reject-all"} onOpenChange={(o) => !o && setGlobalDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar todos los pagos pendientes</DialogTitle>
            <DialogDescription>
              Se rechazarán <strong>{pendingPayments.length}</strong> pago
              {pendingPayments.length !== 1 ? "s" : ""} de la orden{" "}
              <strong>{order.order_number}</strong>. La orden vuelve a Pendiente pago.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Motivo del rechazo *</Label>
            <Textarea
              value={globalMotivo}
              onChange={(e) => setGlobalMotivo(e.target.value)}
              placeholder="Ej: Referencias inválidas, montos no coinciden…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGlobalDialog(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRejectAll}
              disabled={isPending || !globalMotivo.trim()}>
              {isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
              Rechazar todos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Per-payment: Verify dialog ─── */}
      <Dialog
        open={paymentAction?.type === "verify"}
        onOpenChange={(o) => !o && setPaymentAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Verificar este pago?</DialogTitle>
            <DialogDescription>
              {(() => {
                const p = order.payments.find((x) => x.id === paymentAction?.paymentId);
                if (!p) return null;

                // Match the API: per-payment verify only advances when fully paid.
                // is_partial_agreed is handled by the global "Verificar todos" action.
                const alreadyVerified = order.payments
                  .filter((x) => x.status === "verificado")
                  .reduce((s, x) => s + x.amount_usd, 0);
                const willBeVerified = alreadyVerified + p.amount_usd;
                const willAdvance = willBeVerified >= totalUsd - 0.01;
                const stillMissing = Math.max(0, totalUsd - willBeVerified);

                return (
                  <>
                    Pago de <strong>${p.amount_usd.toFixed(2)}</strong> via{" "}
                    <strong>{METODO_LABELS[p.payment_type]}</strong>
                    {p.reference !== "EFECTIVO" && (
                      <> · ref: <span className="font-mono">{p.reference}</span></>
                    )}.
                    {willAdvance ? (
                      <span className="mt-2 block text-emerald-700">
                        El total verificado alcanza <strong>${willBeVerified.toFixed(2)}</strong> de{" "}
                        <strong>${totalUsd.toFixed(2)}</strong>. La orden avanzará a{" "}
                        {order.channel === "online" ? "En Embalaje" : "Completada"}.
                      </span>
                    ) : (
                      <span className="mt-2 block text-orange-700">
                        El pago quedará verificado. Total verificado:{" "}
                        <strong>${willBeVerified.toFixed(2)}</strong> de{" "}
                        <strong>${totalUsd.toFixed(2)}</strong> — aún faltan{" "}
                        <strong>${stillMissing.toFixed(2)}</strong>. La orden permanecerá pendiente.
                      </span>
                    )}
                  </>
                );
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentAction(null)}>
              Cancelar
            </Button>
            <Button onClick={handleVerifyPayment}>
              <Check size={14} className="mr-2" />
              Verificar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Per-payment: Reject dialog ─── */}
      <Dialog
        open={paymentAction?.type === "reject"}
        onOpenChange={(o) => !o && setPaymentAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar pago</DialogTitle>
            <DialogDescription>
              {(() => {
                const p = order.payments.find((x) => x.id === paymentAction?.paymentId);
                if (!p) return null;
                return (
                  <>
                    Pago de <strong>${p.amount_usd.toFixed(2)}</strong> via{" "}
                    <strong>{METODO_LABELS[p.payment_type]}</strong>
                    {p.reference !== "EFECTIVO" && (
                      <> · ref: <span className="font-mono">{p.reference}</span></>
                    )}.
                    {" "}El motivo le será visible a la vendedora para que corrija.
                  </>
                );
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Motivo del rechazo *</Label>
            <Textarea
              value={paymentMotivo}
              onChange={(e) => setPaymentMotivo(e.target.value)}
              placeholder="Ej: Referencia no encontrada, monto no coincide…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentAction(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRejectPayment}
              disabled={!paymentMotivo.trim()}>
              <X size={14} className="mr-2" />
              Rechazar este pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
