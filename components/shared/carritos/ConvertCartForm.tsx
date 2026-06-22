"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle, AlertTriangle, ImageOff, Loader2, ShoppingCart, Trash2,
  Plus, ChevronRight, ChevronLeft, Check, Upload, Pencil, X,
} from "lucide-react";
import { PAYMENT_TYPE_LABELS } from "@/lib/order-utils";
import { cn } from "@/lib/utils";
import type { CartJSON, PaymentFormInput } from "@/types";
import type { PaymentType } from "@/app/generated/prisma/client";

type DocType = "V" | "P" | "J" | "E";

type TasaInfo = {
  id: string;
  rate: number;
  eur_rate: number | null;
  paralelo_rate: number | null;
  date: string;
  stale: boolean;
};

function fmtBs(n: number) {
  return new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  V: "V- (Venezolano)",
  P: "P- (Pasaporte)",
  J: "J- (RIF/Jurídico)",
  E: "E- (Extranjero)",
};

const STEPS = ["Productos", "Cliente", "Pago"];

function StepIndicator({ step, channel }: { step: number; channel: string }) {
  return (
    <div className="flex items-center justify-between mb-6 gap-2">
      <div className="flex items-center gap-2 sm:gap-3">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2 sm:gap-3">
            <div className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
              i + 1 === step ? "bg-gray-900 text-white" :
              i + 1 < step  ? "bg-emerald-500 text-white" :
                              "bg-gray-100 text-gray-500"
            )}>
              {i + 1 < step ? <Check size={15} /> : i + 1}
            </div>
            <span className={cn(
              "hidden sm:block text-sm",
              i + 1 === step ? "font-semibold text-gray-900" : "text-gray-400"
            )}>{label}</span>
            {i < STEPS.length - 1 && (
              <ChevronRight size={16} className="text-gray-300 mx-1 sm:mx-2" />
            )}
          </div>
        ))}
      </div>
      <span className="shrink-0 text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full capitalize">
        {channel}
      </span>
    </div>
  );
}

type CustomerData = {
  customer_name: string;
  customer_lastname: string;
  doc_type: DocType;
  doc_number: string;
  customer_address: string;
  shipping_company: string;
  notes: string;
};

const makeEmptyPayment = (): PaymentFormInput => ({
  payment_type: "transferencia",
  amount_usd: "",
  payment_date: new Date().toISOString().slice(0, 10),
  payment_time: "",
  reference: "",
  payment_photo: "",
  is_partial: false,
});

