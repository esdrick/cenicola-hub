"use client";

import { Fragment, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { PAYMENT_TYPE_LABELS, validatePaymentReference, getPaymentReferenceConfig } from "@/lib/order-utils";
import { getVenezuelaDateString, getVenezuelaTimeString } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { getOptimizedCloudinaryUrl } from "@/lib/cloudinary";
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
              {i + 1 < step ? <Check size={15} /> : <span>{i + 1}</span>}
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
  customer_phone: string;
  customer_email?: string;
  shipping_company: string;
  notes: string;
};

const BCV_TYPES: PaymentType[] = ["efectivo_bs", "transferencia", "pago_movil"];
const DIVISAS_TYPES: PaymentType[] = ["efectivo_usd", "zelle", "usdt"];

const makeEmptyPayment = (channel: "online" | "tienda", pricingMethod?: "bcv" | "divisas" | null): PaymentFormInput => ({
  payment_type: channel === "tienda"
    ? (pricingMethod === "divisas" ? "efectivo_usd" : "efectivo_bs")
    : (pricingMethod === "divisas" ? "zelle" : "transferencia"),
  amount_usd: "",
  payment_date: getVenezuelaDateString(),
  payment_time: channel === "tienda" ? getVenezuelaTimeString() : "",
  reference: "",
  payment_photo: "",
  is_partial: false,
});

