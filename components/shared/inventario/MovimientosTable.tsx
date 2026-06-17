"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { MovementJSON, MovementType, MovementChannel } from "@/types";

type Props = {
  movements: MovementJSON[];
  total: number;
  page: number;
  totalPages: number;
};

const TYPE_LABELS: Record<MovementType, string> = {
  entrada: "Entrada",
  salida_venta: "Venta",
  ajuste: "Ajuste",
  devolucion: "Devolución",
};

const TYPE_COLORS: Record<MovementType, string> = {
  entrada: "bg-emerald-100 text-emerald-700",
  salida_venta: "bg-rose-100 text-rose-700",
  ajuste: "bg-amber-100 text-amber-700",
  devolucion: "bg-blue-100 text-blue-700",
};

const CHANNEL_LABELS: Record<MovementChannel, string> = {
  online: "Online",
  tienda: "Tienda",
  total: "Total",
};

export function MovimientosTable({ movements, total, page, totalPages }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [tipo, setTipo] = useState<string>(sp.get("tipo") ?? "");
  const [canal, setCanal] = useState<string>(sp.get("canal") ?? "");
  const [desde, setDesde] = useState<string>(sp.get("desde") ?? "");
  const [hasta, setHasta] = useState<string>(sp.get("hasta") ?? "");

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams();
    const vals = { q, tipo, canal, desde, hasta, page: String(page), ...Object.fromEntries(
      Object.entries(overrides).map(([k, v]) => [k, String(v)])
    )};
    Object.entries(vals).forEach(([k, v]) => { if (v && v !== "0") params.set(k, v); });
    return `/dashboard/inventario?${params.toString()}`;
  }

  function apply() {
    startTransition(() => router.push(buildUrl({ page: 1 })));
  }

  function clear() {
    setQ(""); setTipo(""); setCanal(""); setDesde(""); setHasta("");
    startTransition(() => router.push("/dashboard/inventario"));
  }

  const hasFilters = !!(sp.get("q") || sp.get("tipo") || sp.get("canal") || sp.get("desde") || sp.get("hasta"));

  return (
    <div className="space-y-4">
      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            placeholder="Buscar producto…" className="pl-8" />
        </div>

        <Select value={tipo || "all"} onValueChange={(v) => { setTipo(v === "all" ? "" : (v ?? "")); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="entrada">Entrada</SelectItem>
            <SelectItem value="salida_venta">Venta</SelectItem>
            <SelectItem value="ajuste">Ajuste</SelectItem>
            <SelectItem value="devolucion">Devolución</SelectItem>
          </SelectContent>
        </Select>

        <Select value={canal || "all"} onValueChange={(v) => { setCanal(v === "all" ? "" : (v ?? "")); }}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="tienda">Tienda</SelectItem>
            <SelectItem value="total">Total</SelectItem>
          </SelectContent>
        </Select>

        <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-36" />
        <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-36" />

        <Button size="sm" onClick={apply} disabled={isPending}>
          {isPending ? <Loader2 size={14} className="animate-spin" /> : "Filtrar"}
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clear} disabled={isPending}>
            <X size={14} className="mr-1" />Limpiar
          </Button>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="whitespace-nowrap">Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Talla</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">Antes</TableHead>
              <TableHead className="text-right">Cambio</TableHead>
              <TableHead className="text-right">Después</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Responsable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center text-sm text-gray-400">
                  No hay movimientos con los filtros aplicados
                </TableCell>
              </TableRow>
            ) : (
              movements.map((m) => (
                <TableRow key={m.id} className="hover:bg-gray-50/50">
                  <TableCell className="whitespace-nowrap text-xs text-gray-500" suppressHydrationWarning>
                    {new Date(m.created_at).toLocaleString("es-VE", {
                      day: "2-digit", month: "2-digit", year: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    <p className="truncate text-sm font-medium">{m.variant.product.name}</p>
                    {m.variant.product.color && (
                      <p className="text-xs text-gray-400">{m.variant.product.color}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{m.variant.size}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[m.type]}`}>
                      {TYPE_LABELS[m.type]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-600">{CHANNEL_LABELS[m.channel]}</span>
                  </TableCell>
                  <TableCell className="text-right text-sm text-gray-500">{m.qty_before}</TableCell>
                  <TableCell className="text-right">
                    <span className={`text-sm font-semibold ${m.qty_change > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">{m.qty_after}</TableCell>
                  <TableCell className="max-w-[160px]">
                    <p className="truncate text-xs text-gray-500">{m.reason ?? "—"}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-gray-600">
                    {m.created_by_user.name}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {total} movimiento{total !== 1 ? "s" : ""}
            {" · "}página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || isPending}
              onClick={() => startTransition(() => router.push(buildUrl({ page: page - 1 })))}>
              <ChevronLeft size={15} />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages || isPending}
              onClick={() => startTransition(() => router.push(buildUrl({ page: page + 1 })))}>
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