export function ConvertCartForm({ cart, isAdmin }: { cart: CartJSON; isAdmin: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [customer, setCustomer] = useState<CustomerData>({
    customer_name: "", customer_lastname: "",
    doc_type: "V", doc_number: "",
    customer_address: "",
    shipping_company: "", notes: "",
  });
  const [lookingUp, setLookingUp] = useState(false);
  const [customerFound, setCustomerFound] = useState(false);
  const [foundAddress, setFoundAddress] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState("");
  const [useCustomerAddress, setUseCustomerAddress] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [payments, setPayments] = useState<PaymentFormInput[]>([]);
  const [draft, setDraft] = useState<PaymentFormInput>(makeEmptyPayment());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [paymentPhotoError, setPaymentPhotoError] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [isPartialAgreed, setIsPartialAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tasa, setTasa] = useState<TasaInfo | null>(null);
  const [tasaLoading, setTasaLoading] = useState(false);

  const NAME_RE = /^[\p{L}\s]+$/u;

  function validateField(name: string, value: string): string {
    const v = value.trim();
    switch (name) {
      case "doc_number": {
        const maxDoc = ["J", "E"].includes(customer.doc_type) ? 15 : 9;
        if (!v) return channel === "online" ? "El documento es obligatorio" : "";
        if (v.length < 6) return "Mínimo 6 dígitos";
        if (v.length > maxDoc) return `Máximo ${maxDoc} dígitos`;
        return "";
      }
      case "customer_name":
      case "customer_lastname": {
        if (!v) return channel === "online" ? "Este campo es obligatorio" : "";
        if (v.length < 2) return "Mínimo 2 caracteres";
        if (!NAME_RE.test(v)) return "Solo letras y espacios";
        return "";
      }
      case "customer_address":
        if (v && v.length < 8) return "Mínimo 8 caracteres";
        return "";
      case "shippingAddress":
        if (!v) return channel === "online" ? "La dirección de envío es obligatoria" : "";
        if (v.length < 10) return "Mínimo 10 caracteres";
        return "";
      case "shipping_company":
        if (!v) return channel === "online" ? "La empresa de envío es obligatoria" : "";
        if (v.length < 2) return "Mínimo 2 caracteres";
        return "";
      default:
        return "";
    }
  }

  function blurField(name: string, value: string) {
    const err = validateField(name, value);
    setFieldErrors((p) => ({ ...p, [name]: err }));
  }

  // Auto-lookup customer by document
  useEffect(() => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    const { doc_type, doc_number } = customer;
    if (!doc_number.trim()) {
      setCustomerFound(false);
      setFoundAddress(null);
      setUseCustomerAddress(false);
      setIsPartialAgreed(false);
      setCustomer((p) => ({ ...p, customer_name: "", customer_lastname: "", customer_address: "" }));
      return;
    }
    lookupTimer.current = setTimeout(async () => {
      setLookingUp(true);
      try {
        const r = await fetch(`/api/customers/lookup?doc_type=${doc_type}&doc_number=${encodeURIComponent(doc_number.trim())}`);
        const j = await r.json();
        if (j.customer) {
          const addr = j.customer.address ?? null;
          setCustomer((p) => ({
            ...p,
            customer_name: j.customer.name,
            customer_lastname: j.customer.lastname,
            customer_address: addr ?? "",
          }));
          setFoundAddress(addr);
          if (addr) {
            setUseCustomerAddress(true);
            setShippingAddress(addr);
          }
          setCustomerFound(true);
        } else {
          setCustomerFound(false);
          setFoundAddress(null);
          setUseCustomerAddress(false);
          setShippingAddress("");
          setCustomer((p) => ({ ...p, customer_name: "", customer_lastname: "", customer_address: "" }));
        }
      } catch { /* silent */ }
      finally { setLookingUp(false); }
    }, 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.doc_type, customer.doc_number]);

  // Fetch exchange rate when entering step 3
  useEffect(() => {
    if (step !== 3 || tasa || tasaLoading) return;
    setTasaLoading(true);
    fetch("/api/tasa")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setTasa(d ?? null))
      .catch(() => setTasa(null))
      .finally(() => setTasaLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => { setPaymentPhotoError(false); }, [draft.payment_photo]);

  // Live cart state — refreshable to check current stock
  const [cartData, setCartData] = useState<CartJSON>(cart);
  const [refreshingStock, setRefreshingStock] = useState(false);

  const channel = cartData.channel;
  const cartTotal = cartData.total_usd;
  const hasStockIssues = cartData.has_stock_issues;

  async function refreshStock() {
    setRefreshingStock(true);
    try {
      const r = await fetch(`/api/carts/${cart.id}`);
      if (r.ok) setCartData(await r.json());
    } catch { /* silent */ }
    finally { setRefreshingStock(false); }
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (r.ok) setDraft((p) => ({ ...p, payment_photo: j.url }));
      else setError(j.error ?? "Error al subir");
    } catch { setError("Error de conexión"); }
    finally { setUploading(false); }
  }

  function startEditing(index: number) {
    setEditingIndex(index);
    setDraft({ ...payments[index] });
    setError(null);
  }

  function cancelEdit() {
    setEditingIndex(null);
    setDraft(makeEmptyPayment());
    setError(null);
  }

  function addPayment() {
    const amt = parseFloat(draft.amount_usd);
    if (isNaN(amt) || amt <= 0) { setError("Monto inválido"); return; }
    if (amt > remaining + 0.005) {
      setError(`El monto ($${amt.toFixed(2)}) supera el saldo pendiente ($${remaining.toFixed(2)})`);
      return;
    }
    if (draft.payment_type !== "efectivo" && !draft.reference.trim()) {
      setError("Referencia requerida para este tipo de pago"); return;
    }
    if (draft.payment_type !== "efectivo" && draft.reference.trim()) {
      const normRef = draft.reference.toUpperCase().replace(/[\s\-]/g, "");
      const dup = payments.find((p, i) =>
        i !== editingIndex &&
        p.payment_type !== "efectivo" &&
        p.payment_type === draft.payment_type &&
        p.reference.toUpperCase().replace(/[\s\-]/g, "") === normRef
      );
      if (dup) { setError(`Referencia duplicada: "${draft.reference}"`); return; }
    }
    if (editingIndex !== null) {
      setPayments((prev) => prev.map((p, i) => i === editingIndex ? { ...draft } : p));
      setEditingIndex(null);
    } else {
      setPayments((prev) => [...prev, { ...draft }]);
    }
    setDraft(makeEmptyPayment());
    setError(null);
  }

  const paidTotal = payments
    .filter((_, i) => i !== editingIndex)
    .reduce((s, p) => s + parseFloat(p.amount_usd || "0"), 0);
  const remaining = cartTotal - paidTotal;

  async function handleSubmit() {
    setError(null);
    if (payments.length === 0) { setError("Agrega al menos un pago"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/carts/${cart.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customer.customer_name,
          customer_lastname: customer.customer_lastname,
          doc_type: customer.doc_type,
          doc_number: customer.doc_number,
          customer_address: customer.customer_address || null,
          address: shippingAddress || null,
          shipping_company: customer.shipping_company || null,
          notes: customer.notes || null,
          is_partial_agreed: isPartialAgreed,
          payments: payments.map((p) => ({
            payment_type: p.payment_type,
            amount_usd: parseFloat(p.amount_usd),
            payment_date: p.payment_date,
            payment_time: p.payment_time || null,
            reference: p.reference,
            payment_photo: p.payment_photo || null,
            is_partial: p.is_partial,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al crear la orden"); return; }
      router.push(`/dashboard/ordenes/${data.id}`);
    } catch {
      setError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }

  function step2Valid() {
    const fieldsToCheck = channel === "online"
      ? ["doc_number", "customer_name", "customer_lastname", "shippingAddress", "shipping_company"]
      : ["doc_number", "customer_name", "customer_lastname", "customer_address"];

    const values: Record<string, string> = {
      doc_number: customer.doc_number,
      customer_name: customer.customer_name,
      customer_lastname: customer.customer_lastname,
      customer_address: customer.customer_address,
      shippingAddress,
      shipping_company: customer.shipping_company,
    };

    for (const f of fieldsToCheck) {
      if (validateField(f, values[f])) return false;
    }

    if (channel === "tienda") {
      const hasName = customer.customer_name.trim();
      const hasLastname = customer.customer_lastname.trim();
      if ((hasName || hasLastname) && !(hasName && hasLastname)) return false;
    }

    return true;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <StepIndicator step={step} channel={channel} />

      {/* ── Step 1: Review products ── */}
      {step === 1 && (
        <div className="space-y-4">
          {hasStockIssues && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle size={14} className="text-orange-500" />
              <AlertDescription className="text-orange-700 text-sm flex items-center justify-between gap-3">
                <span>Hay productos con stock insuficiente. No puedes continuar hasta que el stock esté disponible.</span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={refreshStock}
                    disabled={refreshingStock}
                    className="shrink-0 text-xs font-medium text-orange-700 underline underline-offset-2 hover:text-orange-900 disabled:opacity-50"
                  >
                    {refreshingStock ? "Verificando…" : "Actualizar stock"}
                  </button>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-xl border bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <ShoppingCart size={14} />
                Productos ({cartData.items.length})
              </h2>
              <p className="text-sm font-semibold">${cartTotal.toFixed(2)} USD</p>
            </div>

            <div className="divide-y">
              {cartData.items.map((item) => (
                <div key={item.variant_id}
                  className={cn(
                    "flex items-center gap-3 py-2.5",
                    item.stock_warning && "bg-orange-50 -mx-2 px-2 rounded"
                  )}>
                  {item.variant.product.photos[0] && (
                    <Image
                      src={item.variant.product.photos[0]}
                      alt={item.variant.product.name}
                      width={40} height={40}
                      className="h-10 w-10 flex-shrink-0 rounded object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.variant.product.name}</p>
                    <p className="text-xs text-gray-400">
                      {[item.variant.product.color, item.variant.size].filter(Boolean).join(" · ")}
                    </p>
                    {item.stock_warning && (
                      <p className="text-xs text-orange-600 flex items-center gap-1 mt-0.5">
                        <AlertTriangle size={11} />
                        {item.stock_available === 0
                          ? "Sin stock disponible"
                          : `Solo ${item.stock_available} disponible${item.stock_available !== 1 ? "s" : ""}`
                        }
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">{item.quantity} × ${item.unit_price_usd.toFixed(2)}</p>
                    <p className="text-sm font-semibold">${(item.unit_price_usd * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Customer data ── */}
      {step === 2 && (
        <div className="rounded-xl border bg-white p-6 space-y-5">
          {/* Documento */}
          <div className="space-y-1.5">
            <Label>Documento{channel === "online" ? " *" : ""}</Label>
            <div className="flex gap-2">
              <Select
                value={customer.doc_type}
                onValueChange={(v) => {
                  setCustomer((p) => ({ ...p, doc_type: v as DocType, doc_number: "", customer_name: "", customer_lastname: "" }));
                  setCustomerFound(false);
                  setFoundAddress(null);
                  setUseCustomerAddress(false);
                  setShippingAddress("");
                  setFieldErrors((p) => ({ ...p, doc_number: "" }));
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(DOC_TYPE_LABELS) as [DocType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Input
                  value={customer.doc_number}
                  onChange={(e) => {
                    const maxLen = ["J", "E"].includes(customer.doc_type) ? 15 : 9;
                    const val = e.target.value.replace(/\D/g, "").slice(0, maxLen);
                    setCustomer((p) => ({ ...p, doc_number: val, customer_name: "", customer_lastname: "" }));
                    setCustomerFound(false);
                    setFoundAddress(null);
                    setUseCustomerAddress(false);
                  }}
                  onBlur={(e) => blurField("doc_number", e.target.value)}
                  placeholder="12345678"
                  inputMode="numeric"
                  className={cn("pr-8",
                    customerFound && "border-emerald-400",
                    fieldErrors.doc_number && "border-red-400"
                  )}
                />
                {lookingUp && (
                  <Loader2 size={13} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                )}
                {!lookingUp && customerFound && (
                  <Check size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500" />
                )}
              </div>
            </div>
            {fieldErrors.doc_number && (
              <p className="text-xs text-red-500">{fieldErrors.doc_number}</p>
            )}
          </div>

          {/* Nombre, Apellido y Dirección del cliente */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nombre{channel === "online" ? " *" : ""}</Label>
                <Input
                  value={customer.customer_name}
                  readOnly={customerFound}
                  onChange={(e) => {
                    if (customerFound) return;
                    setCustomer((p) => ({ ...p, customer_name: e.target.value }));
                  }}
                  maxLength={50}
                  onBlur={(e) => !customerFound && blurField("customer_name", e.target.value)}
                  placeholder="Ana"
                  className={cn(
                    customerFound ? "cursor-default bg-gray-50 text-gray-700 focus:ring-0 focus:border-input" : "",
                    fieldErrors.customer_name && "border-red-400"
                  )}
                />
                {fieldErrors.customer_name && (
                  <p className="text-xs text-red-500">{fieldErrors.customer_name}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Apellido{channel === "online" ? " *" : ""}</Label>
                <Input
                  value={customer.customer_lastname}
                  readOnly={customerFound}
                  onChange={(e) => {
                    if (customerFound) return;
                    setCustomer((p) => ({ ...p, customer_lastname: e.target.value }));
                  }}
                  maxLength={50}
                  onBlur={(e) => !customerFound && blurField("customer_lastname", e.target.value)}
                  placeholder="García"
                  className={cn(
                    customerFound ? "cursor-default bg-gray-50 text-gray-700 focus:ring-0 focus:border-input" : "",
                    fieldErrors.customer_lastname && "border-red-400"
                  )}
                />
                {fieldErrors.customer_lastname && (
                  <p className="text-xs text-red-500">{fieldErrors.customer_lastname}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Dirección del cliente</Label>
              <Input
                value={customer.customer_address}
                readOnly={customerFound}
                onChange={(e) => {
                  if (customerFound) return;
                  const val = e.target.value.slice(0, 200);
                  setCustomer((p) => ({ ...p, customer_address: val }));
                }}
                onBlur={(e) => !customerFound && blurField("customer_address", e.target.value)}
                placeholder="Calle, urbanización, ciudad…"
                className={cn(
                  customerFound ? "cursor-default bg-gray-50 text-gray-700 focus:ring-0 focus:border-input" : "",
                  fieldErrors.customer_address && "border-red-400"
                )}
              />
              {fieldErrors.customer_address && (
                <p className="text-xs text-red-500">{fieldErrors.customer_address}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Canal</Label>
            <div className="inline-flex items-center rounded-md border bg-gray-50 px-3 py-2 text-sm capitalize">
              {channel}
            </div>
          </div>

          {/* Dirección de envío — solo online */}
          {channel === "online" && (
            <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Dirección de envío</p>

              {foundAddress && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useCustomerAddress}
                    onChange={(e) => {
                      setUseCustomerAddress(e.target.checked);
                      setShippingAddress(e.target.checked ? foundAddress : "");
                      setFieldErrors((p) => ({ ...p, shippingAddress: "" }));
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-gray-700">Usar dirección del cliente</span>
                </label>
              )}

              <div className="space-y-1.5">
                <Label>Dirección *</Label>
                <Input
                  value={shippingAddress}
                  onChange={(e) => {
                    setShippingAddress(e.target.value.slice(0, 200));
                    if (useCustomerAddress) setUseCustomerAddress(false);
                  }}
                  onBlur={(e) => blurField("shippingAddress", e.target.value)}
                  placeholder="Calle, urbanización, ciudad…"
                  className={cn(fieldErrors.shippingAddress && "border-red-400")}
                />
                {fieldErrors.shippingAddress && (
                  <p className="text-xs text-red-500">{fieldErrors.shippingAddress}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Empresa de envío *</Label>
                <Input
                  value={customer.shipping_company}
                  onChange={(e) => setCustomer((p) => ({ ...p, shipping_company: e.target.value.slice(0, 50) }))}
                  onBlur={(e) => blurField("shipping_company", e.target.value)}
                  placeholder="Zoom, DHL, MRW…"
                  className={cn(fieldErrors.shipping_company && "border-red-400")}
                />
                {fieldErrors.shipping_company && (
                  <p className="text-xs text-red-500">{fieldErrors.shipping_company}</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea rows={2} value={customer.notes}
              onChange={(e) => setCustomer((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Instrucciones especiales…" />
          </div>
        </div>
      )}

      {/* ── Step 3: Payment ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-xl border bg-gray-50 px-5 py-3">
            <span className="text-sm text-gray-600">
              {cart.items.length} producto{cart.items.length !== 1 ? "s" : ""} · {cart.items.reduce((s, c) => s + c.quantity, 0)} unidades
            </span>
            <span className="text-lg font-semibold">${cartTotal.toFixed(2)} USD</span>
          </div>

          {/* Tasas de referencia */}
          {tasaLoading && (
            <div className="flex items-center gap-1.5 rounded-xl border bg-white px-5 py-3 text-sm text-gray-400">
              <Loader2 size={14} className="animate-spin" /> Cargando tasas…
            </div>
          )}
          {!tasaLoading && tasa && (
            <div className="w-full sm:w-fit rounded-xl border bg-white px-5 py-3">
              <p className="mb-1.5 text-xs font-medium text-gray-400">Tasas de referencia</p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-800">USD</span> {fmtBs(tasa.rate)} Bs.
                {tasa.stale && <AlertTriangle size={11} className="inline ml-1 text-amber-500" />}
                {tasa.eur_rate != null && <> · <span className="font-semibold text-gray-800">EUR</span> {fmtBs(tasa.eur_rate)} Bs.</>}
                {tasa.paralelo_rate != null && <> · <span className="font-semibold text-gray-800">Paralelo</span> {fmtBs(tasa.paralelo_rate)} Bs.</>}
              </p>
            </div>
          )}

          {payments.length > 0 && (
            <div className="rounded-xl border bg-white divide-y">
              {payments.map((p, i) => {
                const isEditing = editingIndex === i;
                return (
                  <div key={i} className={cn(
                    "flex items-center justify-between px-4 py-2.5 text-sm",
                    isEditing && "bg-blue-50"
                  )}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("font-medium", isEditing && "text-blue-700")}>
                        {PAYMENT_TYPE_LABELS[p.payment_type]}
                      </span>
                      {p.reference && <span className="text-sm text-gray-400">ref: {p.reference}</span>}
                      <span className="text-sm text-gray-400">{p.payment_date}</span>
                      {isEditing && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Editando…
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">${parseFloat(p.amount_usd).toFixed(2)}</span>
                      {!isEditing && (
                        <button type="button" onClick={() => startEditing(i)}
                          className="text-gray-300 hover:text-blue-500"><Pencil size={13} /></button>
                      )}
                      <button type="button"
                        onClick={() => { if (isEditing) cancelEdit(); setPayments((prev) => prev.filter((_, j) => j !== i)); }}
                        className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })}
              <div className={cn(
                "flex items-center justify-between px-4 py-2.5 text-sm font-semibold",
                remaining > 0.005 ? "text-orange-600" : "text-emerald-700"
              )}>
                <span>{remaining > 0.005 ? `Pendiente: $${remaining.toFixed(2)} USD` : "Total cubierto"}</span>
                <span>{remaining > 0.005 ? "⚠" : "✓"}</span>
              </div>
            </div>
          )}

          {(remaining > 0.005 || editingIndex !== null) && (
            <div className="rounded-xl border bg-white p-5 space-y-4">
              <h2 className="text-base font-semibold text-gray-700">
                {editingIndex !== null ? "Editar pago" : "Agregar pago"}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Tipo *</Label>
                  <select
                    value={draft.payment_type}
                    onChange={(e) => {
                      const now = new Date();
                      const isEfectivo = e.target.value === "efectivo";
                      setDraft((p) => ({
                        ...p,
                        payment_type: e.target.value as PaymentType,
                        reference: isEfectivo ? "" : p.reference,
                        payment_date: isEfectivo ? now.toISOString().slice(0, 10) : p.payment_date,
                        payment_time: isEfectivo
                          ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
                          : p.payment_time,
                      }));
                    }}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Monto USD *</Label>
                  {(() => {
                    const num = parseFloat(draft.amount_usd);
                    const montoError =
                      draft.amount_usd && (isNaN(num) || num <= 0)
                        ? "Monto inválido"
                        : draft.amount_usd && num > remaining + 0.005
                        ? `Máximo $${remaining.toFixed(2)}`
                        : null;
                    const amountBs = tasa && !isNaN(num) && num > 0 ? num * tasa.rate : null;
                    return (
                      <div className="space-y-1">
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={draft.amount_usd}
                          onChange={(e) => setDraft((p) => ({ ...p, amount_usd: e.target.value }))}
                          placeholder="0.00"
                          className={`[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none${montoError ? " border-red-400 focus-visible:ring-red-400" : ""}`}
                        />
                        {montoError && (
                          <p className="text-sm text-red-600">{montoError}</p>
                        )}
                        {!montoError && amountBs !== null && (
                          <div className="rounded-md bg-emerald-50 border border-emerald-100 px-2.5 py-1.5">
                            <p className="text-sm text-emerald-700 font-medium">≈ Bs. {fmtBs(amountBs)}</p>
                            <p className="text-xs text-emerald-500 mt-0.5">
                              Tasa: Bs. {fmtBs(tasa!.rate)} × $1
                              {tasa!.stale && (
                                <span className="ml-1 inline-flex items-center gap-0.5 text-amber-600">
                                  <AlertTriangle size={11} /> desactualizada
                                </span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
              {draft.payment_type !== "efectivo" && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:max-w-sm">
                  <div className="w-full sm:flex-1 space-y-1.5">
                    <Label>Fecha</Label>
                    <Input type="date" value={draft.payment_date}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setDraft((p) => ({ ...p, payment_date: e.target.value }))} />
                  </div>
                  <div className="w-full sm:w-32 sm:shrink-0 space-y-1.5">
                    <Label>Hora</Label>
                    <Input type="time" value={draft.payment_time}
                      onChange={(e) => setDraft((p) => ({ ...p, payment_time: e.target.value }))} />
                  </div>
                </div>
              )}
              {draft.payment_type !== "efectivo" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Referencia *</Label>
                    <Input value={draft.reference}
                      onChange={(e) => setDraft((p) => ({ ...p, reference: e.target.value }))}
                      placeholder="Número de confirmación" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Comprobante</Label>
                    <div className="flex gap-2">
                      <Input value={draft.payment_photo}
                        onChange={(e) => setDraft((p) => ({ ...p, payment_photo: e.target.value }))}
                        placeholder="URL de la imagen" className="flex-1" />
                      <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
                      <Button type="button" variant="outline" size="icon" disabled={uploading}
                        onClick={() => photoInputRef.current?.click()}>
                        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      </Button>
                    </div>
                    {draft.payment_photo && (
                      paymentPhotoError ? (
                        <div className="mt-1 h-16 w-16 rounded border bg-gray-100 flex items-center justify-center">
                          <ImageOff size={16} className="text-gray-400" />
                        </div>
                      ) : (
                        <Image src={draft.payment_photo} alt="Comprobante" width={80} height={80}
                          className="mt-1 h-16 w-16 rounded object-cover"
                          onError={() => setPaymentPhotoError(true)} />
                      )
                    )}
                  </div>
                </>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addPayment}
                  disabled={
                    !draft.amount_usd ||
                    isNaN(parseFloat(draft.amount_usd)) ||
                    parseFloat(draft.amount_usd) <= 0 ||
                    parseFloat(draft.amount_usd) > remaining + 0.005
                  }
                >
                  {editingIndex !== null
                    ? <><Check size={14} />Guardar cambios</>
                    : <><Plus size={14} />Agregar pago</>
                  }
                </Button>
                {editingIndex !== null && (
                  <Button type="button" variant="ghost" onClick={cancelEdit}>
                    <X size={14} />Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Pago parcial: siempre requiere cliente registrado; admin ve etiqueta distinta */}
          {payments.length > 0 && remaining > 0.005 && (
            (isAdmin || channel === "tienda") && customer.doc_number.trim()
              ? (
                <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
                  <input type="checkbox" checked={isPartialAgreed}
                    onChange={(e) => setIsPartialAgreed(e.target.checked)}
                    className="rounded border-gray-300" />
                  <span>
                    {isAdmin
                      ? <>Pago parcial acordado — marcar como <strong>Pago parcial</strong> aunque no cubra el total</>
                      : <>Cliente de confianza — registrar con <strong>pago parcial</strong> pendiente de completar</>
                    }
                  </span>
                </label>
              ) : channel === "tienda" ? (
                <p className="text-xs text-gray-400 border rounded-lg px-3 py-2 bg-gray-50">
                  Para registrar pago parcial en tienda debes asociar la venta a un cliente (ingresa el documento).
                </p>
              ) : null
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle size={14} />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" disabled={step === 1}
          onClick={() => { setStep((s) => s - 1); setError(null); }}>
          <ChevronLeft size={14} className="mr-1" />Anterior
        </Button>
        {step < 3 ? (
          <Button
            disabled={(step === 1 && hasStockIssues) || (step === 2 && !step2Valid())}
            onClick={() => { setError(null); setStep((s) => s + 1); }}>
            Siguiente <ChevronRight size={14} className="ml-1" />
          </Button>
        ) : (
          <Button
            disabled={submitting || payments.length === 0 || (!isPartialAgreed && remaining > 0.005) || hasStockIssues}
            onClick={handleSubmit}>
            {submitting && <Loader2 size={14} className="animate-spin mr-2" />}
            Crear orden
          </Button>
        )}
      </div>
    </div>
  );
}
