"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { shortOrderNumber } from "@/lib/order-utils";
import { useTransition, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { OrderStatusBadge } from "@/components/shared/ordenes/OrderStatusBadge";
import { Search, X, Loader2 } from "lucide-react";
import { Pagination } from "@/components/shared/Pagination";
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

const STATUS_LABELS: Record<string, string> = {
  pendiente_pago:  "Pendiente pago",
  pago_parcial:    "Pago parcial",
  pago_verificado: "Pago verificado",
  en_embalaje:     "En embalaje",
  enviada:         "Enviada",
  completada:      "Completada",
  cancelada:       "Cancelada",
};

export function OrdersTable({ orders, total, page, totalPages, sellers, isAdmin }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, start] = useTransition();

  const today = new Date().toISOString().split("T")[0];

  const [q,        setQ]        = useState(sp.get("q") ?? "");
  const [status,   setStatus]   = useState<string>(sp.get("status") ?? "");
  const [channel,  setChannel]  = useState<string>(sp.get("channel") ?? "");
  const [seller,   setSeller]   = useState<string>(sp.get("seller") ?? "");
  const [desde,    setDesde]    = useState(sp.get("desde") ?? "");
  const [hasta,    setHasta]    = useState(sp.get("hasta") ?? "");

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams();
    const vals: Record<string, string> = { q, status, channel, seller, desde, hasta, page: String(page), ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])) };
    Object.entries(vals).forEach(([k, v]) => { if (v && v !== "0") params.set(k, v); });
    return `/dashboard/ordenes?${params.toString()}`;
  }

  function apply() { start(() => router.push(buildUrl({ page: 1 }))); }
  function clear() {
    setQ(""); setStatus(""); setChannel(""); setSeller(""); setDesde(""); setHasta("");
    start(() => router.push("/dashboard/ordenes"));
  }

  const hasFilters = !!(sp.get("q") || sp.get("status") || sp.get("channel") || sp.get("seller") || sp.get("desde") || sp.get("hasta"));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            placeholder="Nombre, cédula o # de orden…" className="pl-8" />
        </div>

        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : (v ?? ""))}>
          <SelectTrigger className="w-44">
            <span data-slot="select-value" className="flex-1 text-left">
              {STATUS_LABELS[status] ?? "Todos los estados"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pendiente_pago">Pendiente pago</SelectItem>
            <SelectItem value="pago_parcial">Pago parcial</SelectItem>
            <SelectItem value="pago_verificado">Pago verificado</SelectItem>
            <SelectItem value="en_embalaje">En embalaje</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
            <SelectItem value="completada">Completada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>

        <Select value={channel || "all"} onValueChange={(v) => setChannel(v === "all" ? "" : (v ?? ""))}>
          <SelectTrigger className="w-32">
            <span data-slot="select-value" className="flex-1 text-left">
              {channel === "online" ? "Online" : channel === "tienda" ? "Tienda" : "Todos"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="tienda">Tienda</SelectItem>
          </SelectContent>
        </Select>

        {isAdmin && sellers.length > 0 && (
          <Select value={seller || "all"} onValueChange={(v) => setSeller(v === "all" ? "" : (v ?? ""))}>
            <SelectTrigger className="w-44">
              <span data-slot="select-value" className="flex-1 text-left">
                {seller ? (sellers.find((s) => s.id === seller)?.name ?? "Todas") : "Todas"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {sellers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-gray-400">Desde</span>
          <Input type="date" value={desde} max={today} onChange={(e) => setDesde(e.target.value)} className="w-36" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-gray-400">Hasta</span>
          <Input type="date" value={hasta} max={today} onChange={(e) => setHasta(e.target.value)} className="w-36" />
        </div>

        <Button variant="outline" onClick={apply} disabled={isPending} className="rounded-full px-4">
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <><Search size={13} />Filtrar</>}
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clear} disabled={isPending}>
            <X size={14} className="mr-1" />Limpiar
          </Button>
        )}
      </div>

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
