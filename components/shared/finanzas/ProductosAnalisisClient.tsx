"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  Filter,
  ExternalLink,
  Store,
  Globe,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { rangoMes, rangoPorTipo } from "@/lib/payroll-periods";

type TopProducto = {
  id: string;
  name: string;
  type: string;
  color: string | null;
  photo: string | null;
  totalUnits: number;
  totalUsd: number;
  sizes: Record<string, number>;
};

type ProductoEstancado = {
  id: string;
  name: string;
  type: string;
  color: string | null;
  photo: string | null;
  stockTotal: number;
  stockOnline: number;
  stockStore: number;
};

type AnalisisData = {
  totalUnidades: number;
  totalFacturado: number;
  totalProductosDistintos: number;
  topProductos: TopProducto[];
  productosEstancados: ProductoEstancado[];
};

type Preset = "dia" | "semana" | "quincena" | "mes" | "custom";
type CanalFiltro = "all" | "online" | "tienda";

const MONTH = rangoMes(new Date());
const today = new Date().toISOString().slice(0, 10);

function fmtCurrency(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ProductosAnalisisClient() {
  const [desde, setDesde] = useState(MONTH.desde);
  const [hasta, setHasta] = useState(MONTH.hasta);
  const [appliedDesde, setAppliedDesde] = useState(MONTH.desde);
  const [appliedHasta, setAppliedHasta] = useState(MONTH.hasta);
  const [canal, setCanal] = useState<CanalFiltro>("all");
  const [activePreset, setActivePreset] = useState<Preset>("mes");

  const [data, setData] = useState<AnalisisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalisis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (appliedDesde) params.set("desde", appliedDesde);
      if (appliedHasta) params.set("hasta", appliedHasta);
      if (canal) params.set("canal", canal);
      const res = await fetch(`/api/finanzas/productos?${params}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError("No se pudo cargar la analítica de productos");
    } finally {
      setLoading(false);
    }
  }, [appliedDesde, appliedHasta, canal]);

  useEffect(() => {
    fetchAnalisis();
  }, [fetchAnalisis]);

  function applyCustom() {
    setAppliedDesde(desde);
    setAppliedHasta(hasta);
    setActivePreset("custom");
  }

  function applyPreset(preset: "dia" | "semana" | "quincena" | "mes") {
    const range = rangoPorTipo(preset, new Date());
    setDesde(range.desde);
    setHasta(range.hasta);
    setAppliedDesde(range.desde);
    setAppliedHasta(range.hasta);
    setActivePreset(preset);
  }

  const periodLabel =
    appliedDesde && appliedHasta
      ? `${appliedDesde} → ${appliedHasta}`
      : "Sin filtro de fecha";

  const maxUnitsProduct = data?.topProductos[0]?.totalUnits ?? 1;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full overflow-hidden">
      {/* Controles de Filtros */}
      <div className="rounded-xl border bg-white p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Presets rápido */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <Button
              variant={activePreset === "dia" ? "default" : "outline"}
              onClick={() => applyPreset("dia")}
              size="sm"
              className="text-xs px-2.5 h-8"
            >
              Hoy
            </Button>
            <Button
              variant={activePreset === "semana" ? "default" : "outline"}
              onClick={() => applyPreset("semana")}
              size="sm"
              className="text-xs px-2.5 h-8"
            >
              Esta semana
            </Button>
            <Button
              variant={activePreset === "quincena" ? "default" : "outline"}
              onClick={() => applyPreset("quincena")}
              size="sm"
              className="text-xs px-2.5 h-8"
            >
              Esta quincena
            </Button>
            <Button
              variant={activePreset === "mes" ? "default" : "outline"}
              onClick={() => applyPreset("mes")}
              size="sm"
              className="text-xs px-2.5 h-8"
            >
              Este mes
            </Button>
          </div>

          {/* Filtro por Canal */}
          <div className="flex items-center gap-1 rounded-lg border bg-gray-50 p-1 overflow-x-auto max-w-full">
            <button
              onClick={() => setCanal("all")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition ${
                canal === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Filter size={12} />
              Todos
            </button>
            <button
              onClick={() => setCanal("online")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition ${
                canal === "online" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Globe size={12} className="text-blue-500" />
              Online
            </button>
            <button
              onClick={() => setCanal("tienda")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition ${
                canal === "tienda" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Store size={12} className="text-emerald-500" />
              Tienda
            </button>
          </div>
        </div>

        {/* Inputs de Fecha y Aplicación */}
        <div className="flex flex-wrap items-end gap-2.5 sm:gap-3 pt-2 border-t">
          <div className="flex-1 min-w-[120px] sm:flex-initial space-y-1">
            <Label className="text-[11px] text-gray-500">Desde</Label>
            <Input
              type="date"
              value={desde}
              max={today}
              onChange={(e) => { setDesde(e.target.value); setActivePreset("custom"); }}
              className="w-full sm:w-36 text-xs h-8"
            />
          </div>
          <div className="flex-1 min-w-[120px] sm:flex-initial space-y-1">
            <Label className="text-[11px] text-gray-500">Hasta</Label>
            <Input
              type="date"
              value={hasta}
              max={today}
              onChange={(e) => { setHasta(e.target.value); setActivePreset("custom"); }}
              className="w-full sm:w-36 text-xs h-8"
            />
          </div>
          <Button
            onClick={applyCustom}
            disabled={loading || (!desde && !hasta)}
            variant={activePreset === "custom" ? "default" : "outline"}
            size="sm"
            className="w-full sm:w-auto rounded-md sm:rounded-full px-4 text-xs h-8"
          >
            {loading ? "Cargando..." : "Aplicar rango"}
          </Button>

          <p className="w-full sm:w-auto sm:ml-auto text-[11px] text-gray-400">
            Período: <span className="font-medium text-gray-700">{periodLabel}</span>
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs sm:text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Card className="p-3 sm:p-4">
          <CardHeader className="flex flex-row items-center justify-between p-0 pb-1.5 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Unidades vendidas</CardTitle>
            <div className="rounded-lg bg-emerald-50 p-1.5 sm:p-2">
              <ShoppingBag size={16} className="text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {loading ? "..." : (data?.totalUnidades ?? 0).toLocaleString("es-VE")}
            </p>
            <p className="mt-0.5 text-[11px] sm:text-xs text-gray-500">Piezas enviadas/completadas</p>
          </CardContent>
        </Card>

        <Card className="p-3 sm:p-4">
          <CardHeader className="flex flex-row items-center justify-between p-0 pb-1.5 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Total facturado</CardTitle>
            <div className="rounded-lg bg-blue-50 p-1.5 sm:p-2">
              <TrendingUp size={16} className="text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {loading ? "..." : fmtCurrency(data?.totalFacturado ?? 0)}
            </p>
            <p className="mt-0.5 text-[11px] sm:text-xs text-gray-500">Monto total en productos</p>
          </CardContent>
        </Card>

        <Card className="p-3 sm:p-4">
          <CardHeader className="flex flex-row items-center justify-between p-0 pb-1.5 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Modelos distintos</CardTitle>
            <div className="rounded-lg bg-purple-50 p-1.5 sm:p-2">
              <Package size={16} className="text-purple-600" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {loading ? "..." : (data?.totalProductosDistintos ?? 0)}
            </p>
            <p className="mt-0.5 text-[11px] sm:text-xs text-gray-500">Productos con al menos 1 venta</p>
          </CardContent>
        </Card>

        <Card className="p-3 sm:p-4">
          <CardHeader className="flex flex-row items-center justify-between p-0 pb-1.5 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Baja rotación (30d)</CardTitle>
            <div className="rounded-lg bg-amber-50 p-1.5 sm:p-2">
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <p className="text-xl sm:text-2xl font-bold text-amber-700">
              {loading ? "..." : (data?.productosEstancados.length ?? 0)}
            </p>
            <p className="mt-0.5 text-[11px] sm:text-xs text-gray-500">Productos con stock sin ventas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Top 10 Productos */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b px-4 sm:px-5 py-3 gap-1">
          <div>
            <h2 className="font-semibold text-sm sm:text-base text-gray-900">Top 10 productos más vendidos</h2>
            <p className="text-[11px] sm:text-xs text-gray-500">Ranking por número de unidades vendidas en el período</p>
          </div>
          <span className="text-[11px] text-gray-400">
            Mostrando {Math.min(10, data?.topProductos.length ?? 0)} de {data?.topProductos.length ?? 0}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs sm:text-sm text-gray-400 animate-pulse">
            Cargando análisis de productos...
          </div>
        ) : !data || data.topProductos.length === 0 ? (
          <div className="p-8 sm:p-10 text-center text-xs sm:text-sm text-gray-400">
            No hay ventas registradas en el período seleccionado
          </div>
        ) : (
          <div className="overflow-x-auto max-w-full">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-10 text-xs">#</TableHead>
                  <TableHead className="text-xs">Producto</TableHead>
                  <TableHead className="w-28 sm:w-36 text-xs">Unidades</TableHead>
                  <TableHead className="hidden md:table-cell text-xs">Desglose Tallas</TableHead>
                  <TableHead className="text-right text-xs">Total Facturado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topProductos.slice(0, 10).map((p, idx) => {
                  const pct = (p.totalUnits / maxUnitsProduct) * 100;
                  return (
                    <TableRow key={p.id} className="hover:bg-gray-50/80">
                      <TableCell className="font-bold text-gray-400 text-xs py-2.5 sm:py-3">{idx + 1}</TableCell>
                      <TableCell className="py-2.5 sm:py-3">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          {p.photo ? (
                            <Image
                              src={p.photo}
                              alt={p.name}
                              width={36}
                              height={36}
                              className="h-8 w-8 sm:h-9 sm:w-9 rounded-md object-cover border shrink-0"
                            />
                          ) : (
                            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-md bg-gray-100 text-gray-400 border shrink-0">
                              <Package size={16} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/productos/${p.id}`}
                              className="font-medium text-xs sm:text-sm text-gray-900 hover:text-blue-600 hover:underline block truncate max-w-[130px] sm:max-w-[200px] md:max-w-none"
                            >
                              {p.name}
                            </Link>
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                              <span className="capitalize">{p.type}</span>
                              {p.color && (
                                <>
                                  <span>·</span>
                                  <span>{p.color}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 sm:py-3">
                        <div className="space-y-1">
                          <span className="font-semibold text-xs sm:text-sm text-gray-900">
                            {p.totalUnits} {p.totalUnits === 1 ? "unid" : "unids"}
                          </span>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.max(5, pct)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-2.5 sm:py-3">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(p.sizes).map(([sz, qty]) => (
                            <Badge key={sz} variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 font-mono">
                              {sz}: {qty}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-xs sm:text-sm text-emerald-700 py-2.5 sm:py-3 whitespace-nowrap">
                        {fmtCurrency(p.totalUsd)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Alerta de Productos Estancados (Baja Rotación - Sin ventas en 30 días) */}
      {!loading && data && data.productosEstancados.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3">
            <div className="flex items-start gap-2.5">
              <div className="rounded-lg bg-amber-100 p-1.5 sm:p-2 mt-0.5 shrink-0">
                <AlertTriangle size={16} className="text-amber-700" />
              </div>
              <div>
                <h2 className="font-semibold text-xs sm:text-sm text-amber-950">
                  Productos estancados (Sin ventas en los últimos 30 días)
                </h2>
                <p className="text-[11px] sm:text-xs text-amber-800 leading-relaxed">
                  {data.productosEstancados.length} productos activos con inventario disponible que no han registrado ventas recientemente. Ideal para promociones o descuentos.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/inventario"
              className="text-xs font-medium text-amber-800 hover:text-amber-950 flex items-center gap-1 shrink-0 self-end sm:self-auto"
            >
              Ir a inventario
              <ExternalLink size={13} />
            </Link>
          </div>

          <div className="grid gap-2.5 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {data.productosEstancados.slice(0, 6).map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-amber-200 bg-white p-2.5 sm:p-3 shadow-sm hover:border-amber-300 transition"
              >
                {p.photo ? (
                  <Image
                    src={p.photo}
                    alt={p.name}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-md object-cover border shrink-0"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-50 text-amber-500 border border-amber-200 shrink-0">
                    <Package size={18} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/productos/${p.id}`}
                    className="truncate font-medium text-xs text-gray-900 hover:underline block"
                  >
                    {p.name}
                  </Link>
                  <p className="text-[10px] text-gray-500 capitalize">{p.type}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                    <span className="font-semibold text-amber-800">
                      Stock: {p.stockTotal}
                    </span>
                    <span className="text-gray-400 truncate">
                      (On: {p.stockOnline} | Tienda: {p.stockStore})
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
