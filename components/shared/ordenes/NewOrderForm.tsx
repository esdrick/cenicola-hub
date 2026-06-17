"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  AlertCircle, Loader2, Search, ShoppingCart, Trash2,
  Plus, Minus, ChevronRight, ChevronLeft, Check, Upload, Pencil, X,
} from "lucide-react";
import { PAYMENT_TYPE_LABELS } from "@/lib/order-utils";
import { cn } from "@/lib/utils";
import type { CartItem, PaymentFormInput, ProductJSON } from "@/types";
import type { PaymentType } from "@/app/generated/prisma/client";

// ─── Step indicator ───────────────────────────────────────────────────────────
const STEPS = ["Cliente", "Productos", "Pago"];

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
            i + 1 === step ? "bg-gray-900 text-white" :
            i + 1 < step  ? "bg-emerald-500 text-white" :
                            "bg-gray-100 text-gray-500"
          )}>
            {i + 1 < step ? <Check size={12} /> : i + 1}
          </div>
          <span className={cn(
            "text-sm",
            i + 1 === step ? "font-semibold text-gray-900" : "text-gray-400"
          )}>{label}</span>
          {i < STEPS.length - 1 && (
            <ChevronRight size={14} className="text-gray-300 mx-1" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── State types ──────────────────────────────────────────────────────────────
type CustomerData = {
  customer_name: string;
  customer_lastname: string;
  customer_id_doc: string;
  channel: "online" | "tienda" | "";
  address: string;
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

// ─── Main component ───────────────────────────────────────────────────────────
export function NewOrderForm({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1
  const [customer, setCustomer] = useState<CustomerData>({
    customer_name: "", customer_lastname: "", customer_id_doc: "",
    channel: "", address: "", shipping_company: "", notes: "",
  });

  // Step 2
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<ProductJSON[]>([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [variantQty, setVariantQty] = useState<Record<string, number>>({});
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 3
  const [payments, setPayments] = useState<PaymentFormInput[]>([]);
  const [draft, setDraft] = useState<PaymentFormInput>(makeEmptyPayment());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [isPartialAgreed, setIsPartialAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Product search ───────────────────────────────────────────────────────
  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const r = await fetch(`/api/products?q=${encodeURIComponent(q)}&page=1`);
      const j = await r.json();
      setResults(j.data ?? []);
    } catch { /* silent */ }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => search(searchQ), 300);
  }, [searchQ, search]);

  function channelStock(v: ProductJSON["variants"][0]) {
    return customer.channel === "online" ? v.stock_online : v.stock_store;
  }

  function addToCart(product: ProductJSON, variantId: string) {
    const v = product.variants.find((x) => x.id === variantId);
    if (!v) return;
    const maxQ = channelStock(v);
    if (maxQ < 1) return;
    const qty = Math.min(variantQty[variantId] ?? 1, maxQ);
    setCart((prev) => {
      const existing = prev.find((c) => c.variant_id === variantId);
      if (existing) {
        return prev.map((c) => c.variant_id === variantId
          ? { ...c, quantity: Math.min(c.quantity + qty, c.max_qty) }
          : c
        );
      }
      return [...prev, {
        variant_id: variantId,
        product_id: product.id,
        product_name: product.name,
        color: product.color,
        photo: product.photos[0] ?? null,
        size: v.size,
        sku: v.sku,
        unit_price_usd: v.price_usd,
        quantity: qty,
        max_qty: maxQ,
      }];
    });
    setVariantQty((p) => ({ ...p, [variantId]: 1 }));
  }

  function adjustCartQty(variantId: string, delta: number) {
    setCart((prev) => prev.map((c) => c.variant_id !== variantId ? c : {
      ...c, quantity: Math.max(1, Math.min(c.max_qty, c.quantity + delta)),
    }));
  }

  const cartTotal = cart.reduce((s, c) => s + c.unit_price_usd * c.quantity, 0);

  // ─── Payment photo upload ─────────────────────────────────────────────────
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
    // Validate intra-order duplicate references (skip self when editing)
    if (draft.payment_type !== "efectivo" && draft.reference.trim()) {
      const normRef = draft.reference.toUpperCase().replace(/[\s\-]/g, "");
      const dup = payments.find((p, i) =>
        i !== editingIndex &&
        p.payment_type !== "efectivo" &&
        p.payment_type === draft.payment_type &&
        p.reference.toUpperCase().replace(/[\s\-]/g, "") === normRef
      );
      if (dup) {
        setError(`Referencia duplicada: "${draft.reference}" ya está registrada en esta orden`);
        return;
      }
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

  // Exclude the payment being edited so its amount doesn't double-count
  const paidTotal = payments
    .filter((_, i) => i !== editingIndex)
    .reduce((s, p) => s + parseFloat(p.amount_usd || "0"), 0);
  const remaining = cartTotal - paidTotal;

  // ─── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError(null);
    if (payments.length === 0) { setError("Agrega al menos un pago"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customer.customer_name,
          customer_lastname: customer.customer_lastname,
          customer_id_doc: customer.customer_id_doc,
          channel: customer.channel,
          address: customer.address || null,
          shipping_company: customer.shipping_company || null,
          notes: customer.notes || null,
          is_partial_agreed: isPartialAgreed,
          items: cart.map((c) => ({
            variant_id: c.variant_id,
            quantity: c.quantity,
            unit_price_usd: c.unit_price_usd,
          })),
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

  function step1Valid() {
    if (!customer.customer_name.trim() || !customer.customer_lastname.trim() ||
        !customer.customer_id_doc.trim() || !customer.channel) return false;
    if (customer.channel === "online" &&
        (!customer.address.trim() || !customer.shipping_company.trim())) return false;
    return true;
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto">
      <StepIndicator step={step} />

      {/* ── Step 1: Customer ── */}
      {step === 1 && (
        <div className="rounded-xl border bg-white p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={customer.customer_name}
                onChange={(e) => setCustomer((p) => ({ ...p, customer_name: e.target.value }))}
                placeholder="Ana" />
            </div>
            <div className="space-y-1.5">
              <Label>Apellido *</Label>
              <Input value={customer.customer_lastname}
                onChange={(e) => setCustomer((p) => ({ ...p, customer_lastname: e.target.value }))}
                placeholder="García" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cédula *</Label>
            <Input value={customer.customer_id_doc}
              onChange={(e) => setCustomer((p) => ({ ...p, customer_id_doc: e.target.value }))}
              placeholder="V-12345678" />
          </div>
          <div className="space-y-1.5">
            <Label>Canal *</Label>
            <Select value={customer.channel}
              onValueChange={(v) => setCustomer((p) => ({ ...p, channel: v as "online" | "tienda" }))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar canal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="tienda">Tienda</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {customer.channel === "online" && (
            <>
              <div className="space-y-1.5">
                <Label>Dirección *</Label>
                <Input value={customer.address}
                  onChange={(e) => setCustomer((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Calle, urbanización, ciudad…" />
              </div>
              <div className="space-y-1.5">
                <Label>Empresa de envío *</Label>
                <Input value={customer.shipping_company}
                  onChange={(e) => setCustomer((p) => ({ ...p, shipping_company: e.target.value }))}
                  placeholder="Zoom, DHL, MRW…" />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea rows={2} value={customer.notes}
              onChange={(e) => setCustomer((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Instrucciones especiales…" />
          </div>
        </div>
      )}

      {/* ── Step 2: Cart ── */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Search panel */}
          <div className="rounded-xl border bg-white p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Buscar producto</h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Nombre del producto…" className="pl-8" />
            </div>
            {searching && (
              <p className="flex items-center gap-1.5 text-xs text-gray-400">
                <Loader2 size={12} className="animate-spin" />Buscando…
              </p>
            )}
            {results.length > 0 && (
              <div className="divide-y rounded-lg border">
                {results.map((product) => {
                  const isOpen = expanded === product.id;
                  const available = product.variants.filter((v) => channelStock(v) > 0);
                  return (
                    <div key={product.id}>
                      <button type="button"
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
                        onClick={() => setExpanded(isOpen ? null : product.id)}>
                        {product.photos[0] && (
                          <Image src={product.photos[0]} alt={product.name} width={36} height={36}
                            className="h-9 w-9 flex-shrink-0 rounded object-cover" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{product.name}</p>
                          {product.color && <p className="text-xs text-gray-400">{product.color}</p>}
                        </div>
                        <span className="text-xs text-gray-400 mr-1">{available.length} talla{available.length !== 1 ? "s" : ""}</span>
                        <ChevronRight size={14} className={cn("text-gray-400 transition-transform", isOpen && "rotate-90")} />
                      </button>
                      {isOpen && (
                        <div className="bg-gray-50 px-3 py-2 space-y-1">
                          {available.length === 0 ? (
                            <p className="py-1 text-xs text-gray-400">
                              Sin stock en {customer.channel === "online" ? "online" : "tienda"}
                            </p>
                          ) : available.map((v) => {
                            const stock = channelStock(v);
                            const inCart = cart.some((c) => c.variant_id === v.id);
                            return (
                              <div key={v.id} className="flex items-center gap-2 py-1 text-sm">
                                <span className="w-16 font-medium text-gray-700">{v.size}</span>
                                <span className="flex-1 text-xs text-gray-400">
                                  stock: {stock} · ${v.price_usd.toFixed(2)}
                                </span>
                                <Input type="number" min={1} max={stock}
                                  value={variantQty[v.id] ?? 1}
                                  onChange={(e) => setVariantQty((p) => ({
                                    ...p,
                                    [v.id]: Math.max(1, Math.min(stock, parseInt(e.target.value) || 1)),
                                  }))}
                                  className="h-7 w-14 px-1 text-center text-xs" />
                                <Button size="sm" className="h-7 px-2 text-xs"
                                  onClick={() => addToCart(product, v.id)}>
                                  {inCart ? "+" : "Agregar"}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="rounded-xl border bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <ShoppingCart size={14} />
                Carrito
                {cart.length > 0 && (
                  <span className="ml-1 rounded-full bg-gray-900 px-1.5 py-0.5 text-xs text-white">
                    {cart.length}
                  </span>
                )}
              </h2>
              {cart.length > 0 && (
                <p className="text-sm font-semibold">${cartTotal.toFixed(2)} USD</p>
              )}
            </div>
            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">El carrito está vacío</p>
            ) : (
              <div className="divide-y">
                {cart.map((item) => (
                  <div key={item.variant_id} className="flex items-center gap-3 py-2.5">
                    {item.photo && (
                      <Image src={item.photo} alt={item.product_name} width={40} height={40}
                        className="h-10 w-10 flex-shrink-0 rounded object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.product_name}</p>
                      <p className="text-xs text-gray-400">
                        {[item.color, item.size].filter(Boolean).join(" · ")} · ${item.unit_price_usd.toFixed(2)} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => adjustCartQty(item.variant_id, -1)}
                        className="rounded p-0.5 hover:bg-gray-100">
                        <Minus size={12} />
                      </button>
                      <span className="w-7 text-center text-sm font-medium">{item.quantity}</span>
                      <button type="button" onClick={() => adjustCartQty(item.variant_id, 1)}
                        disabled={item.quantity >= item.max_qty}
                        className="rounded p-0.5 hover:bg-gray-100 disabled:opacity-40">
                        <Plus size={12} />
                      </button>
                    </div>
                    <span className="w-16 text-right text-sm font-semibold">
                      ${(item.unit_price_usd * item.quantity).toFixed(2)}
                    </span>
                    <button type="button"
                      onClick={() => setCart((p) => p.filter((c) => c.variant_id !== item.variant_id))}
                      className="text-gray-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: Payment ── */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Order total summary */}
          <div className="flex items-center justify-between rounded-xl border bg-gray-50 px-5 py-3">
            <span className="text-sm text-gray-600">
              {cart.length} producto{cart.length !== 1 ? "s" : ""} · {cart.reduce((s, c) => s + c.quantity, 0)} unidades
            </span>
            <span className="text-lg font-semibold">${cartTotal.toFixed(2)} USD</span>
          </div>

          {/* Payments added */}
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
                    {p.reference && (
                      <span className="text-xs text-gray-400">ref: {p.reference}</span>
                    )}
                    <span className="text-xs text-gray-400">{p.payment_date}</span>
                    {isEditing && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        Editando…
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">${parseFloat(p.amount_usd).toFixed(2)}</span>
                    {!isEditing && (
                      <button type="button"
                        onClick={() => startEditing(i)}
                        className="text-gray-300 hover:text-blue-500"
                        title="Editar pago">
                        <Pencil size={13} />
                      </button>
                    )}
                    <button type="button"
                      onClick={() => {
                        if (isEditing) cancelEdit();
                        setPayments((prev) => prev.filter((_, j) => j !== i));
                      }}
                      className="text-gray-300 hover:text-red-500"
                      title="Eliminar pago">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );})}
              <div className={cn(
                "flex items-center justify-between px-4 py-2.5 text-sm font-semibold",
                remaining > 0.005 ? "text-orange-600" : "text-emerald-700"
              )}>
                <span>
                  {remaining > 0.005 ? `Pendiente: $${remaining.toFixed(2)} USD` : "Total cubierto"}
                </span>
                <span>{remaining > 0.005 ? "⚠" : "✓"}</span>
              </div>
            </div>
          )}

          {/* Add/edit payment form — visible when there's balance remaining OR when editing */}
          {(remaining > 0.005 || editingIndex !== null) && <div className="rounded-xl border bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">
              {editingIndex !== null ? "Editar pago" : "Agregar pago"}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={draft.payment_type}
                  onValueChange={(v) => {
                    const now = new Date();
                    const isEfectivo = v === "efectivo";
                    setDraft((p) => ({
                      ...p,
                      payment_type: v as PaymentType,
                      reference: isEfectivo ? "" : p.reference,
                      payment_date: isEfectivo ? now.toISOString().slice(0, 10) : p.payment_date,
                      payment_time: isEfectivo
                        ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
                        : p.payment_time,
                    }));
                  }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Monto USD *</Label>
                <Input type="number" min="0.01" step="0.01" value={draft.amount_usd}
                  onChange={(e) => setDraft((p) => ({ ...p, amount_usd: e.target.value }))}
                  placeholder="0.00" />
              </div>
            </div>
            {draft.payment_type !== "efectivo" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Fecha</Label>
                  <Input type="date" value={draft.payment_date}
                    onChange={(e) => setDraft((p) => ({ ...p, payment_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
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
                    <Button type="button" variant="outline" size="sm" disabled={uploading}
                      onClick={() => photoInputRef.current?.click()}>
                      {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    </Button>
                  </div>
                  {draft.payment_photo && (
                    <Image src={draft.payment_photo} alt="Comprobante" width={80} height={80}
                      className="mt-1 h-16 w-16 rounded object-cover" />
                  )}
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addPayment}>
                {editingIndex !== null
                  ? <><Check size={14} className="mr-1.5" />Guardar cambios</>
                  : <><Plus size={14} className="mr-1.5" />Agregar pago</>
                }
              </Button>
              {editingIndex !== null && (
                <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                  <X size={14} className="mr-1" />Cancelar
                </Button>
              )}
            </div>
          </div>}

          {isAdmin && remaining > 0.005 && (
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
              <input type="checkbox" checked={isPartialAgreed}
                onChange={(e) => setIsPartialAgreed(e.target.checked)}
                className="rounded border-gray-300" />
              <span>
                Pago parcial acordado — marcar como <strong>Pago parcial</strong> aunque no cubra el total
              </span>
            </label>
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
            disabled={step === 1 ? !step1Valid() : cart.length === 0}
            onClick={() => { setError(null); setStep((s) => s + 1); }}>
            Siguiente <ChevronRight size={14} className="ml-1" />
          </Button>
        ) : (
          <Button
            disabled={submitting || payments.length === 0 || (!isPartialAgreed && remaining > 0.005)}
            onClick={handleSubmit}>
            {submitting && <Loader2 size={14} className="animate-spin mr-2" />}
            Crear orden
          </Button>
        )}
      </div>
    </div>
  );
}
