"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useRef, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, SlidersHorizontal, X, Loader2 } from "lucide-react";
import { Pagination } from "@/components/shared/Pagination";
import { cn } from "@/lib/utils";
import type { MovementJSON, MovementType, MovementChannel } from "@/types";

type Props = {
  movements: MovementJSON[];
  total: number;
  page: number;
  totalPages: number;
  tallas: string[];
};

const TYPE_LABELS: Record<MovementType, string> = {
  entrada:      "Entrada",
  salida_venta: "Venta",
  ajuste:       "Ajuste",
  devolucion:   "Devolución",
};

const TYPE_COLORS: Record<MovementType, string> = {
  entrada:      "bg-emerald-100 text-emerald-700",
  salida_venta: "bg-rose-100 text-rose-700",
  ajuste:       "bg-amber-100 text-amber-700",
  devolucion:   "bg-blue-100 text-blue-700",
};

const CHANNEL_LABELS: Record<MovementChannel, string> = {
  online: "Online",
  tienda: "Tienda",
  total:  "Total",
};

export function MovimientosTable({ movements, total, page, totalPages, tallas }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split("T")[0];

  const [q,     setQ]     = useState(sp.get("q")     ?? "");
  const [talla, setTalla] = useState(sp.get("talla") ?? "");
  const [tipo,  setTipo]  = useState(sp.get("tipo")  ?? "");
  const [canal, setCanal] = useState(sp.get("canal") ?? "");
  const [desde, setDesde] = useState(sp.get("desde") ?? "");
  const [hasta, setHasta] = useState(sp.get("hasta") ?? "");

  const [searchOpen,  setSearchOpen]  = useState(!!sp.get("q"));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tmpTalla, setTmpTalla] = useState("");
  const [tmpTipo,  setTmpTipo]  = useState("");
  const [tmpCanal, setTmpCanal] = useState("");
  const [tmpDesde, setTmpDesde] = useState("");
  const [tmpHasta, setTmpHasta] = useState("");

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams();
    const vals = {
      tab: "movimientos", q, talla, tipo, canal, desde, hasta,
      page: String(page),
      ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])),
    };
    Object.entries(vals).forEach(([k, v]) => { if (v && v !== "0") params.set(k, v); });
    return `/dashboard/inventario?${params.toString()}`;
  }

  function apply() {
    startTransition(() => router.push(buildUrl({ page: 1 })));
  }

  function clearSearch() {
    setQ(""); setSearchOpen(false);
    startTransition(() => router.push(buildUrl({ q: "", page: 1 })));
  }

  function openFilters() {
    setTmpTalla(talla); setTmpTipo(tipo); setTmpCanal(canal);
    setTmpDesde(desde); setTmpHasta(hasta);
    setFiltersOpen(true);
  }

  function applyFilters() {
    setTalla(tmpTalla); setTipo(tmpTipo); setCanal(tmpCanal);
    setDesde(tmpDesde); setHasta(tmpHasta);
    setFiltersOpen(false);
    const params = new URLSearchParams();
    params.set("tab", "movimientos");
    if (q)        params.set("q",     q);
    if (tmpTalla) params.set("talla", tmpTalla);
    if (tmpTipo)  params.set("tipo",  tmpTipo);
    if (tmpCanal) params.set("canal", tmpCanal);
    if (tmpDesde) params.set("desde", tmpDesde);
    if (tmpHasta) params.set("hasta", tmpHasta);
    startTransition(() => router.push(`/dashboard/inventario?${params.toString()}`));
  }

  function clearFilters() {
    setTmpTalla(""); setTmpTipo(""); setTmpCanal(""); setTmpDesde(""); setTmpHasta("");
    setTalla("");    setTipo("");    setCanal("");    setDesde("");    setHasta("");
    setFiltersOpen(false);
    const params = new URLSearchParams();
    params.set("tab", "movimientos");
    if (q) params.set("q", q);
    startTransition(() => router.push(`/dashboard/inventario?${params.toString()}`));
  }

  const activeFilterCount = [
    sp.get("talla"), sp.get("tipo"), sp.get("canal"), sp.get("desde"), sp.get("hasta"),
  ].filter(Boolean).length;

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
              placeholder="Buscar por nombre o talla…"
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
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Tipo de movimiento</p>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(TYPE_LABELS) as [MovementType, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setTmpTipo(tmpTipo === value ? "" : value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      tmpTipo === value
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
                {(Object.entries(CHANNEL_LABELS) as [MovementChannel, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setTmpCanal(tmpCanal === value ? "" : value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      tmpCanal === value
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 text-gray-600 hover:border-gray-400"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fechas */}
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
            <Button
              variant="ghost"
              onClick={clearFilters}
              disabled={isPending || (!tmpTalla && !tmpTipo && !tmpCanal && !tmpDesde && !tmpHasta && !talla && !tipo && !canal && !desde && !hasta)}
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

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
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

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        noun="movimiento"
        isPending={isPending}
        onPrev={() => startTransition(() => router.push(buildUrl({ page: page - 1 })))}
        onNext={() => startTransition(() => router.push(buildUrl({ page: page + 1 })))}
      />
    </div>
  );
}
