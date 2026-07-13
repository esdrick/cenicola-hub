export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/shared/ordenes/OrderStatusBadge";
import { CancelOrderButton } from "@/components/shared/ordenes/CancelOrderButton";
import { DevolucionForzadaButton } from "@/components/shared/ordenes/DevolucionForzadaButton";
import { AgregarPagoDialog } from "@/components/shared/ordenes/AgregarPagoDialog";
import { AgregarProductosDialog } from "@/components/shared/ordenes/AgregarProductosDialog";
import { CompletarOrdenButton } from "@/components/shared/ordenes/CompletarOrdenButton";
import { ConfirmarOrdenButton } from "@/components/shared/ordenes/ConfirmarOrdenButton";
import { OrderHistorySection } from "@/components/shared/ordenes/OrderHistorySection";
import { STATUS_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/order-utils";
import { paymentTypeToPricingMethod } from "@/lib/pricing";
import type { PaymentType } from "@/app/generated/prisma";
import { cn } from "@/lib/utils";
import { ChevronLeft, MapPin, Truck, FileText, User, Check, AlertTriangle, Package2, Hash, ExternalLink } from "lucide-react";

// ─── Status timeline ──────────────────────────────────────────────────────────
const TIMELINE_ONLINE = ["pendiente_pago", "pago_verificado", "en_embalaje", "enviada", "completada"] as const;
const TIMELINE_TIENDA = ["pendiente_pago", "pago_verificado", "completada"] as const;


function StatusTimeline({ status, channel }: { status: string; channel: string }) {
  if (status === "cancelada") {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-red-50 px-5 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        <span className="text-sm font-medium text-red-700">Orden cancelada</span>
      </div>
    );
  }

  const steps = channel === "tienda" ? TIMELINE_TIENDA : TIMELINE_ONLINE;
  // pago_parcial sits at the pago_verificado position visually
  const effectiveStatus = status === "pago_parcial" ? "pago_verificado" : status;
  const effectiveIdx = (steps as readonly string[]).indexOf(effectiveStatus);

  return (
    <div className="rounded-xl border bg-white px-5 py-4">
      {/* Mobile: vertical list */}
      <div className="flex flex-col gap-3 sm:hidden">
        {steps.map((s, i) => {
          const past    = effectiveIdx > i;
          const current = s === effectiveStatus;
          const label   = s === "pago_verificado" && status === "pago_parcial"
            ? STATUS_LABELS["pago_parcial"]
            : STATUS_LABELS[s];
          return (
            <div key={s} className="flex items-center gap-3">
              <div className={cn(
                "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                past    ? "border-emerald-500 bg-emerald-500 text-white" :
                current ? "border-gray-900 bg-gray-900 text-white" :
                          "border-gray-200 bg-white text-gray-400"
              )}>
                {past ? <Check size={10} /> : i + 1}
              </div>
              <span className={cn(
                "text-sm",
                current ? "font-semibold text-gray-900" :
                past    ? "text-emerald-600" :
                          "text-gray-400"
              )}>{label}</span>
            </div>
          );
        })}
      </div>
      {/* Desktop: horizontal timeline */}
      <div className="hidden sm:flex items-center">
        {steps.map((s, i) => {
          const past    = effectiveIdx > i;
          const current = s === effectiveStatus;
          const label   = s === "pago_verificado" && status === "pago_parcial"
            ? STATUS_LABELS["pago_parcial"]
            : STATUS_LABELS[s];
          return (
            <div key={s} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  past    ? "border-emerald-500 bg-emerald-500 text-white" :
                  current ? "border-gray-900 bg-gray-900 text-white" :
                            "border-gray-200 bg-white text-gray-400"
                )}>
                  {past ? <Check size={12} /> : i + 1}
                </div>
                <span className={cn(
                  "mt-1 w-20 text-center text-[10px] leading-tight",
                  current ? "font-semibold text-gray-900" : "text-gray-400"
                )}>{label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={cn(
                  "mx-1 mb-4 h-0.5 flex-1",
                  past ? "bg-emerald-400" : "bg-gray-200"
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Payment status badge ─────────────────────────────────────────────────────
const PAYMENT_STATUS = {
  pendiente:  { label: "Pendiente",  cls: "bg-yellow-100 text-yellow-800" },
  verificado: { label: "Verificado", cls: "bg-emerald-100 text-emerald-800" },
  rechazado:  { label: "Rechazado",  cls: "bg-red-100 text-red-700" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      creator: { select: { id: true, name: true } },
      items: {
        include: {
          variant: {
            include: {
              product: { select: { id: true, name: true, color: true, photos: true } },
            },
          },
        },
      },
      payments: {
        include: { exchange_rate: { select: { usd_to_ves: true } } },
        orderBy: { created_at: "asc" },
      },
      shipment: { include: { packer: { select: { id: true, name: true } } } },
      incluido_en_cierre: { select: { id: true, tipo: true, fecha_inicio: true, fecha_fin: true } },
    },
  });

  if (!order) notFound();

  const isRestricted = session.role === "vendedora_online" || session.role === "vendedora_tienda";
  if (isRestricted && order.created_by !== session.id) notFound();

  const auditLogs = session.role === "admin"
    ? await prisma.auditLog.findMany({
        where: {
          OR: [
            { entity_type: "Order", entity_id: order.id },
            ...(order.shipment ? [{ entity_type: "OrderShipment", entity_id: order.shipment.id }] : []),
          ],
        },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { created_at: "desc" },
      })
    : [];

  const canCancel = (session.role === "admin" || session.role === "inventario") &&
    order.status !== "cancelada" && order.status !== "enviada" && order.status !== "completada";

  const canForceCancel = session.role === "admin" &&
    (order.status === "enviada" || order.status === "completada");

  const canComplete = (session.role === "admin" || session.role === "inventario") &&
    order.status === "enviada";

  const canConfirmar = (session.role === "admin" || session.role === "inventario") &&
    order.channel === "online" && order.status === "pago_verificado";

  const canAddProduct = (session.role === "admin" || session.role === "inventario") &&
    !["enviada", "completada", "cancelada"].includes(order.status);

  const totalUsd = Number(order.total_usd);

  // Only count non-rejected payments toward paid total
  const paidTotal = order.payments
    .filter((p) => p.status !== "rechazado")
    .reduce((s, p) => s + Number(p.amount_usd), 0);

  // Balance not yet covered by any non-rejected payment (verified or pending)
  const remainingBalance = totalUsd - paidTotal;

  // Show "add payment" only when there's still uncovered balance
  // (pending payments awaiting confirmation count — only rejected ones don't)
  const canAddPayment =
    (order.status === "pendiente_pago" || order.status === "pago_parcial") &&
    (session.role === "admin" || session.role === "inventario" || order.created_by === session.id) &&
    remainingBalance > 0.01;
  const createdAt  = order.created_at.toLocaleString("es-VE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/ordenes"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-2")}
        >
          <ChevronLeft size={14} className="mr-1" />Órdenes
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold font-mono text-gray-900">{order.order_number}</h1>
              <OrderStatusBadge status={order.status} />
              <span className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                order.channel === "online"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-gray-100 text-gray-700"
              )}>
                {order.channel === "online" ? "Online" : "Tienda"}
              </span>
            </div>
            <p className="text-sm text-gray-500" suppressHydrationWarning>
              Creada por {order.creator.name} · {createdAt}
            </p>
          </div>
          {(canConfirmar || canComplete || canCancel || canForceCancel) && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {canConfirmar && (
                <ConfirmarOrdenButton orderId={order.id} orderNumber={order.order_number} />
              )}
              {canComplete && (
                <CompletarOrdenButton orderId={order.id} orderNumber={order.order_number} />
              )}
              {canCancel && (
                <span className="hidden sm:block">
                  <CancelOrderButton orderId={order.id} orderNumber={order.order_number} />
                </span>
              )}
              {canForceCancel && (
                <span className="hidden sm:block">
                  <DevolucionForzadaButton
                    orderId={order.id}
                    orderNumber={order.order_number}
                    incluidoEnCierre={order.incluido_en_cierre}
                  />
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <StatusTimeline status={order.status} channel={order.channel} />

      {/* Body */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* ── Left: items + notes ── */}
        <div className="space-y-5 lg:col-span-2">

          {/* Items */}
          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="border-b px-3 sm:px-5 py-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-700">Productos</h2>
              {canAddProduct && (
                <AgregarProductosDialog
                  orderId={order.id}
                  orderNumber={order.order_number}
                  channel={order.channel}
                  status={order.status}
                />
              )}
            </div>
            <div className="divide-y">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-3 sm:px-5 py-3">
                  {item.variant.product.photos[0] && (
                    <Image
                      src={item.variant.product.photos[0]}
                      alt={item.variant.product.name}
                      width={48} height={48}
                      className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{item.variant.product.name}</p>
                    <p className="text-xs text-gray-400">
                      {[item.variant.product.color ?? null, item.variant.size, item.variant.sku].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">${Number(item.subtotal_usd).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">
                      {item.quantity} × ${Number(item.unit_price_usd).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t bg-gray-50 px-3 sm:px-5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total</span>
                <span className="text-lg font-bold">
                  ${totalUsd.toFixed(2)} USD
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="rounded-xl border bg-white p-5 space-y-1.5">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <FileText size={14} />Notas
              </h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>

        {/* ── Right: customer + payments ── */}
        <div className="space-y-5">
          {/* Customer */}
          <div className="rounded-xl border bg-white p-5 space-y-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <User size={14} />Cliente
            </h2>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{order.customer_name} {order.customer_lastname}</p>
              <p className="text-gray-500">{order.customer_id_doc}</p>
            </div>
            {order.channel === "online" && (
              <div className="space-y-2 border-t pt-3 text-sm">
                {order.address && (
                  <div className="flex gap-2">
                    <MapPin size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />
                    <span className="text-gray-600">{order.address}</span>
                  </div>
                )}
                {order.shipping_company && (
                  <div className="flex gap-2">
                    <Truck size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />
                    <span className="text-gray-600">{order.shipping_company}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payments */}
          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="border-b px-3 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-700">Pagos</h2>
                {order.pricing_method && (
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    order.pricing_method === "bcv"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-violet-50 text-violet-700"
                  )}>
                    {order.pricing_method === "bcv" ? "Precios BCV" : "Precios Divisas"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "text-xs font-medium",
                  paidTotal >= totalUsd - 0.005 ? "text-emerald-700" : "text-orange-600"
                )}>
                  ${paidTotal.toFixed(2)} / ${totalUsd.toFixed(2)}
                </span>
                {canAddPayment && (
                  <AgregarPagoDialog
                    orderId={order.id}
                    orderNumber={order.order_number}
                    totalUsd={totalUsd}
                    paidUsd={paidTotal}
                    pricingMethod={order.pricing_method}
                  />
                )}
              </div>
            </div>
            {order.payments.length === 0 ? (
              <p className="px-3 sm:px-5 py-4 text-sm text-gray-400">Sin pagos registrados</p>
            ) : (
              <div className="divide-y">
                {order.payments.map((p) => {
                  const ps = PAYMENT_STATUS[p.status as keyof typeof PAYMENT_STATUS];
                  const isRejected = p.status === "rechazado";
                  const pm = paymentTypeToPricingMethod(p.payment_type as PaymentType);
                  const rate = p.exchange_rate?.usd_to_ves ? Number(p.exchange_rate.usd_to_ves) : null;
                  const bsAmount = pm === "bcv" && !isRejected
                    ? (p.amount_ves ? Number(p.amount_ves) : rate ? Number(p.amount_usd) * rate : null)
                    : null;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "px-3 sm:px-5 py-3 space-y-1",
                        isRejected && "bg-red-50/60"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-sm font-medium",
                            isRejected && "text-red-700 line-through"
                          )}>
                            {PAYMENT_TYPE_LABELS[p.payment_type]}
                          </span>
                          {!isRejected && (
                            <span className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                              pm === "bcv"
                                ? "bg-blue-50 text-blue-600"
                                : "bg-violet-50 text-violet-600"
                            )}>
                              {pm === "bcv" ? "BCV" : "Divisas"}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={cn(
                            "text-sm font-semibold",
                            isRejected && "text-red-500"
                          )}>
                            ${Number(p.amount_usd).toFixed(2)}
                          </span>
                          {bsAmount !== null && (
                            <p className="text-xs text-gray-500">
                              Bs {bsAmount.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          )}
                          {rate !== null && pm === "bcv" && !isRejected && (
                            <p className="text-[10px] text-gray-400">
                              tasa Bs {rate.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-400">
                          {p.payment_date instanceof Date
                            ? p.payment_date.toISOString().slice(0, 10)
                            : String(p.payment_date).slice(0, 10)}
                          {p.payment_time && ` · ${p.payment_time}`}
                        </span>
                        {ps && (
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", ps.cls)}>
                            {ps.label}
                          </span>
                        )}
                      </div>
                      {p.reference && p.reference !== "EFECTIVO" && (
                        <p className="text-xs text-gray-400">ref: {p.reference}</p>
                      )}
                      {p.payment_photo && (
                        <a href={p.payment_photo} target="_blank" rel="noopener noreferrer"
                          className="inline-block mt-1">
                          <Image src={p.payment_photo} alt="Comprobante" width={64} height={64}
                            className="h-12 w-12 rounded object-cover hover:opacity-80" />
                        </a>
                      )}
                      {isRejected && p.rejection_reason && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0 text-red-500" />
                          <div>
                            <p className="text-xs font-semibold text-red-700">Motivo del rechazo:</p>
                            <p className="mt-0.5 text-xs text-red-600">{p.rejection_reason}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Shipment info — shown to admin/inventario when a shipment exists */}
          {order.shipment && (session.role === "admin" || session.role === "inventario") && (
            <div className="rounded-xl border bg-white overflow-hidden">
              <div className="border-b px-5 py-3">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  <Package2 size={14} />Envío
                </h2>
              </div>
              <div className="px-5 py-4 space-y-3 text-sm">
                {/* Packer + dates */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <p className="text-xs text-gray-400">Embalado por</p>
                    <p className="font-medium">{order.shipment.packer.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Fecha embalaje</p>
                    <p className="font-medium" suppressHydrationWarning>
                      {order.shipment.packed_at.toLocaleString("es-VE", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {order.shipment.tracking_number && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Hash size={11} />Tracking
                      </p>
                      <p className="font-mono font-medium">{order.shipment.tracking_number}</p>
                    </div>
                  )}
                  {order.shipment.notes && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400">Notas de envío</p>
                      <p className="text-gray-700 whitespace-pre-wrap">{order.shipment.notes}</p>
                    </div>
                  )}
                </div>

                {/* Shipment photos */}
                <div className="flex gap-3 pt-1">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-400">Foto del paquete</p>
                    <a href={order.shipment.photo_package} target="_blank" rel="noopener noreferrer"
                      className="group relative block h-24 w-24 overflow-hidden rounded-lg border bg-gray-100">
                      <Image
                        src={order.shipment.photo_package}
                        alt="Foto del paquete"
                        fill
                        className="object-cover group-hover:opacity-80 transition-opacity"
                      />
                      <ExternalLink size={12}
                        className="absolute bottom-1 right-1 text-white drop-shadow opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </div>
                  {order.shipment.photo_receipt && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400">Foto del recibo</p>
                      <a href={order.shipment.photo_receipt} target="_blank" rel="noopener noreferrer"
                        className="group relative block h-24 w-24 overflow-hidden rounded-lg border bg-gray-100">
                        <Image
                          src={order.shipment.photo_receipt}
                          alt="Foto del recibo"
                          fill
                          className="object-cover group-hover:opacity-80 transition-opacity"
                        />
                        <ExternalLink size={12}
                          className="absolute bottom-1 right-1 text-white drop-shadow opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History — admin only */}
      {session.role === "admin" && <OrderHistorySection logs={auditLogs} />}

      {/* Cancel button pinned at bottom on mobile */}
      {canCancel && (
        <div className="sm:hidden">
          <CancelOrderButton orderId={order.id} orderNumber={order.order_number} />
        </div>
      )}
      {canForceCancel && (
        <div className="sm:hidden">
          <DevolucionForzadaButton
            orderId={order.id}
            orderNumber={order.order_number}
            incluidoEnCierre={order.incluido_en_cierre}
          />
        </div>
      )}
    </div>
  );
}
