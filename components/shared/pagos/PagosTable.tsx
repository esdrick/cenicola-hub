"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { shortOrderNumber } from "@/lib/order-utils";
import { useTransition, useState, useRef, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, SlidersHorizontal, X, Loader2 } from "lucide-react";
import { Pagination } from "@/components/shared/Pagination";
import { cn } from "@/lib/utils";
import type { PagoOrdenJSON } from "@/types";
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

type Props = {
  orders: PagoOrdenJSON[];
  total: number;
  page: number;
  totalPages: number;
};

export function PagosTable({ orders, total, page, totalPages }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, start] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split("T")[0];

  const [q,      setQ]      = useState(sp.get("q")      ?? "");
  const [metodo, setMetodo] = useState(sp.get("metodo") ?? "");
  const [desde,  setDesde]  = useState(sp.get("desde")  ?? "");
  const [hasta,  setHasta]  = useState(sp.get("hasta")  ?? "");

  const [searchOpen,  setSearchOpen]  = useState(!!sp.get("q"));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tmpMetodo, setTmpMetodo] = useState("");
  const [tmpDesde,  setTmpDesde]  = useState("");
  const [tmpHasta,  setTmpHasta]  = useState("");

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams();
    const vals: Record<string, string> = {
      q, metodo, desde, hasta, page: String(page),
      ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])),
    };
    Object.entries(vals).forEach(([k, v]) => { if (v && v !== "0") params.set(k, v); });
    return `/dashboard/pagos?${params.toString()}`;
  }

  function apply() { start(() => router.push(buildUrl({ page: 1 }))); }

  function clearSearch() {
    setQ(""); setSearchOpen(false);
    start(() => router.push(buildUrl({ q: "", page: 1 })));
  }

  function openFilters() {
    setTmpMetodo(metodo); setTmpDesde(desde); setTmpHasta(hasta);
    setFiltersOpen(true);
  }

  function applyFilters() {
    setMetodo(tmpMetodo); setDesde(tmpDesde); setHasta(tmpHasta);
    setFiltersOpen(false);
    const params = new URLSearchParams();
    if (q)         params.set("q",      q);
    if (tmpMetodo) params.set("metodo", tmpMetodo);
    if (tmpDesde)  params.set("desde",  tmpDesde);
    if (tmpHasta)  params.set("hasta",  tmpHasta);
    start(() => router.push(`/dashboard/pagos?${params.toString()}`));
  }

  function clearFilters() {
    setTmpMetodo(""); setTmpDesde(""); setTmpHasta("");
    setMetodo("");    setDesde("");    setHasta("");
    setFiltersOpen(false);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    start(() => router.push(`/dashboard/pagos?${params.toString()}`));
  }

  const activeFilterCount = [sp.get("metodo"), sp.get("desde"), sp.get("hasta")].filter(Boolean).length;

  function getMethodBadges(payments: PagoOrdenJSON["payments"]) {
    const seen = new Set<PaymentType>();
    return payments.filter((p) => {
      if (seen.has(p.payment_type)) return false;
      seen.add(p.payment_type); return true;
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        {searchOpen ? (
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply();
                if (e.key === "Escape" && !q) setSearchOpen(false);
              }}
              placeholder="Nombre, # de orden o referencia…"
              className="pl-9 pr-9"
            />
            <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
              <X size={14} />
            </button>
          </div>
        ) : (
          <Button
            variant="outline" size="icon"
            onClick={() => setSearchOpen(true)}
            title="Buscar"
            className={sp.get("q") ? "border-gray-900 text-gray-900" : ""}
          >
            <Search size={16} />
          </Button>
        )}

        <Button
          variant="outline"
          onClick={openFilters}
          className={cn("gap-2", activeFilterCount > 0 && "border-gray-900 text-gray-900")}
        >
          <SlidersHorizontal size={15} />
          Filtros
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-[10px] font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {isPending && <Loader2 size={14} className="animate-spin text-gray-400" />}
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Filtros</DialogTitle></DialogHeader>
          <div className="space-y-5 py-1">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Método de pago</p>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(METODO_LABELS) as [PaymentType, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setTmpMetodo(tmpMetodo === value ? "" : value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      tmpMetodo === value
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 text-gray-600 hover:border-gray-400"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Desde</Label>
                <Input type="date" value={tmpDesde} max={today} onChange={(e) => setTmpDesde(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Hasta</Label>
                <Input type="date" value={tmpHasta} max={today} onChange={(e) => setTmpHasta(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={clearFilters}
              disabled={isPending || (!tmpMetodo && !tmpDesde && !tmpHasta && !metodo && !desde && !hasta)}>
              Limpiar
            </Button>
            <Button onClick={applyFilters} disabled={isPending}>
              {isPending && <Loader2 size={14} className="animate-spin" />}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap"># Orden</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Método(s)</TableHead>
              <TableHead>Referencia(s)</TableHead>
              <TableHead className="text-right">Total USD</TableHead>
              <TableHead className="text-right">Pagado USD</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="whitespace-nowrap">Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-sm text-gray-400">
                  No hay pagos pendientes de verificación
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => {
                const badges = getMethodBadges(o.payments);
                const refs = o.payments
                  .filter((p) => p.reference && p.reference !== "EFECTIVO")
                  .map((p) => p.reference).slice(0, 2);
                const isParcial = o.paid_usd < o.total_usd - 0.01;
                return (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-gray-50/50"
                    onClick={() => {
                      const qs = sp.toString();
                      router.push(`/dashboard/pagos/${o.id}?from=${encodeURIComponent("/dashboard/pagos" + (qs ? "?" + qs : ""))}`);
                    }}>
                    <TableCell className="font-mono text-xs font-semibold text-gray-700">
                      {shortOrderNumber(o.order_number)}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{o.customer_name} {o.customer_lastname}</p>
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.channel === "online" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                        {o.channel === "online" ? "Online" : "Tienda"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {badges.map((p) => (
                          <Badge key={p.id} className={`text-xs ${METODO_CLASSES[p.payment_type]}`} variant="outline">
                            {METODO_LABELS[p.payment_type]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[160px]">
                      {refs.length > 0 ? (
                        <p className="truncate font-mono text-xs text-gray-600">{refs.join(" · ")}</p>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">${o.total_usd.toFixed(2)}</TableCell>
                    <TableCell className={`text-right font-semibold ${isParcial ? "text-orange-600" : "text-emerald-600"}`}>
                      ${o.paid_usd.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.status === "pago_parcial" ? "bg-orange-100 text-orange-800" : "bg-yellow-100 text-yellow-800"}`}>
                        {o.status === "pago_parcial" ? "Pago parcial" : "Pendiente pago"}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-gray-500" suppressHydrationWarning>
                      {new Date(o.created_at).toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={page} totalPages={totalPages} total={total}
        noun="orden" nounPlural="órdenes" isPending={isPending}
        onPrev={() => start(() => router.push(buildUrl({ page: page - 1 })))}
        onNext={() => start(() => router.push(buildUrl({ page: page + 1 })))}
      />
    </div>
  );
}
