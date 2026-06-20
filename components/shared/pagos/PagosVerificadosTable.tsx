"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { shortOrderNumber } from "@/lib/order-utils";
import { useTransition, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Search, X, Loader2, CheckCircle2 } from "lucide-react";
import { Pagination } from "@/components/shared/Pagination";
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

export type PagoVerificadoJSON = {
  id: string;
  payment_type: PaymentType;
  amount_usd: number;
  reference: string;
  payment_date: string;
  created_at: string;
  verified_at: string | null;
  verifier: { id: string; name: string } | null;
  order: {
    id: string;
    order_number: string;
    channel: string;
    customer_name: string;
    customer_lastname: string;
    creator: { id: string; name: string };
  };
};

type Props = {
  payments: PagoVerificadoJSON[];
  total: number;
  page: number;
  totalPages: number;
};

export function PagosVerificadosTable({ payments, total, page, totalPages }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, start] = useTransition();

  const today = new Date().toISOString().split("T")[0];

  const [q,      setQ]      = useState(sp.get("q") ?? "");
  const [metodo, setMetodo] = useState(sp.get("metodo") ?? "");
  const [desde,  setDesde]  = useState(sp.get("desde") ?? "");
  const [hasta,  setHasta]  = useState(sp.get("hasta") ?? "");

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams();
    const vals: Record<string, string> = {
      q, metodo, desde, hasta, tab: "verificados", page: String(page),
      ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])),
    };
    Object.entries(vals).forEach(([k, v]) => { if (v && v !== "0") params.set(k, v); });
    return `/dashboard/pagos?${params.toString()}`;
  }

  function apply() { start(() => router.push(buildUrl({ page: 1 }))); }
  function clear() {
    setQ(""); setMetodo(""); setDesde(""); setHasta("");
    start(() => router.push("/dashboard/pagos?tab=verificados"));
  }

  const hasFilters = !!(sp.get("q") || sp.get("metodo") || sp.get("desde") || sp.get("hasta"));

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
            <span data-slot="select-value" className="flex-1 text-left">
              {metodo ? (METODO_LABELS[metodo as PaymentType] ?? metodo) : "Todos los métodos"}
            </span>
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

        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-gray-400">Desde</span>
          <Input type="date" value={desde} max={today} onChange={(e) => setDesde(e.target.value)} className="w-36" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-gray-400">Hasta</span>
          <Input type="date" value={hasta} max={today} onChange={(e) => setHasta(e.target.value)} className="w-36" />
        </div>

        <Button variant="outline" onClick={apply} disabled={isPending} className="rounded-full px-4">
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <><Search size={13} className="mr-1" />Filtrar</>}
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
              <TableHead>Gestionó</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Referencia</TableHead>
              <TableHead className="text-right">Monto USD</TableHead>
              <TableHead>Confirmado por</TableHead>
              <TableHead className="whitespace-nowrap">Fecha confirmación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-sm text-gray-400">
                  No hay pagos confirmados
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-gray-50/50"
                  onClick={() => {
                    const qs = sp.toString();
                    router.push(`/dashboard/pagos/${p.order.id}?from=${encodeURIComponent("/dashboard/pagos" + (qs ? "?" + qs : ""))}`);
                  }}
                >
                  <TableCell className="font-mono text-xs font-semibold text-gray-700">
                    {shortOrderNumber(p.order.order_number)}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">
                      {p.order.customer_name} {p.order.customer_lastname}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {p.order.creator.name}
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.order.channel === "online"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {p.order.channel === "online" ? "Online" : "Tienda"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs border-0 ${METODO_CLASSES[p.payment_type]}`}>
                      {METODO_LABELS[p.payment_type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[140px]">
                    {p.reference && p.reference !== "EFECTIVO" ? (
                      <p className="truncate font-mono text-xs text-gray-600">{p.reference}</p>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-emerald-700">
                    ${p.amount_usd.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {p.verifier ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                        <span className="text-sm text-gray-700">{p.verifier.name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                        <span className="text-sm text-gray-700">Venta de tienda</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-gray-500" suppressHydrationWarning>
                    {new Date(p.verified_at ?? p.created_at).toLocaleDateString("es-VE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
        noun="pago"
        nounPlural="pagos"
        isPending={isPending}
        onPrev={() => start(() => router.push(buildUrl({ page: page - 1 })))}
        onNext={() => start(() => router.push(buildUrl({ page: page + 1 })))}
      />
    </div>
  );
}
