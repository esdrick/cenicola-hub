"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, SlidersHorizontal, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  tipos:  string[];
  colors: string[];
  tallas: string[];
};

export function ProductFilters({ tipos, colors, tallas }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const [q,     setQ]     = useState(sp.get("q")     ?? "");
  const [tipo,  setTipo]  = useState(sp.get("tipo")  ?? "");
  const [color, setColor] = useState(sp.get("color") ?? "");
  const [talla, setTalla] = useState(sp.get("talla") ?? "");

  // Temp values while the dialog is open
  const [tmpTipo,  setTmpTipo]  = useState("");
  const [tmpColor, setTmpColor] = useState("");
  const [tmpTalla, setTmpTalla] = useState("");

  const [searchOpen,  setSearchOpen]  = useState(!!sp.get("q"));
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  function navigate(vals: { q: string; tipo: string; color: string; talla: string }) {
    const p = new URLSearchParams();
    if (vals.q)     p.set("q",     vals.q);
    if (vals.tipo)  p.set("tipo",  vals.tipo);
    if (vals.color) p.set("color", vals.color);
    if (vals.talla) p.set("talla", vals.talla);
    startTransition(() => router.push(`/dashboard/productos?${p.toString()}`));
  }

  function applySearch() {
    navigate({ q, tipo, color, talla });
  }

  function clearSearch() {
    setQ("");
    setSearchOpen(false);
    navigate({ q: "", tipo, color, talla });
  }

  function openFilters() {
    setTmpTipo(tipo);
    setTmpColor(color);
    setTmpTalla(talla);
    setFiltersOpen(true);
  }

  function applyFilters() {
    setTipo(tmpTipo); setColor(tmpColor); setTalla(tmpTalla);
    setFiltersOpen(false);
    navigate({ q, tipo: tmpTipo, color: tmpColor, talla: tmpTalla });
  }

  function clearFilters() {
    setTmpTipo(""); setTmpColor(""); setTmpTalla("");
    setTipo("");    setColor("");    setTalla("");
    setFiltersOpen(false);
    navigate({ q, tipo: "", color: "", talla: "" });
  }

  const activeFilterCount = [sp.get("tipo"), sp.get("color"), sp.get("talla")].filter(Boolean).length;

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Search */}
        {searchOpen ? (
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
                if (e.key === "Escape" && !q) setSearchOpen(false);
              }}
              placeholder="Buscar por nombre…"
              className="pl-9 pr-9"
            />
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
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

        {/* Filter button */}
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

            {/* Color */}
            {colors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Color</p>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setTmpColor(tmpColor === c ? "" : c)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        tmpColor === c
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 text-gray-600 hover:border-gray-400"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Talla */}
            {tallas.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Talla</p>
                <div className="flex flex-wrap gap-2">
                  {tallas.map((s) => (
                    <button
                      key={s}
                      onClick={() => setTmpTalla(tmpTalla === s ? "" : s)}
                      className={cn(
                        "min-w-[2.5rem] rounded-lg border px-2.5 py-1 text-sm font-medium transition-colors",
                        tmpTalla === s
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 text-gray-600 hover:border-gray-400"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              onClick={clearFilters}
              disabled={isPending || (!tmpTipo && !tmpColor && !tmpTalla && !tipo && !color && !talla)}
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
    </>
  );
}
