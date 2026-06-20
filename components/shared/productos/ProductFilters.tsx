"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";

export function ProductFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [tipo, setTipo] = useState(sp.get("tipo") ?? "");
  const [color, setColor] = useState(sp.get("color") ?? "");

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams();
    const vals = { q, tipo, color, ...overrides };
    Object.entries(vals).forEach(([k, v]) => { if (v) params.set(k, v); });
    return `/dashboard/productos?${params.toString()}`;
  }

  function apply() {
    startTransition(() => router.push(buildUrl({})));
  }

  function clear() {
    setQ(""); setTipo(""); setColor("");
    startTransition(() => router.push("/dashboard/productos"));
  }

  const hasFilters = !!(sp.get("q") || sp.get("tipo") || sp.get("color"));

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative min-w-[220px] flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          placeholder="Buscar por nombre…"
          className="pl-8"
        />
      </div>

      <Input
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        placeholder="Tipo (ej: Blusa)"
        className="w-36"
      />

      <Input
        value={color}
        onChange={(e) => setColor(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        placeholder="Color"
        className="w-32"
      />

      <Button variant="outline" onClick={apply} disabled={isPending} className="rounded-full px-4">
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <><Search size={13} className="mr-1" />Filtrar</>}
      </Button>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clear} disabled={isPending}>
          <X size={14} className="mr-1" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
