"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Search, X, Loader2, Download } from "lucide-react";
import { Pagination } from "@/components/shared/Pagination";
import { cn } from "@/lib/utils";
import type { StockVariantJSON } from "@/types";

type Props = {
  variants: StockVariantJSON[];
  total: number;
  page: number;
  totalPages: number;
  lowStockThreshold: number;
  tallas: string[];
};

function rowBg(stock: number, low: number) {
  if (stock === 0) return "bg-red-50 hover:bg-red-100/60";
  if (stock < low) return "bg-amber-50 hover:bg-amber-100/60";
  return "hover:bg-gray-50/50";
}

function stockCell(stock: number, low: number) {
  if (stock === 0) return <span className="font-bold text-red-600">{stock}</span>;
  if (stock < low) return <span className="font-bold text-amber-600">{stock}</span>;
  return <span className="font-medium text-gray-900">{stock}</span>;
}

export function StockTable({ variants, total, page, totalPages, lowStockThreshold, tallas }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [talla, setTalla] = useState(sp.get("talla") ?? "");
  const [tipo, setTipo] = useState(sp.get("tipo") ?? "");
  const [stockStatus, setStockStatus] = useState(sp.get("stock_status") ?? "");
  const [exporting, setExporting] = useState(false);

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams();
    const vals = {
      tab: "stock",
      q, talla, tipo, stock_status: stockStatus,
      page: String(page),
      ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])),
    };
    Object.entries(vals).forEach(([k, v]) => { if (v && v !== "0") params.set(k, v); });
    return `/dashboard/inventario?${params.toString()}`;
  }

  function apply() {
    startTransition(() => router.push(buildUrl({ page: 1 })));
  }

  function clear() {
    setQ(""); setTalla(""); setTipo(""); setStockStatus("");
    startTransition(() => router.push("/dashboard/inventario?tab=stock"));
  }

  const hasFilters = !!(sp.get("q") || sp.get("talla") || sp.get("tipo") || sp.get("stock_status"));

  function handleExport() {
    const params = new URLSearchParams();
    const curQ = sp.get("q");
    const curTalla = sp.get("talla");
    const curTipo = sp.get("tipo");
    const curStatus = sp.get("stock_status");
    if (curQ) params.set("q", curQ);
    if (curTalla) params.set("talla", curTalla);
    if (curTipo) params.set("tipo", curTipo);
    if (curStatus) params.set("stock_status", curStatus);
    setExporting(true);
    const a = document.createElement("a");
    a.href = `/api/inventory/export?${params.toString()}`;
    a.download = "";
    a.click();
    setTimeout(() => setExporting(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            placeholder="Buscar por nombre, talla o color…" className="pl-8" />
        </div>

        <Select value={talla || "all"} onValueChange={(v) => setTalla(v == null || v === "all" ? "" : v)}>
          <SelectTrigger className="w-28">
            <span data-slot="select-value" className="flex-1 text-left">
              {talla || "Talla"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {tallas.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Input value={tipo} onChange={(e) => setTipo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          placeholder="Tipo (ej: Blusa)" className="w-36" />

        <Select value={stockStatus || "todos"} onValueChange={(v) => setStockStatus(v === "todos" ? "" : (v ?? ""))}>
          <SelectTrigger className="w-36">
            <span data-slot="select-value" className="flex-1 text-left">
              {stockStatus === "bajo" ? "Stock bajo" : stockStatus === "sin" ? "Sin stock" : "Todos"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="bajo">Stock bajo</SelectItem>
            <SelectItem value="sin">Sin stock</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={apply} disabled={isPending} className="rounded-full px-4">
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <><Search size={13} className="mr-1" />Filtrar</>}
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clear} disabled={isPending}>
            <X size={14} className="mr-1" />Limpiar
          </Button>
        )}

        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exporting}
          className="ml-auto"
        >
          {exporting
            ? <Loader2 size={14} className="animate-spin mr-1" />
            : <Download size={14} className="mr-1" />}
          Exportar Excel
        </Button>
      </div>

      {/* ── Leyenda ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-amber-200 border border-amber-300" />
          Stock bajo (&lt;{lowStockThreshold} unidades)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-red-200 border border-red-300" />
          Sin stock
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Talla</TableHead>
              <TableHead className="text-xs text-gray-400">SKU</TableHead>
              <TableHead className="text-right">Online</TableHead>
              <TableHead className="text-right">Tienda</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-gray-400">
                  No hay variantes con los filtros aplicados
                </TableCell>
              </TableRow>
            ) : (
              variants.map((v) => (
                <TableRow key={v.id} className={cn("transition-colors", rowBg(v.stock_total, lowStockThreshold))}>
                  <TableCell>
                    <Link
                      href={`/dashboard/productos/${v.product_id}`}
                      className="text-sm font-medium text-gray-900 hover:underline"
                    >
                      {v.product.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{v.product.type}</TableCell>
                  <TableCell className="text-sm text-gray-600">{v.product.color ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{v.size}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-400">{v.sku}</TableCell>
                  <TableCell className="text-right text-sm text-gray-600">{v.stock_online}</TableCell>
                  <TableCell className="text-right text-sm text-gray-600">{v.stock_store}</TableCell>
                  <TableCell className="text-right">{stockCell(v.stock_total, lowStockThreshold)}</TableCell>
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
        noun="variante"
        isPending={isPending}
        onPrev={() => startTransition(() => router.push(buildUrl({ page: page - 1 })))}
        onNext={() => startTransition(() => router.push(buildUrl({ page: page + 1 })))}
      />
    </div>
  );
}
