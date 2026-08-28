"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquareText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  ShoppingBag,
  Sparkles,
  RefreshCw,
  Zap,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParsedWhatsAppCustomer } from "@/lib/whatsapp-parser";

interface MatchedItem {
  quantity: number;
  productName: string;
  subtotalUsd: number;
  unitPriceUsd: number;
  officialUnitPrice: number;
  officialSubtotalUsd: number;
  parsedUnitPrice?: number;
  parsedSubtotalUsd?: number;
  isPriceTampered?: boolean;
  size: string;
  color?: string | null;
  tierTag?: string | null;
  matchStatus: "exact" | "partial" | "price_tampered" | "not_found";
  matchedVariant?: {
    id: string;
    product_id: string;
    product_name: string;
    size: string;
    color: string | null;
    stock: number;
    price_divisas: number;
    price_bcv: number;
    photo?: string;
  } | null;
  candidateVariants?: Array<{
    id: string;
    product_id: string;
    product_name: string;
    size: string;
    color: string | null;
    stock: number;
    price_divisas: number;
    price_bcv: number;
  }>;
}

const SAMPLE_WHATSAPP_MESSAGE = `¡Hola! Acabo de realizar el siguiente pedido en *Q´ FRANELAS*:

_________________________

*Resumen del pedido:*

*_6x - Xoxo Garza Azul Rey dama ($19.98)_*
Talla: UNIQUE | Color: Azul [Docena]

*🏺 Total USD: $19.98*

_________________________

*Esdrick Rebolledo villalobos*
📞 675514108
🆔 V-25072960
📍 MRW: La morita II
💵 Zelle

☝️ Por favor envía este mensaje y te atenderemos lo antes posible`;

