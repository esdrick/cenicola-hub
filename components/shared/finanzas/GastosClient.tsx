"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Plus, Loader2, Search, X } from "lucide-react";
import { DialogTrigger } from "@/components/ui/dialog";

type GastoJSON = {
  id: string;
  category: string;
  description: string;
  amount_usd: number;
  expense_date: string;
  notas: string | null;
  creator: { id: string; name: string };
  created_at: string;
};

type Props = {
  data: GastoJSON[];
  filterCategoria?: string;
  filterDesde?: string;
  filterHasta?: string;
};

const CATEGORIAS = [
  { value: "operativo", label: "Operativo" },
  { value: "logistica", label: "Logística" },
  { value: "nomina", label: "Nómina" },
  { value: "otro", label: "Otro" },
];

const CAT_CLASSES: Record<string, string> = {
  operativo: "bg-blue-100 text-blue-800",
  logistica: "bg-purple-100 text-purple-800",
  nomina: "bg-emerald-100 text-emerald-800",
  otro: "bg-gray-100 text-gray-700",
};

const todayStr = new Date().toISOString().slice(0, 10);

export function GastosClient({ data, filterCategoria = "", filterDesde = "", filterHasta = "" }: Props) {
  const router = useRouter();
  const [isPending, start] = useTransition();

  // Form state
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("operativo");
  const [fecha, setFecha] = useState(todayStr);
  const [notas, setNotas] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Filters
  const [filterCat, setFilterCat] = useState(filterCategoria);
  const [filterD, setFilterD] = useState(filterDesde);
  const [filterH, setFilterHasta] = useState(filterHasta);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<GastoJSON | null>(null);

  function applyFilters() {
    const params = new URLSearchParams();
    if (filterCat) params.set("categoria", filterCat);
    if (filterD) params.set("desde", filterD);
    if (filterH) params.set("hasta", filterH);
    router.push(`/dashboard/finanzas/gastos?${params}`);
  }

  function resetFilters() {
    setFilterCat("");
    setFilterD("");
    setFilterHasta("");
    router.push("/dashboard/finanzas/gastos");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!descripcion.trim()) { setFormError("La descripción es requerida"); return; }
    if (!monto || isNaN(Number(monto)) || Number(monto) <= 0) { setFormError("Monto inválido"); return; }

    start(async () => {
      try {
        const res = await fetch("/api/finanzas/gastos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ descripcion: descripcion.trim(), monto: Number(monto), categoria, fecha, notas: notas.trim() || null }),
        });
        const json = await res.json();
        if (!res.ok) { setFormError(json.error ?? "Error al guardar"); return; }
        setDescripcion(""); setMonto(""); setCategoria("operativo"); setFecha(todayStr); setNotas("");
        setCreateOpen(false);
        router.refresh();
      } catch {
        setFormError("Error de conexión");
      }
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    start(async () => {
      try {
        const res = await fetch(`/api/finanzas/gastos/${deleteTarget.id}`, { method: "DELETE" });
        if (!res.ok) {
          const json = await res.json();
          setFormError(json.error ?? "Error al eliminar");
        } else {
          router.refresh();
        }
      } catch {
        setFormError("Error de conexión");
      } finally {
        setDeleteTarget(null);
      }
    });
  }

  const totalVisible = data.reduce((s, g) => s + g.amount_usd, 0);

  return (
    <div className="space-y-5">
      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setFormError(null); }}>
        <DialogTrigger render={<Button className="gap-2" />}>
          <Plus size={15} /> Registrar gasto
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar gasto</DialogTitle>
            <DialogDescription>Completa los campos para agregar un nuevo gasto.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Descripción *</Label>
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Pago de alquiler oficina"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Monto (USD) *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={monto}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoría *</Label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
                disabled={isPending}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0 space-y-1">
              <Label className="text-xs">Fecha *</Label>
              <Input
                type="date"
                value={fecha}
                max={todayStr}
                onChange={(e) => setFecha(e.target.value)}
                disabled={isPending}
                className="appearance-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notas</Label>
              <Input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Opcional"
                disabled={isPending}
              />
            </div>
            {formError && (
              <p className="sm:col-span-2 text-sm text-red-600">{formError}</p>
            )}
            <DialogFooter className="sm:col-span-2">
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                Guardar gasto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Categoría</Label>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm"
          >
            <option value="">Todas</option>
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-xs text-gray-500">Desde</Label>
          <Input type="date" value={filterD} max={todayStr} onChange={(e) => setFilterD(e.target.value)} className="w-36 max-w-full text-sm appearance-none" />
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-xs text-gray-500">Hasta</Label>
          <Input type="date" value={filterH} max={todayStr} onChange={(e) => setFilterHasta(e.target.value)} className="w-36 max-w-full text-sm appearance-none" />
        </div>
        <Button variant="outline" onClick={applyFilters} className="rounded-full px-4">
          <Search size={13} className="mr-1" />Filtrar
        </Button>
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          <X size={14} className="mr-1" />Limpiar
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold text-gray-900">
            Gastos registrados
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({data.length} registros)
            </span>
          </h2>
          <span className="text-sm font-semibold text-red-600">
            Total: ${totalVisible.toFixed(2)}
          </span>
        </div>

        {data.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No hay gastos registrados para este filtro.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead>Registrado por</TableHead>
                <TableHead className="text-center">Eliminar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium text-sm">{g.description}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs border-0 ${CAT_CLASSES[g.category] ?? "bg-gray-100 text-gray-700"}`}>
                      {CATEGORIAS.find((c) => c.value === g.category)?.label ?? g.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600" suppressHydrationWarning>
                    {new Date(g.expense_date + "T00:00:00").toLocaleDateString("es-VE")}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-sm">
                    ${g.amount_usd.toFixed(2)}
                  </TableCell>
                  <TableCell className="max-w-xs text-xs text-gray-500 truncate">
                    {g.notas ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">{g.creator.name}</TableCell>
                  <TableCell className="text-center">
                    <button
                      title="Eliminar gasto"
                      disabled={isPending}
                      onClick={() => setDeleteTarget(g)}
                      className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-40"
                    >
                      <Trash2 size={13} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar gasto</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar el gasto{" "}
              <strong>{deleteTarget?.description}</strong> por{" "}
              <strong>${deleteTarget?.amount_usd.toFixed(2)}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