export function ConvertCartForm({ cart, isAdmin }: { cart: CartJSON; isAdmin: boolean }) {
  const router = useRouter();

  const [step, setStep] = useState(cart.has_stock_issues ? 1 : (cart.channel === "tienda" ? 3 : 1));
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const [customer, setCustomer] = useState<CustomerData>({
    customer_name: "",
    customer_lastname: "",
    doc_type: "V",
    doc_number: "",
    customer_address: "",
    customer_phone: "",
    customer_email: "",
    shipping_company: "",
    notes: "",
  });
  const [lookingUp, setLookingUp] = useState(false);
  const [customerFound, setCustomerFound] = useState(false);
  const [foundAddress, setFoundAddress] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState("");
  const [useCustomerAddress, setUseCustomerAddress] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [payments, setPayments] = useState<PaymentFormInput[]>([]);
  const [draft, setDraft] = useState<PaymentFormInput>(makeEmptyPayment(cart.channel, cart.pricing_method));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [paymentPhotoError, setPaymentPhotoError] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [isPartialAgreed, setIsPartialAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [repricingCart, setRepricingCart] = useState(false);
  const [checkingStepStock, setCheckingStepStock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Reparto por moneda: opcional, apagado por defecto — el flujo de una sola moneda
  // (ya probado) queda intacto mientras el vendedor no lo active explícitamente.
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splittingVariant, setSplittingVariant] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tasa, setTasa] = useState<TasaInfo | null>(null);
  const [tasaLoading, setTasaLoading] = useState(false);

  const NAME_RE = /^[\p{L}\s]+$/u;
  const PHONE_RE = /^0\d{9,10}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      case "customer_phone":
        if (!v) return channel === "online" ? "El teléfono es obligatorio" : "";
        if (!PHONE_RE.test(v)) return "Debe iniciar con 0 y tener 10-11 dígitos";
        return "";
      case "customer_email":
        if (v && !EMAIL_RE.test(v)) return "Formato de correo electrónico inválido";
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
            customer_name: p.customer_name || j.customer.name,
            customer_lastname: p.customer_lastname || j.customer.lastname,
            customer_address: p.customer_address || addr || "",
            customer_phone: p.customer_phone || j.customer.phone || "",
            customer_email: p.customer_email || j.customer.email || "",
          }));
          setFoundAddress(addr);
          if (addr && !shippingAddress) {
            setUseCustomerAddress(true);
            setShippingAddress(addr);
          }
          setCustomerFound(true);
        } else {
          setCustomerFound(false);
          setFoundAddress(null);
          setUseCustomerAddress(false);
        }
      } catch { /* silent */ }
      finally { setLookingUp(false); }
    }, 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.doc_type, customer.doc_number]);

  // Fetch exchange rate when entering step 3
  useEffect(() => {
    refreshStock();
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
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);

  const channel = cartData.channel;
  const cartTotal = cartData.total_usd;
  const hasStockIssues = cartData.has_stock_issues;

  async function refreshStock() {
    try {
      const r = await fetch(`/api/carts/${cart.id}`);
      if (r.ok) setCartData(await r.json());
    } catch { /* silent */ }
  }

  async function updateCartItemQuantity(variant_id: string, quantity: number) {
    setUpdatingItem(variant_id);
    setError(null);
    try {
      const r = await fetch(`/api/carts/${cart.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: { variant_id, quantity } }),
      });
      const j = await r.json();
      if (r.ok) {
        setCartData(j);
        if (j.items?.length === 0 || j.deleted) {
          router.push(`/dashboard/carritos/${cart.id}`);
        }
      } else {
        setError(j.error ?? "Error al actualizar producto");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setUpdatingItem(null);
    }
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
    setDraft({ ...makeEmptyPayment(channel, cartData.pricing_method), payment_type: nextDefaultPaymentType(payments) });
    setError(null);
  }

  // Misma regla que la lista de "Agregar pago" usa para armar allowedTypes: sin split, el
  // primer pago fija la familia de los siguientes; con split, del segundo pago en adelante
  // solo se ofrece la familia contraria a la del primero. Se usa para que el tipo por defecto
  // del borrador nunca quede en una opción que el select ya no muestra.
  function nextDefaultPaymentType(committed: PaymentFormInput[]): PaymentType {
    if (committed.length === 0) {
      if (channel === "tienda") {
        return cartData.pricing_method === "divisas" ? "efectivo_usd" : "efectivo_bs";
      }
      return cartData.pricing_method === "divisas" ? "zelle" : "transferencia";
    }
    const firstFamily: "bcv" | "divisas" =
      DIVISAS_TYPES.includes(committed[0].payment_type as PaymentType) ? "divisas" : "bcv";
    const family = splitEnabled ? (firstFamily === "bcv" ? "divisas" : "bcv") : firstFamily;
    return family === "divisas"
      ? (channel === "tienda" ? "efectivo_usd" : "zelle")
      : (channel === "tienda" ? "efectivo_bs" : "transferencia");
  }

  function addPayment() {
    const amt = parseFloat(draft.amount_usd);
    if (isNaN(amt) || amt <= 0) { setError("Monto inválido"); return; }
    const draftIsBcv = BCV_TYPES.includes(draft.payment_type as PaymentType);
    const maxAmt = (isMixed ? (draftIsBcv ? remainingBcv : remainingDivisas) : remaining) + 1.00;
    if (amt > maxAmt) { setError(`El monto excede el límite de redondeo. Máximo $${maxAmt.toFixed(2)}`); return; }
    // Mismo piso que exige el servidor: si este pago deja el pedido cerrado en total pero una
    // moneda todavía sin cubrir (más allá del margen), no se deja agregar — se avisa aquí mismo
    // en vez de dejar que el usuario se entere recién al intentar crear la orden.
    if (isMixed) {
      const projRemainingBcv = remainingBcv - (draftIsBcv ? amt : 0);
      const projRemainingDivisas = remainingDivisas - (!draftIsBcv ? amt : 0);
      const projRemaining = remaining - amt;
      if (projRemaining <= 0.005 && (projRemainingBcv > 1.00 || projRemainingDivisas > 1.00)) {
        const shortCurrency = projRemainingBcv > 1.00 ? "BCV" : "Divisas";
        const shortAmount = projRemainingBcv > 1.00 ? projRemainingBcv : projRemainingDivisas;
        setError(`Esto dejaría el total cubierto, pero faltarían $${shortAmount.toFixed(2)} en ${shortCurrency} — agrégalos en esa moneda.`);
        return;
      }
    }
    const draftIsCash = draft.payment_type === "efectivo_bs" || draft.payment_type === "efectivo_usd";
    const refValidation = validatePaymentReference(draft.payment_type, draft.reference);
    if (!refValidation.valid) {
      setError(refValidation.error || "Referencia inválida"); return;
    }
    if (!draftIsCash && draft.reference.trim()) {
      const normRef = draft.reference.toUpperCase().replace(/[\s\-]/g, "");
      const dup = payments.find((p, i) => {
        const pIsCash = p.payment_type === "efectivo_bs" || p.payment_type === "efectivo_usd";
        return (
          i !== editingIndex &&
          !pIsCash &&
          p.payment_type === draft.payment_type &&
          p.reference.toUpperCase().replace(/[\s\-]/g, "") === normRef
        );
      });
      if (dup) { setError(`Referencia duplicada: "${draft.reference}"`); return; }
    }
    const newPayments = editingIndex !== null
      ? payments.map((p, i) => i === editingIndex ? { ...draft } : p)
      : [...payments, { ...draft }];
    setPayments(newPayments);
    setEditingIndex(null);
    setDraft({ ...makeEmptyPayment(channel), payment_type: nextDefaultPaymentType(newPayments) });
    setError(null);
  }

  // El reparto por moneda (split) solo afecta CUÁNTO cuesta el pedido — no exige que cada
  // bucket se pague por separado. Una vez calculado el total correcto (mezcla de precios BCV
  // y Divisas), los pagos se validan en conjunto contra ese total, como siempre.
  const committedPayments = payments.filter((_, i) => i !== editingIndex);
  const paidTotal = committedPayments.reduce((s, p) => s + parseFloat(p.amount_usd || "0"), 0);
  const remaining = cartTotal - paidTotal;
  const noPaymentsYet = committedPayments.length === 0;
  // Tope por moneda para EL MONTO de cada pago (no para poder cerrar la orden, eso sigue
  // siendo agregado más abajo): evita escribir, por ejemplo, $30 en un pago BCV cuando la
  // porción BCV del pedido es de $20 — aunque en conjunto todavía "quepa" en el total.
  const paidBcv = committedPayments
    .filter((p) => BCV_TYPES.includes(p.payment_type as PaymentType))
    .reduce((s, p) => s + parseFloat(p.amount_usd || "0"), 0);
  const paidDivisas = committedPayments
    .filter((p) => DIVISAS_TYPES.includes(p.payment_type as PaymentType))
    .reduce((s, p) => s + parseFloat(p.amount_usd || "0"), 0);
  const remainingBcv = cartData.total_bcv_usd - paidBcv;
  const remainingDivisas = cartData.total_divisas_usd - paidDivisas;
  // "Mixto" de verdad (ambos buckets tienen algo) vs. el caso normal de una sola moneda,
  // donde el otro bucket simplemente vale 0 — solo informativo (badge), no cambia validación.
  const isMixed = cartData.total_bcv_usd > 0 && cartData.total_divisas_usd > 0;
  // Espejo del resguardo del servidor: un pedido dividido no puede cerrarse si a alguna de las
  // dos monedas todavía le falta más del margen de redondeo ($1) — no basta con que el total
  // agregado cuadre, cada moneda tiene que cubrirse con pagos de esa misma moneda.
  const splitNeedsBothCurrencies = isMixed && remaining <= 0.005 && (remainingBcv > 1.00 || remainingDivisas > 1.00);

  // Pre-fill default draft amount only once when entering Step 3 if no payment has been added yet
  const hasAutoFilledStep3 = useRef(false);

  useEffect(() => {
    if (step === 3) {
      if (!hasAutoFilledStep3.current && payments.length === 0) {
        hasAutoFilledStep3.current = true;
        const initialAmt = isMixed
          ? (BCV_TYPES.includes(draft.payment_type as PaymentType) ? remainingBcv : remainingDivisas)
          : remaining;
        if (initialAmt > 0 && !draft.amount_usd) {
          setDraft((p) => ({ ...p, amount_usd: initialAmt.toFixed(2) }));
        }
      }
    } else {
      hasAutoFilledStep3.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, payments.length, isMixed, remainingBcv, remainingDivisas, remaining, draft.payment_type]);

  // El input nativo type="number" con `max` no bloquea el tecleo — solo invalida el form en
  // submit. Sin esto, se podía escribir cualquier cantidad aunque no tuviera sentido para el
  // producto; ahora se recorta al vuelo mientras se escribe, no solo al salir del campo.
  function clampSplitInput(e: React.ChangeEvent<HTMLInputElement>, max: number) {
    const raw = e.currentTarget.value;
    if (raw === "") return;
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(Math.max(0, n), max);
    if (String(clamped) !== raw) {
      e.currentTarget.value = String(clamped);
    }
  }

  async function applySplit(variantId: string, quantity: number, quantityBcv: number) {
    const clamped = Math.min(Math.max(0, quantityBcv), quantity);
    setSplittingVariant(variantId);
    try {
      const r = await fetch(`/api/carts/${cart.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          split: { variant_id: variantId, quantity_bcv: clamped, quantity_divisas: quantity - clamped },
        }),
      });
      if (r.ok) setCartData(await r.json());
    } catch { /* silent */ }
    finally { setSplittingVariant(null); }
  }

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
          customer_phone: customer.customer_phone || null,
          customer_email: customer.customer_email || null,
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
      if (!res.ok) {
        if (data.error && (data.error.includes("Stock insuficiente") || data.error.includes("simultánea") || data.error.includes("agotado"))) {
          refreshStock();
        }
        setError(data.error ?? "Error al crear la orden");
        return;
      }
      router.push(`/dashboard/ordenes/${data.id}`);
    } catch {
      setError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }

  function step2Valid() {
    const fieldsToCheck = channel === "online"
      ? ["doc_number", "customer_name", "customer_lastname", "customer_phone", "shippingAddress", "shipping_company"]
      : ["doc_number", "customer_name", "customer_lastname", "customer_address", "customer_phone"];

    const values: Record<string, string> = {
      doc_number: customer.doc_number,
      customer_name: customer.customer_name,
      customer_lastname: customer.customer_lastname,
      customer_address: customer.customer_address,
      customer_phone: customer.customer_phone,
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
        <div key="step-1" className="space-y-4">
          {hasStockIssues && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle size={15} className="text-orange-500 mt-0.5 shrink-0" />
              <AlertDescription className="text-orange-800 text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span>
                    Hay productos con stock insuficiente. Usa el botón <strong>&quot;Ajustar&quot;</strong> o <strong>&quot;Eliminar&quot;</strong> en las prendas marcadas, o ve al catálogo para elegir otros productos.
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/dashboard/carritos/${cart.id}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "h-7 text-xs border-orange-300 text-orange-800 hover:bg-orange-100 font-medium"
                      )}
                    >
                      Ir a productos
                    </Link>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-xl border bg-white p-5 space-y-3">
            {(() => {
              const totalQty = cartData.items.reduce((s, c) => s + c.quantity, 0);
              const mayorThreshold = cartData.mayor_threshold ?? 6;
              const bundleThreshold = cartData.bundle_threshold ?? 3;
              const tier = totalQty >= mayorThreshold ? "Mayor" : totalQty >= bundleThreshold ? "Paquete" : "Detal";
              const pm = cartData.pricing_method;
              return (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                      <ShoppingCart size={14} />
                      <span>Productos ({cartData.items.length})</span>
                    </h2>
                    {pm && (
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none",
                        pm === "bcv" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"
                      )}>
                        {pm === "bcv" ? "BCV" : "Divisas"}
                      </span>
                    )}
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold leading-none text-gray-600">
                      {tier}
                    </span>
                  </div>
                  <p className="text-sm font-semibold shrink-0"><span>${cartTotal.toFixed(2)} USD</span></p>
                </div>
              );
            })()}

            <div className="divide-y">
              {cartData.items.map((item) => (
                <div key={item.variant_id}
                  className={cn(
                    "flex items-center justify-between gap-3 py-3",
                    item.stock_warning && "bg-orange-50/80 -mx-3 px-3 rounded-lg border border-orange-200"
                  )}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {item.variant.product.photos[0] && (
                      <Image
                        src={getOptimizedCloudinaryUrl(item.variant.product.photos[0], 400)}
                        alt={item.variant.product.name}
                        width={44} height={44}
                        loading="lazy"
                        className="h-11 w-11 flex-shrink-0 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{item.variant.product.name}</p>
                      <p className="text-xs text-gray-400">
                        {[item.variant.product.color, item.variant.size].filter(Boolean).join(" · ")}
                      </p>
                      {item.stock_warning && (
                        <p className="text-xs font-medium text-orange-700 flex items-center gap-1 mt-1">
                          <AlertTriangle size={13} className="shrink-0 text-orange-600" />
                          <span>
                            {item.stock_available === 0
                              ? `Agotado (solicitas ${item.quantity})`
                              : `Solo quedan ${item.stock_available} (solicitas ${item.quantity})`
                            }
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right side: price and quick adjustment actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    {item.stock_warning ? (
                      <div className="flex items-center gap-2">
                        {item.stock_available > 0 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={updatingItem === item.variant_id}
                            onClick={() => updateCartItemQuantity(item.variant_id, item.stock_available)}
                            className="h-7 text-xs border-orange-300 bg-white hover:bg-orange-50 text-orange-800 font-medium"
                          >
                            {updatingItem === item.variant_id ? (
                              <Loader2 size={12} className="animate-spin mr-1" />
                            ) : null}
                            Ajustar a {item.stock_available}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={updatingItem === item.variant_id}
                          onClick={() => updateCartItemQuantity(item.variant_id, 0)}
                          className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {updatingItem === item.variant_id ? (
                            <Loader2 size={12} className="animate-spin mr-1" />
                          ) : (
                            <Trash2 size={13} className="mr-1" />
                          )}
                          Eliminar
                        </Button>
                      </div>
                    ) : (
                      <div className="text-right">
                        <p className="text-xs text-gray-400"><span>{item.quantity} × ${item.unit_price_usd.toFixed(2)}</span></p>
                        <p className="text-sm font-semibold text-gray-900"><span>${(item.unit_price_usd * item.quantity).toFixed(2)}</span></p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Customer data ── */}
      {step === 2 && (
        <div key="step-2" className="space-y-4">
          {hasStockIssues && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle size={15} className="text-orange-500 mt-0.5 shrink-0" />
              <AlertDescription className="text-orange-800 text-sm flex items-center justify-between gap-3">
                <span>
                  <strong>Stock insuficiente:</strong> {error && (error.includes("Stock insuficiente") || error.includes("agotado")) ? error.replace(/^Stock insuficiente:\s*/i, "") : "Hay productos con stock insuficiente en este pedido. Regresa al paso 1 para corregir las cantidades."}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => { setError(null); setStep(1); }} className="h-7 text-xs border-orange-300 text-orange-800 hover:bg-orange-100 font-medium">
                  Ver productos
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <div className="rounded-xl border bg-white p-6 space-y-5">
          {/* Documento */}
          <div className="space-y-1.5">
            <Label>Documento{channel === "online" && <span className="text-red-500"> *</span>}</Label>
            <div className="flex gap-2">
              <Select
                value={customer.doc_type}
                onValueChange={(v) => {
                  setCustomer((p) => ({ ...p, doc_type: v as DocType }));
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
                    setCustomer((p) => ({ ...p, doc_number: val }));
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
                <Label><span>Nombre</span>{channel === "online" && <span className="text-red-500"> *</span>}</Label>
                <Input
                  value={customer.customer_name}
                  onChange={(e) => setCustomer((p) => ({ ...p, customer_name: e.target.value }))}
                  maxLength={50}
                  onBlur={(e) => blurField("customer_name", e.target.value)}
                  placeholder="Ana"
                  className={cn(
                    fieldErrors.customer_name && "border-red-400"
                  )}
                />
                {fieldErrors.customer_name && (
                  <p className="text-xs text-red-500">{fieldErrors.customer_name}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label><span>Apellido</span>{channel === "online" && <span className="text-red-500"> *</span>}</Label>
                <Input
                  value={customer.customer_lastname}
                  onChange={(e) => setCustomer((p) => ({ ...p, customer_lastname: e.target.value }))}
                  maxLength={50}
                  onBlur={(e) => blurField("customer_lastname", e.target.value)}
                  placeholder="García"
                  className={cn(
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
                onChange={(e) => {
                  const val = e.target.value.slice(0, 200);
                  setCustomer((p) => ({ ...p, customer_address: val }));
                }}
                onBlur={(e) => blurField("customer_address", e.target.value)}
                placeholder="Calle, urbanización, ciudad…"
                className={cn(
                  fieldErrors.customer_address && "border-red-400"
                )}
              />
              {fieldErrors.customer_address && (
                <p className="text-xs text-red-500">{fieldErrors.customer_address}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label><span>Teléfono</span>{channel === "online" && <span className="text-red-500"> *</span>}</Label>
                <Input
                  value={customer.customer_phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 11);
                    setCustomer((p) => ({ ...p, customer_phone: val }));
                  }}
                  onBlur={(e) => blurField("customer_phone", e.target.value)}
                  placeholder="04121234567"
                  inputMode="numeric"
                  className={cn(fieldErrors.customer_phone && "border-red-400")}
                />
                {fieldErrors.customer_phone && (
                  <p className="text-xs text-red-500">{fieldErrors.customer_phone}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Correo electrónico (Opcional)</Label>
                <Input
                  type="email"
                  value={customer.customer_email ?? ""}
                  onChange={(e) => {
                    setCustomer((p) => ({ ...p, customer_email: e.target.value }));
                  }}
                  onBlur={(e) => blurField("customer_email", e.target.value)}
                  placeholder="cliente@ejemplo.com"
                  className={cn(fieldErrors.customer_email && "border-red-400")}
                />
                {fieldErrors.customer_email && (
                  <p className="text-xs text-red-500">{fieldErrors.customer_email}</p>
                )}
              </div>
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
      </div>
      )}

      {/* ── Step 3: Payment ── */}
      {step === 3 && (
        <div key="step-3" className="space-y-5">
          {(() => {
            const totalQty = cartData.items.reduce((s, c) => s + c.quantity, 0);
            const mayorThreshold = cartData.mayor_threshold ?? 6;
            const bundleThreshold = cartData.bundle_threshold ?? 3;
            const tier = totalQty >= mayorThreshold ? "Mayor" : totalQty >= bundleThreshold ? "Paquete" : "Detal";
            const pm = cartData.pricing_method;
            return (
              <div className="flex items-center justify-between rounded-xl border bg-gray-50 px-5 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-600">
                    <span>{cartData.items.length} producto{cartData.items.length !== 1 ? "s" : ""} · {totalQty} unidades</span>
                  </span>
                  {isMixed ? (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none bg-amber-100 text-amber-700">
                      Mixto
                    </span>
                  ) : pm && (
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none",
                      pm === "bcv" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"
                    )}>
                      {pm === "bcv" ? "BCV" : "Divisas"}
                    </span>
                  )}
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold leading-none text-gray-600">
                    {tier}
                  </span>
                </div>
                <span className="flex items-center gap-1.5 text-lg font-semibold">
                  {repricingCart
                    ? <Loader2 size={16} className="animate-spin text-gray-400" />
                    : <span>${cartTotal.toFixed(2)} USD</span>}
                </span>
              </div>
            );
          })()}

          {/* Cliente opcional — solo tienda, sin dirección/envío */}
          {channel === "tienda" && (
            showAddCustomer ? (
              <div className="rounded-xl border bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">Cliente</p>
                  <button type="button" onClick={() => setShowAddCustomer(false)}
                    className="text-gray-300 hover:text-gray-500"><X size={14} /></button>
                </div>

                <div className="space-y-1.5">
                  <Label>Documento (opcional)</Label>
                  <div className="flex gap-2">
                    <Select
                      value={customer.doc_type}
                      onValueChange={(v) => {
                        setCustomer((p) => ({ ...p, doc_type: v as DocType, doc_number: "", customer_name: "", customer_lastname: "", customer_phone: "" }));
                        setCustomerFound(false);
                        setFieldErrors((p) => ({ ...p, doc_number: "" }));
                      }}
                    >
                      <SelectTrigger className="w-32">
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
                          setCustomer((p) => ({ ...p, doc_number: val, customer_name: "", customer_lastname: "", customer_phone: "" }));
                          setCustomerFound(false);
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
                  <p className="text-xs text-gray-400">Si lo agregas, la venta queda asociada al cliente en Clientes.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nombre</Label>
                    <Input
                      value={customer.customer_name}
                      readOnly={customerFound}
                      onChange={(e) => {
                        if (customerFound) return;
                        setCustomer((p) => ({ ...p, customer_name: e.target.value }));
                      }}
                      onBlur={(e) => !customerFound && blurField("customer_name", e.target.value)}
                      maxLength={50}
                      placeholder="Ana"
                      className={cn(
                        customerFound ? "cursor-default bg-gray-50 text-gray-700 focus:ring-0 focus:border-input" : "",
                        fieldErrors.customer_name && "border-red-400"
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Apellido</Label>
                    <Input
                      value={customer.customer_lastname}
                      readOnly={customerFound}
                      onChange={(e) => {
                        if (customerFound) return;
                        setCustomer((p) => ({ ...p, customer_lastname: e.target.value }));
                      }}
                      onBlur={(e) => !customerFound && blurField("customer_lastname", e.target.value)}
                      maxLength={50}
                      placeholder="García"
                      className={cn(
                        customerFound ? "cursor-default bg-gray-50 text-gray-700 focus:ring-0 focus:border-input" : "",
                        fieldErrors.customer_lastname && "border-red-400"
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Teléfono</Label>
                  <Input
                    value={customer.customer_phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 11);
                      setCustomer((p) => ({ ...p, customer_phone: val }));
                    }}
                    onBlur={(e) => blurField("customer_phone", e.target.value)}
                    placeholder="04121234567"
                    inputMode="numeric"
                    className={cn(fieldErrors.customer_phone && "border-red-400")}
                  />
                  {fieldErrors.customer_phone && (
                    <p className="text-xs text-red-500">{fieldErrors.customer_phone}</p>
                  )}
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setShowAddCustomer(true)}
                className="text-sm text-gray-500 hover:text-gray-800 underline underline-offset-2">
                <span>+ Agregar cliente</span>
              </button>
            )
          )}

          {/* Reparto por moneda (opcional) — apagado por defecto, el flujo de una sola
              moneda de siempre queda igual mientras nadie lo active */}
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <label className={cn(
              "flex items-center justify-between gap-3",
              payments.length === 0 && "cursor-pointer"
            )}>
              <span className="text-sm font-medium text-gray-700">
                Dividir este pedido entre BCV y Divisas
              </span>
              <input
                type="checkbox"
                checked={splitEnabled}
                disabled={payments.length > 0 || repricingCart}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  if (enabled) { setSplitEnabled(true); return; }
                  // Al apagar el switch, el carrito debe volver a su precio de una sola
                  // moneda — sin esto, líneas que quedaron divididas seguían bajando el
                  // total aunque el switch ya estuviera apagado.
                  setRepricingCart(true);
                  fetch(`/api/carts/${cart.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reset_split: true }),
                  })
                    .then((r) => r.ok ? r.json() : null)
                    .then((data) => { if (data) setCartData(data); })
                    .catch(() => null)
                    .finally(() => { setSplitEnabled(false); setRepricingCart(false); });
                }}
                className="h-4 w-4 rounded border-gray-300 disabled:opacity-50"
              />
            </label>
            {payments.length > 0 && (
              <p className="text-xs text-gray-400">
                Elimina los pagos registrados para poder ajustar el reparto.
              </p>
            )}
            {splitEnabled && (
              <div className="border-t pt-3">
                <div className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-x-2 gap-y-2">
                  <span className="text-[10px] font-medium uppercase text-gray-400">Producto</span>
                  <span className="text-center text-[10px] font-medium uppercase text-gray-400">Divisas</span>
                  <span className="text-center text-[10px] font-medium uppercase text-gray-400">BCV</span>
                  {cartData.items.map((item) => {
                    const disabled = payments.length > 0 || splittingVariant === item.variant_id;
                    return (
                      <Fragment key={item.variant_id}>
                        <div className="min-w-0 text-sm">
                          <p className="truncate font-medium">{item.variant.product.name}</p>
                          <p className="text-xs text-gray-400">
                            {item.variant.size} · cantidad: {item.quantity}
                          </p>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={item.quantity}
                          key={`d-${item.variant_id}-${item.quantity_divisas}`}
                          defaultValue={item.quantity_divisas}
                          disabled={disabled}
                          onChange={(e) => clampSplitInput(e, item.quantity)}
                          onBlur={(e) => {
                            const raw = Math.round(Number(e.currentTarget.value));
                            const divisas = Number.isFinite(raw) ? Math.min(Math.max(0, raw), item.quantity) : item.quantity_divisas;
                            applySplit(item.variant_id, item.quantity, item.quantity - divisas);
                          }}
                          className="w-full rounded border border-input bg-background px-2 py-1 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-50"
                        />
                        <input
                          type="number"
                          min={0}
                          max={item.quantity}
                          key={`b-${item.variant_id}-${item.quantity_bcv}`}
                          defaultValue={item.quantity_bcv}
                          disabled={disabled}
                          onChange={(e) => clampSplitInput(e, item.quantity)}
                          onBlur={(e) => {
                            const raw = Math.round(Number(e.currentTarget.value));
                            const bcv = Number.isFinite(raw) ? Math.min(Math.max(0, raw), item.quantity) : item.quantity_bcv;
                            applySplit(item.variant_id, item.quantity, bcv);
                          }}
                          className="w-full rounded border border-input bg-background px-2 py-1 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-50"
                        />
                      </Fragment>
                    );
                  })}
                </div>
                <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span className="text-gray-600">
                    <span>Total Divisas: </span><strong className="text-gray-900">${cartData.total_divisas_usd.toFixed(2)}</strong>
                    <span> · Total BCV: </span><strong className="text-gray-900">${cartData.total_bcv_usd.toFixed(2)}</strong>
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  En el siguiente paso agrega los pagos correspondientes a cada moneda.
                </p>
              </div>
            )}
          </div>

          {/* Tasas de referencia */}
          {tasaLoading && (
            <div className="flex items-center gap-1.5 rounded-xl border bg-white px-5 py-3 text-sm text-gray-400">
              <Loader2 size={14} className="animate-spin" /> <span>Cargando tasas…</span>
            </div>
          )}
          {!tasaLoading && tasa && (
            <div className="w-full sm:w-fit rounded-xl border bg-white px-5 py-3">
              <p className="mb-1.5 text-xs font-medium text-gray-400">Tasas de referencia</p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-800">USD</span> <span>{fmtBs(tasa.rate)} Bs.</span>
                {tasa.stale && <AlertTriangle size={11} className="inline ml-1 text-amber-500" />}
                {tasa.eur_rate != null && <span> · <span className="font-semibold text-gray-800">EUR</span> <span>{fmtBs(tasa.eur_rate)} Bs.</span></span>}
                {tasa.paralelo_rate != null && <span> · <span className="font-semibold text-gray-800">Paralelo</span> <span>{fmtBs(tasa.paralelo_rate)} Bs.</span></span>}
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

          {(remaining > 0.005 || editingIndex !== null) && (() => {
            // Sin split: el primer pago fija la familia de moneda de todos los siguientes
            // (comportamiento de siempre). Con split activo: el primer pago fija una familia,
            // y a partir del segundo solo se ofrece la OTRA — cada moneda se cubre con pagos
            // de su propia familia, guiando el flujo típico de un pedido dividido en dos partes.
            const firstFamily: "bcv" | "divisas" | null = noPaymentsYet
              ? null
              : DIVISAS_TYPES.includes(committedPayments[0].payment_type as PaymentType) ? "divisas" : "bcv";
            const lockedMethod: "bcv" | "divisas" | null = noPaymentsYet
              ? null
              : splitEnabled
                ? (firstFamily === "bcv" ? "divisas" : "bcv")
                : firstFamily;
            const allowedTypes: PaymentType[] = lockedMethod === "bcv" ? BCV_TYPES
              : lockedMethod === "divisas" ? DIVISAS_TYPES
              : [...BCV_TYPES, ...DIVISAS_TYPES];
            return (<div className="rounded-xl border bg-white p-5 space-y-4 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-700">
                  {editingIndex !== null ? "Editar pago" : "Agregar pago"}
                </h2>
                {lockedMethod && (
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none",
                    lockedMethod === "bcv" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"
                  )}>
                    {lockedMethod === "bcv" ? "Solo BCV" : "Solo Divisas"}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Tipo *</Label>
                  <select
                    value={draft.payment_type}
                    onChange={(e) => {
                      const now = new Date();
                      const isEfectivo = e.target.value === "efectivo_bs" || e.target.value === "efectivo_usd";
                      setDraft((p) => ({
                        ...p,
                        payment_type: e.target.value as PaymentType,
                        reference: isEfectivo ? "" : p.reference,
                        payment_date: isEfectivo ? getVenezuelaDateString(now) : p.payment_date,
                        payment_time: isEfectivo ? getVenezuelaTimeString(now) : p.payment_time,
                      }));

                      // Only reprice when there are no committed payments locking the method
                      // and the vendor hasn't opted into a per-line split
                      if (!splitEnabled && noPaymentsYet) {
                        const newMethod = DIVISAS_TYPES.includes(e.target.value as PaymentType) ? "divisas" : "bcv";
                        if (newMethod !== cartData.pricing_method) {
                          setRepricingCart(true);
                          fetch(`/api/carts/${cart.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ pricing_method: newMethod }),
                          })
                            .then((r) => r.ok ? r.json() : null)
                            .then((data) => { if (data) setCartData(data); })
                            .catch(() => null)
                            .finally(() => setRepricingCart(false));
                        }
                      }
                    }}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {Object.entries(PAYMENT_TYPE_LABELS)
                      .filter(([k]) => allowedTypes.includes(k as PaymentType))
                      .map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Monto USD *</Label>
                  {(() => {
                    const num = parseFloat(draft.amount_usd);
                    const draftIsBcv = BCV_TYPES.includes(draft.payment_type as PaymentType);
                    const maxAmt = (isMixed ? (draftIsBcv ? remainingBcv : remainingDivisas) : remaining) + 1.00;
                    const projRemainingBcv = remainingBcv - (draftIsBcv && !isNaN(num) ? num : 0);
                    const projRemainingDivisas = remainingDivisas - (!draftIsBcv && !isNaN(num) ? num : 0);
                    const projRemaining = remaining - (isNaN(num) ? 0 : num);
                    const wouldCloseShort = isMixed && !isNaN(num) && num > 0 &&
                      projRemaining <= 0.005 && (projRemainingBcv > 1.00 || projRemainingDivisas > 1.00);
                    const shortCurrency = projRemainingBcv > 1.00 ? "BCV" : "Divisas";
                    const shortAmount = projRemainingBcv > 1.00 ? projRemainingBcv : projRemainingDivisas;
                    const montoError =
                      draft.amount_usd && (isNaN(num) || num <= 0)
                        ? "Monto inválido"
                        : draft.amount_usd && num > maxAmt
                        ? `Máximo $${maxAmt.toFixed(2)} (redondeo)`
                        : draft.amount_usd && wouldCloseShort
                        ? `Dejaría el total cubierto, pero faltarían $${shortAmount.toFixed(2)} en ${shortCurrency}`
                        : null;
                    const amountBs = tasa && !isNaN(num) && num > 0 ? num * tasa.rate : null;
                    return (
                      <div className="space-y-1">
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={draft.amount_usd}
                          onFocus={(e) => e.currentTarget.select()}
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
                              <span>Tasa: Bs. {fmtBs(tasa!.rate)} × $1</span>
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
              {draft.payment_type !== "efectivo_bs" && draft.payment_type !== "efectivo_usd" && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:max-w-sm">
                  <div className="w-full min-w-0 sm:flex-1 space-y-1.5">
                    <Label>Fecha</Label>
                    <Input type="date" value={draft.payment_date}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setDraft((p) => ({ ...p, payment_date: e.target.value }))}
                      className="appearance-none" />
                  </div>
                  <div className="w-full min-w-0 sm:w-32 sm:shrink-0 space-y-1.5">
                    <Label>Hora</Label>
                    <Input type="time" value={draft.payment_time}
                      onChange={(e) => setDraft((p) => ({ ...p, payment_time: e.target.value }))}
                      className="appearance-none" />
                  </div>
                </div>
              )}
              {(() => {
                const draftRefConfig = getPaymentReferenceConfig(draft.payment_type);
                if (!draftRefConfig.required) return null;
                return (
                  <>
                    <div className="space-y-1.5">
                      <Label>{draftRefConfig.label}</Label>
                      <Input value={draft.reference}
                        onChange={(e) => setDraft((p) => ({ ...p, reference: e.target.value }))}
                        placeholder={draftRefConfig.placeholder}
                        maxLength={draftRefConfig.maxLength}
                        className="font-mono" />
                      {draftRefConfig.hint && <p className="text-xs text-gray-400">{draftRefConfig.hint}</p>}
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
                          <Image src={getOptimizedCloudinaryUrl(draft.payment_photo, 600)} alt="Comprobante" width={80} height={80}
                            loading="lazy"
                            className="mt-1 h-16 w-16 rounded object-cover"
                            onError={() => setPaymentPhotoError(true)} />
                        )
                      )}
                    </div>
                  </>
                );
              })()}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addPayment}
                  disabled={
                    repricingCart ||
                    !draft.amount_usd ||
                    isNaN(parseFloat(draft.amount_usd)) ||
                    parseFloat(draft.amount_usd) <= 0
                  }
                >
                  {editingIndex !== null ? (
                    <>
                      <Check size={14} className="mr-1" />
                      <span>Guardar cambios</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} className="mr-1" />
                      <span>Agregar pago</span>
                    </>
                  )}
                </Button>
                {editingIndex !== null && (
                  <Button type="button" variant="ghost" onClick={cancelEdit}>
                    <X size={14} className="mr-1" />
                    <span>Cancelar</span>
                  </Button>
                )}
              </div>
            </div>);
          })()}

          {/* Pago parcial: siempre requiere cliente registrado; admin ve etiqueta distinta.
              No se permite en pedidos divididos entre dos monedas — cada moneda debe quedar
              cubierta con sus propios pagos antes de cerrar la orden. */}
          {payments.length > 0 && remaining > 0.005 && (
            isMixed ? (
              <p className="text-xs text-gray-400 border rounded-lg px-3 py-2 bg-gray-50">
                Este pedido está dividido entre BCV y Divisas — no se puede dejar como pago parcial.
              </p>
            ) : (channel === "tienda"
              ? customer.customer_name.trim() && customer.customer_lastname.trim()
              : customer.doc_number.trim())
              ? (
                <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
                  <input type="checkbox" checked={isPartialAgreed}
                    onChange={(e) => setIsPartialAgreed(e.target.checked)}
                    className="rounded border-gray-300" />
                  <span>
                    {isAdmin ? (
                      <span>Pago parcial acordado — marcar como <strong>Pago parcial</strong> aunque no cubra el total</span>
                    ) : (
                      <span>Cliente de confianza — registrar con <strong>pago parcial</strong> pendiente de completar</span>
                    )}
                  </span>
                </label>
              ) : channel === "tienda" ? (
                <p className="text-xs text-gray-400 border rounded-lg px-3 py-2 bg-gray-50">
                  Para registrar pago parcial en tienda, agrega el nombre del cliente (botón &ldquo;+ Agregar cliente&rdquo;).
                </p>
              ) : null
          )}

          {hasStockIssues && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle size={15} className="text-orange-500 mt-0.5 shrink-0" />
              <AlertDescription className="text-orange-800 text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span>
                    <strong>Stock insuficiente:</strong> {error && (error.includes("Stock insuficiente") || error.includes("agotado")) ? error.replace(/^Stock insuficiente:\s*/i, "") : "Hay productos en el pedido cuya cantidad excede las unidades disponibles en stock. Debes ajustar o retirar esas prendas en el Paso 1 para poder crear la orden."}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setError(null); setStep(1); }} className="shrink-0 h-7 text-xs border-orange-300 text-orange-800 hover:bg-orange-100 font-medium">
                    Regresar al Paso 1
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {splitNeedsBothCurrencies && (
            <Alert variant="destructive">
              <AlertCircle size={14} />
              <AlertDescription>
                <span>Este pedido está dividido entre BCV y Divisas — no se puede cerrar pagando todo con una sola moneda. Agrega al menos un pago de la otra.</span>
              </AlertDescription>
            </Alert>
          )}

          {error && !(hasStockIssues && (error.includes("Stock insuficiente") || error.includes("agotado"))) && (
            <Alert variant="destructive">
              <AlertCircle size={14} />
              <AlertDescription><span>{error}</span></AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="ghost"
          disabled={step === 1}
          onClick={() => { setStep((s) => s - 1); setError(null); }}
        >
          <ChevronLeft size={14} className="mr-1" />
          <span>Anterior</span>
        </Button>

        {step < 3 ? (
          <Button
            disabled={
              checkingStepStock ||
              (step === 1 && hasStockIssues) ||
              (step === 2 && (!step2Valid() || hasStockIssues))
            }
            onClick={async () => {
              setError(null);
              setCheckingStepStock(true);
              try {
                const r = await fetch(`/api/carts/${cart.id}`);
                if (r.ok) {
                  const freshCart: CartJSON = await r.json();
                  setCartData(freshCart);
                  if (freshCart.has_stock_issues) {
                    setError("Hay productos con stock insuficiente. Por favor verifica las cantidades en el Paso 1.");
                    setStep(1);
                    return;
                  }
                }
                setStep((s) => s + 1);
              } catch {
                setStep((s) => s + 1);
              } finally {
                setCheckingStepStock(false);
              }
            }}
          >
            {checkingStepStock && <Loader2 size={14} className="animate-spin mr-2" />}
            <span>Siguiente</span>
            <ChevronRight size={14} className="ml-1" />
          </Button>
        ) : (
          <div className="flex flex-col items-end gap-1.5">
            <Button
              disabled={
                submitting || payments.length === 0 || (!isPartialAgreed && remaining > 0.005) ||
                hasStockIssues || splitNeedsBothCurrencies
              }
              onClick={handleSubmit}
            >
              {submitting && <Loader2 size={14} className="animate-spin mr-2" />}
              <span>Crear orden</span>
            </Button>
            {!hasStockIssues && !isPartialAgreed && remaining > 0.005 && payments.length > 0 ? (
              <p className="text-xs text-gray-500">
                Faltan ${remaining.toFixed(2)} USD por cubrir para completar el pago.
              </p>
            ) : !hasStockIssues && payments.length === 0 ? (
              <p className="text-xs text-gray-500">
                Agrega al menos un pago para habilitar la creación de la orden.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
