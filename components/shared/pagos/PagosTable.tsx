"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { PagoOrdenJSON } from "@/types";
import type { PaymentType } from "@/app/generated/prisma/client";

const METODO_LABELS: Record<PaymentType, string> = {
  efectivo:      "Efectivo",
  transferencia: "Transferencia",
  zelle:         "Zelle",
  pago_movil:    "Pago Móvil",
  usdt:          "USDT",
};

const METODO_CLASSES: Record<PaymentType, string> = {
  efectivo:      "bg-emerald-100 text-emerald-800",
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

  const [q,      setQ]      = useState(sp.get("q") ?? "");
  const [metodo, setMetodo] = useState(sp.get("metodo") ?? "");
  const [desde,  setDesde]  = useState(sp.get("desde") ?? "");
  const [hasta,  setHasta]  = useState(sp.get("hasta") ?? "");

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
  function clear() {
    setQ(""); setMetodo(""); setDesde(""); setHasta("");
    start(() => router.push("/dashboard/pagos"));
  }

  const hasFilters = !!(sp.get("q") || sp.get("metodo") || sp.get("desde") || sp.get("hasta"));

  // Unique payment types per order for badges
  function getMethodBadges(payments: PagoOrdenJSON["payments"]) {
    const seen = new Set<PaymentType>();
    return payments.filter((p) => {
      if (seen.has(p.payment_type)) return false;
      seen.add(p.payment_type);
      return true;
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            placeholder="Nombre, # de orden o referencia…"
            className="pl-8"
          />
        </div>

        <Select value={metodo || "all"} onValueChange={(v) => setMetodo(v === "all" ? "" : (v ?? ""))}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Método de pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los métodos</SelectItem>
            <SelectItem value="efectivo">Efectivo</SelectItem>
            <SelectItem value="transferencia">Transferencia</SelectItem>
            <SelectItem value="zelle">Zelle</SelectItem>
            <SelectItem value="pago_movil">Pago Móvil</SelectItem>
            <SelectItem value="usdt">USDT</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="w-36"
        />
        <Input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="w-36"
        />

        <Button size="sm" onClick={apply} disabled={isPending}>
          {isPending ? <Loader2 size={14} className="animate-spin" /> : "Filtrar"}
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
            <TableRow className="bg-gray-50">
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
                  .map((p) => p.reference)
                  .slice(0, 2);
                const isParcial = o.paid_usd < o.total_usd - 0.01;

                return (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer hover:bg-gray-50/50"
                    onClick={() => router.push(`/dashboard/pagos/${o.id}`)}
                  >
                    <TableCell className="font-mono text-xs font-semibold text-gray-700">
                      {o.order_number}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">
                        {o.customer_name} {o.customer_lastname}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          o.channel === "online"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {o.channel === "online" ? "Online" : "Tienda"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {badges.map((p) => (
                          <Badge
                            key={p.id}
                            className={`text-xs ${METODO_CLASSES[p.payment_type]}`}
                            variant="outline"
                          >
                            {METODO_LABELS[p.payment_type]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[160px]">
                      {refs.length > 0 ? (
                        <p className="truncate font-mono text-xs text-gray-600">
                          {refs.join(" · ")}
                        </p>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ${o.total_usd.toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        isParcial ? "text-orange-600" : "text-emerald-600"
                      }`}
                    >
                      ${o.paid_usd.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          o.status === "pago_parcial"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {o.status === "pago_parcial" ? "Pago parcial" : "Pendiente pago"}
                      </span>
                    </TableCell>
                    <TableCell
                      className="whitespace-nowrap text-xs text-gray-500"
                      suppressHydrationWarning
                    >
                      {new Date(o.created_at).toLocaleDateString("es-VE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {total} orden{total !== 1 ? "es" : ""} · página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isPending}
              onClick={() => start(() => router.push(buildUrl({ page: page - 1 })))}
            >
              <ChevronLeft size={15} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPending}
              onClick={() => start(() => router.push(buildUrl({ page: page + 1 })))}
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
