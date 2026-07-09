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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { OrderStatusBadge } from "@/components/shared/ordenes/OrderStatusBadge";
import { Search, SlidersHorizontal, X, Loader2 } from "lucide-react";
import { Pagination } from "@/components/shared/Pagination";
import { cn } from "@/lib/utils";
import type { OrderJSON } from "@/types";

type Seller = { id: string; name: string };
type Props = {
  orders: OrderJSON[];
  total: number;
  page: number;
  totalPages: number;
  sellers: Seller[];
  isAdmin: boolean;
};

const STATUS_OPTIONS = [
  { value: "pendiente_pago",  label: "Pendiente pago" },
  { value: "pago_parcial",    label: "Pago parcial" },
  { value: "pago_verificado", label: "Pago verificado" },
  { value: "en_embalaje",     label: "En embalaje" },
  { value: "enviada",         label: "Enviada" },
  { value: "completada",      label: "Completada" },
  { value: "cancelada",       label: "Cancelada" },
] as const;

export function OrdersTable({ orders, total, page, totalPages, sellers, isAdmin }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, start] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split("T")[0];

  const [q,       setQ]       = useState(sp.get("q")       ?? "");
  const [status,  setStatus]  = useState(sp.get("status")  ?? "");
  const [channel, setChannel] = useState(sp.get("channel") ?? "");
  const [seller,  setSeller]  = useState(sp.get("seller")  ?? "");
  const [desde,   setDesde]   = useState(sp.get("desde")   ?? "");
  const [hasta,   setHasta]   = useState(sp.get("hasta")   ?? "");

  const [searchOpen,  setSearchOpen]  = useState(!!sp.get("q"));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tmpStatus,  setTmpStatus]  = useState("");
  const [tmpChannel, setTmpChannel] = useState("");
  const [tmpSeller,  setTmpSeller]  = useState("");
  const [tmpDesde,   setTmpDesde]   = useState("");
  const [tmpHasta,   setTmpHasta]   = useState("");

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams();
    const vals: Record<string, string> = {
      q, status, channel, seller, desde, hasta, page: String(page),
      ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])),
    };
    Object.entries(vals).forEach(([k, v]) => { if (v && v !== "0") params.set(k, v); });
    return `/dashboard/ordenes?${params.toString()}`;
  }

  function apply() { start(() => router.push(buildUrl({ page: 1 }))); }

  function clearSearch() {
    setQ(""); setSearchOpen(false);
    start(() => router.push(buildUrl({ q: "", page: 1 })));
  }

  function openFilters() {
    setTmpStatus(status); setTmpChannel(channel); setTmpSeller(seller);
    setTmpDesde(desde);   setTmpHasta(hasta);
    setFiltersOpen(true);
  }

  function applyFilters() {
    setStatus(tmpStatus); setChannel(tmpChannel); setSeller(tmpSeller);
    setDesde(tmpDesde);   setHasta(tmpHasta);
    setFiltersOpen(false);
    const params = new URLSearchParams();
    if (q)          params.set("q",       q);
    if (tmpStatus)  params.set("status",  tmpStatus);
    if (tmpChannel) params.set("channel", tmpChannel);
    if (tmpSeller)  params.set("seller",  tmpSeller);
    if (tmpDesde)   params.set("desde",   tmpDesde);
    if (tmpHasta)   params.set("hasta",   tmpHasta);
    start(() => router.push(`/dashboard/ordenes?${params.toString()}`));
  }

  function clearFilters() {
    setTmpStatus(""); setTmpChannel(""); setTmpSeller(""); setTmpDesde(""); setTmpHasta("");
    setStatus("");    setChannel("");    setSeller("");    setDesde("");    setHasta("");
    setFiltersOpen(false);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    start(() => router.push(`/dashboard/ordenes?${params.toString()}`));
  }

  const activeFilterCount = [
    sp.get("status"), sp.get("channel"), sp.get("seller"), sp.get("desde"), sp.get("hasta"),
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        {/* Search */}
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
              placeholder="Nombre, cédula o # de orden…"
              className="pl-9 pr-9"
            />
            <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
              <X size={14} />
            </button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSearchOpen(true)}
            title="Buscar"
            className={sp.get("q") ? "border-gray-900 text-gray-900" : ""}
          >
            <Search size={16} />
          </Button>
        )}

        {/* Filters button */}
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

      {/* Filter dialog */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Estado */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Estado</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setTmpStatus(tmpStatus === value ? "" : value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      tmpStatus === value
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 text-gray-600 hover:border-gray-400"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Canal */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Canal</p>
              <div className="flex gap-2">
                {[{ value: "online", label: "Online" }, { value: "tienda", label: "Tienda" }].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setTmpChannel(tmpChannel === value ? "" : value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      tmpChannel === value
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 text-gray-600 hover:border-gray-400"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vendedora (admin only) */}
            {isAdmin && sellers.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Vendedora</p>
                <div className="flex flex-wrap gap-2">
                  {sellers.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setTmpSeller(tmpSeller === s.id ? "" : s.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        tmpSeller === s.id
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 text-gray-600 hover:border-gray-400"
                      )}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 space-y-1.5">
                <Label>Desde</Label>
                <Input type="date" value={tmpDesde} max={today} onChange={(e) => setTmpDesde(e.target.value)} className="appearance-none" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label>Hasta</Label>
                <Input type="date" value={tmpHasta} max={today} onChange={(e) => setTmpHasta(e.target.value)} className="appearance-none" />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              onClick={clearFilters}
              disabled={isPending || (!tmpStatus && !tmpChannel && !tmpSeller && !tmpDesde && !tmpHasta && !status && !channel && !seller && !desde && !hasta)}
            >
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
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total USD</TableHead>
              <TableHead>Vendedora</TableHead>
              <TableHead className="whitespace-nowrap">Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-gray-400">
                  No se encontraron órdenes
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => (
                <TableRow key={o.id} className="cursor-pointer hover:bg-gray-50/50"
                  onClick={() => router.push(`/dashboard/ordenes/${o.id}`)}>
                  <TableCell className="font-mono text-xs font-semibold text-gray-700">
                    {shortOrderNumber(o.order_number)}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{o.customer_name} {o.customer_lastname}</p>
                    <p className="text-xs text-gray-400">{o.customer_id_doc}</p>
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.channel === "online" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                      {o.channel === "online" ? "Online" : "Tienda"}
                    </span>
                  </TableCell>
                  <TableCell><OrderStatusBadge status={o.status} /></TableCell>
                  <TableCell className="text-right font-semibold">${o.total_usd.toFixed(2)}</TableCell>
                  <TableCell className="text-sm text-gray-600">{o.creator.name}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-gray-500" suppressHydrationWarning>
                    {new Date(o.created_at).toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        noun="orden"
        nounPlural="órdenes"
        isPending={isPending}
        onPrev={() => start(() => router.push(buildUrl({ page: page - 1 })))}
        onNext={() => start(() => router.push(buildUrl({ page: page + 1 })))}
      />
    </div>
  );
}