export function ImportWhatsAppModal({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"input" | "review">("input");
  const [rawText, setRawText] = useState("");
  const [channel, setChannel] = useState<"online" | "tienda">("online");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parsed state
  const [customer, setCustomer] = useState<ParsedWhatsAppCustomer | null>(null);
  const [items, setItems] = useState<MatchedItem[]>([]);
  const [totalUsd, setTotalUsd] = useState(0);
  const [isAnyPriceTampered, setIsAnyPriceTampered] = useState(false);

  const [creatingCart, setCreatingCart] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);

  function resetState() {
    setStep("input");
    setRawText("");
    setError(null);
    setCustomer(null);
    setItems([]);
    setTotalUsd(0);
    setIsAnyPriceTampered(false);
  }

  async function handleAnalyze() {
    if (!rawText.trim()) {
      setError("Por favor pega el mensaje de WhatsApp");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/orders/parse-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, channel }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al procesar el mensaje");
      }

      setCustomer(data.parsedCustomer);
      setItems(data.items);
      setTotalUsd(data.totalUsd);
      setIsAnyPriceTampered(data.isAnyPriceTampered || false);
      setStep("review");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al analizar el mensaje";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectVariant(itemIdx: number, variantId: string) {
    setItems((prev) => {
      const copy = [...prev];
      const targetItem = copy[itemIdx];
      if (!targetItem || !targetItem.candidateVariants) return prev;

      const selected = targetItem.candidateVariants.find((v) => v.id === variantId);
      if (selected) {
        copy[itemIdx] = {
          ...targetItem,
          matchedVariant: {
            ...selected,
          },
          matchStatus: "exact",
        };
      }
      return copy;
    });
  }

  // 1-CLICK AUTOMATIC ORDER CREATION
  async function handleCreateDirectOrder() {
    if (!customer) return;
    setCreatingOrder(true);
    setError(null);

    try {
      const validItems = items.filter((i) => i.matchedVariant);
      if (validItems.length === 0) {
        throw new Error("Selecciona al menos un producto válido que coincida con el inventario");
      }

      const overrideVariants: Record<number, string> = {};
      items.forEach((item, idx) => {
        if (item.matchedVariant) {
          overrideVariants[idx] = item.matchedVariant.id;
        }
      });

      const res = await fetch("/api/orders/parse-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          channel,
          action: "create_order",
          customer,
          overrideVariants,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al registrar la orden directamente");
      }

      setOpen(false);
      resetState();
      router.push(`/dashboard/ordenes/${data.orderId}`);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrar la orden";
      setError(msg);
    } finally {
      setCreatingOrder(false);
    }
  }

  // SECONDARY ACTION: OPEN IN CART FOR MANUAL EDITING
  async function handleCreateCartAndProceed() {
    if (!customer) return;
    setCreatingCart(true);
    setError(null);

    try {
      const validItems = items.filter((i) => i.matchedVariant);
      if (validItems.length === 0) {
        throw new Error("Selecciona al menos un producto válido que coincida con el inventario");
      }

      const res = await fetch("/api/orders/parse-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, channel, action: "create_cart" }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al crear el carrito");
      }

      const params = new URLSearchParams({
        name: customer.customer_name || "",
        lastname: customer.customer_lastname || "",
        doc_type: customer.doc_type || "V",
        doc_number: customer.doc_number || "",
        phone: customer.phone || "",
        shipping_company: customer.shipping_company || "",
        shipping_address: customer.address || "",
        payment: customer.payment_method || "",
      });

      setOpen(false);
      resetState();
      router.push(`/dashboard/carritos/${data.cartId}/completar?${params.toString()}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar la orden";
      setError(msg);
    } finally {
      setCreatingCart(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) resetState();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" className={cn("gap-2 border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 font-medium", className)}>
            <MessageSquareText size={16} className="text-emerald-600" />
            Importar de WhatsApp
          </Button>
        }
      />
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <MessageSquareText className="text-emerald-600" />
            Importar Venta desde WhatsApp
          </DialogTitle>
          <DialogDescription>
            Pega el mensaje del pedido recibido por WhatsApp para extraer automáticamente los productos y datos del cliente.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="my-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === "input" ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                <Label htmlFor="channel" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Canal de la Venta
                </Label>
                <Select value={channel} onValueChange={(val) => { if (val) setChannel(val as "online" | "tienda"); }}>
                  <SelectTrigger id="channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Venta Online (Envío)</SelectItem>
                    <SelectItem value="tienda">Venta Tienda (Presencial)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 self-end mb-1"
                onClick={() => setRawText(SAMPLE_WHATSAPP_MESSAGE)}
              >
                <Sparkles size={14} className="mr-1" />
                Cargar mensaje de ejemplo
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rawText" className="text-sm font-medium text-gray-700">
                Texto del mensaje de WhatsApp
              </Label>
              <Textarea
                id="rawText"
                rows={10}
                placeholder="Pega aquí el mensaje que envió el cliente..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="font-mono text-xs leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAnalyze} disabled={loading || !rawText.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {loading ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" /> Analizando...
                  </>
                ) : (
                  <>
                    Analizar Mensaje <ArrowRight size={16} className="ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Customer Summary Card */}
            {customer && (
              <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-600">
                    <UserCheck size={15} className="text-emerald-600" /> Datos del Cliente Extraídos
                  </span>
                  <Badge variant="outline" className="bg-white text-emerald-700 border-emerald-200 font-semibold">
                    Documento: {customer.doc_type}-{customer.doc_number || "Sin Doc"}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">Nombre</Label>
                    <Input
                      value={customer.customer_name}
                      onChange={(e) => setCustomer({ ...customer, customer_name: e.target.value })}
                      className="bg-white h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Apellido</Label>
                    <Input
                      value={customer.customer_lastname}
                      onChange={(e) => setCustomer({ ...customer, customer_lastname: e.target.value })}
                      className="bg-white h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Teléfono</Label>
                    <Input
                      value={customer.phone}
                      onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                      className="bg-white h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Método de Pago</Label>
                    <Input
                      value={customer.payment_method}
                      onChange={(e) => setCustomer({ ...customer, payment_method: e.target.value })}
                      className="bg-white h-8 text-sm uppercase font-semibold"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Empresa de Envío</Label>
                    <Input
                      value={customer.shipping_company}
                      onChange={(e) => setCustomer({ ...customer, shipping_company: e.target.value })}
                      className="bg-white h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Dirección / Destino</Label>
                    <Input
                      value={customer.address}
                      onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                      className="bg-white h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Products Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-600">
                  <ShoppingBag size={15} className="text-emerald-600" /> Productos Detectados ({items.length})
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  Total Oficial Catálogo: ${totalUsd.toFixed(2)} USD
                </span>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-md border border-gray-200 bg-white space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {item.quantity}x {item.productName}
                        </div>
                        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2 mt-0.5">
                          <span>Talla: <strong>{item.size}</strong></span>
                          {item.color && <span>• Color: <strong>{item.color}</strong></span>}
                          {item.tierTag && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">[{item.tierTag}]</span>}
                          <span>• Precio oficial: <strong>${item.officialUnitPrice.toFixed(2)}</strong></span>
                          <span>• Subtotal: <strong>${item.officialSubtotalUsd.toFixed(2)}</strong></span>
                        </div>
                      </div>

                      <div>
                        {item.isPriceTampered ? (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-medium">
                            <AlertCircle size={12} className="mr-1" /> Precio Alterado (${item.parsedSubtotalUsd?.toFixed(2)} en texto)
                          </Badge>
                        ) : item.matchStatus === "exact" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                            <CheckCircle2 size={12} className="mr-1" /> Coincidencia Exacta
                          </Badge>
                        ) : item.matchStatus === "partial" ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                            <AlertTriangle size={12} className="mr-1" /> Parcial
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            <AlertCircle size={12} className="mr-1" /> No Encontrado
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Matched product indicator or variant selector */}
                    <div className="pt-2 border-t border-gray-100">
                      {item.matchedVariant ? (
                        <div className="flex items-center justify-between text-xs bg-emerald-50/60 p-2 rounded text-emerald-900">
                          <div>
                            <strong>Vinculado a:</strong> {item.matchedVariant.product_name} ({item.matchedVariant.size})
                            {item.matchedVariant.color ? ` - ${item.matchedVariant.color}` : ""}
                            <span className="ml-2 text-gray-500">Stock: {item.matchedVariant.stock} unds</span>
                          </div>
                          {item.candidateVariants && item.candidateVariants.length > 1 && (
                            <Select onValueChange={(val) => { if (typeof val === "string") handleSelectVariant(idx, val); }} value={item.matchedVariant.id}>
                              <SelectTrigger className="h-7 text-xs w-44 bg-white">
                                <SelectValue placeholder="Cambiar variante" />
                              </SelectTrigger>
                              <SelectContent>
                                {item.candidateVariants.map((cand) => (
                                  <SelectItem key={cand.id} value={cand.id}>
                                    {cand.product_name} ({cand.size}{cand.color ? ` - ${cand.color}` : ""})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      ) : item.candidateVariants && item.candidateVariants.length > 0 ? (
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-amber-900">Seleccionar producto coincidente:</Label>
                          <Select onValueChange={(val) => { if (typeof val === "string") handleSelectVariant(idx, val); }}>
                            <SelectTrigger className="h-8 text-xs bg-amber-50 border-amber-200">
                              <SelectValue placeholder="Elegir producto del inventario..." />
                            </SelectTrigger>
                            <SelectContent>
                              {item.candidateVariants.map((cand) => (
                                <SelectItem key={cand.id} value={cand.id}>
                                  {cand.product_name} - Talla {cand.size} ({cand.color || "Sin color"}) — Stock: {cand.stock}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                          No se encontró ningún producto activo en el inventario con el nombre &quot;{item.productName}&quot;. Puedes agregarlo manualmente después.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-gray-200">
              <Button variant="ghost" size="sm" onClick={() => setStep("input")}>
                <RefreshCw size={14} className="mr-1" /> Volver a pegar texto
              </Button>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateCartAndProceed}
                  disabled={creatingCart || creatingOrder || items.every((i) => !i.matchedVariant)}
                  className="gap-1.5"
                >
                  {creatingCart ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                  Editar en Carrito
                </Button>

                <Button
                  onClick={handleCreateDirectOrder}
                  disabled={isAnyPriceTampered || creatingOrder || creatingCart || items.every((i) => !i.matchedVariant)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-sm disabled:opacity-50 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {creatingOrder ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Guardando Venta...
                    </>
                  ) : (
                    <>
                      <Zap size={16} /> Registrar Venta Directa
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
