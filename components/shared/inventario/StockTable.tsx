"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useRef, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, SlidersHorizontal, X, Loader2, Download } from "lucide-react";
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
  tipos: string[];
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

export function StockTable({ variants, total, page, totalPages, lowStockThreshold, tallas, tipos }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [talla, setTalla] = useState(sp.get("talla") ?? "");
  const [tipo, setTipo] = useState(sp.get("tipo") ?? "");
  const [stockStatus, setStockStatus] = useState(sp.get("stock_status") ?? "");
  const [exporting, setExporting] = useState(false);

  const [searchOpen, setSearchOpen] = useState(!!sp.get("q"));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tmpTalla, setTmpTalla] = useState("");
  const [tmpTipo, setTmpTipo] = useState("");
  const [tmpStockStatus, setTmpStockStatus] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

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
  const activeFilterCount = [sp.get("talla"), sp.get("tipo"), sp.get("stock_status")].filter(Boolean).length;

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  function openFilters() {
    setTmpTalla(talla); setTmpTipo(tipo); setTmpStockStatus(stockStatus);
    setFiltersOpen(true);
  }

  function applyFilters() {
    setTalla(tmpTalla); setTipo(tmpTipo); setStockStatus(tmpStockStatus);
    setFiltersOpen(false);
    const params = new URLSearchParams();
    params.set("tab", "stock");
    if (q)             params.set("q", q);
    if (tmpTalla)      params.set("talla", tmpTalla);
    if (tmpTipo)       params.set("tipo", tmpTipo);
    if (tmpStockStatus) params.set("stock_status", tmpStockStatus);
    startTransition(() => router.push(`/dashboard/inventario?${params.toString()}`));
  }

  function clearFilters() {
    setTmpTalla(""); setTmpTipo(""); setTmpStockStatus("");
    setTalla("");    setTipo("");    setStockStatus("");
    setFiltersOpen(false);
    const params = new URLSearchParams();
    params.set("tab", "stock");
    if (q) params.set("q", q);
    startTransition(() => router.push(`/dashboard/inventario?${params.toString()}`));
  }

  function clearSearch() {
    setQ(""); setSearchOpen(false);
    startTransition(() => router.push(buildUrl({ q: "", page: 1 })));
  }

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
              placeholder="Buscar por nombre, talla o color…"
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

        {/* Export — always visible, pushed right */}
        <Button variant="outline" onClick={handleExport} disabled={exporting} className="ml-auto gap-1.5">
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          <span className="hidden sm:inline">Exportar Excel</span>
        </Button>
      </div>

      {/* Filter dialog */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Talla */}
            {tallas.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Talla</p>
                <div className="flex flex-wrap gap-2">
                  {tallas.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTmpTalla(tmpTalla === t ? "" : t)}
                      className={cn(
                        "min-w-[2.5rem] rounded-lg border px-2.5 py-1 text-sm font-medium transition-colors",
                        tmpTalla === t
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 text-gray-600 hover:border-gray-400"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tipo */}
            {tipos.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Tipo</p>
                <div className="flex flex-wrap gap-2">
                  {tipos.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTmpTipo(tmpTipo === t ? "" : t)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        tmpTipo === t
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 text-gray-600 hover:border-gray-400"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Estado de stock */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Estado de stock</p>
              <div className="flex gap-2">
                {[
                  { value: "",     label: "Todos" },
                  { value: "bajo", label: "Stock bajo" },
                  { value: "sin",  label: "Sin stock" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setTmpStockStatus(tmpStockStatus === value ? "" : value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      tmpStockStatus === value && value !== ""
                        ? "border-gray-900 bg-gray-900 text-white"
                        : value === "" && tmpStockStatus === ""
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 text-gray-600 hover:border-gray-400"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              onClick={clearFilters}
              disabled={isPending || (!tmpTalla && !tmpTipo && !tmpStockStatus && !talla && !tipo && !stockStatus)}
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
