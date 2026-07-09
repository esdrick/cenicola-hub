"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  BarChart3,
  Receipt,
  DollarSign,
  FileText,
  AlertTriangle,
  Hourglass,
} from "lucide-react";
import Link from "next/link";

type IngresoMetodo = {
  metodo: string;
  total: number;
  count: number;
};

type Resumen = {
  ventas: number;
  ordenes_completadas: number;
  gastos: number;
  cobrar: number;
  pagar: number;
  pagos_pendientes: number;
  monto_por_confirmar: number;
  pagos_por_confirmar_count: number;
  ingresos_por_metodo: IngresoMetodo[];
};

type Preset = "mes" | "semana" | "custom";

const METODO_LABELS: Record<string, string> = {
  efectivo_bs:   "Efectivo Bs",
  efectivo_usd:  "Efectivo USD",
  transferencia: "Transferencia",
  zelle:         "Zelle",
  pago_movil:    "Pago Móvil",
  usdt:          "USDT",
};

const METODO_COLORS: Record<string, string> = {
  efectivo_bs:   "bg-emerald-100 text-emerald-800",
  efectivo_usd:  "bg-teal-100 text-teal-800",
  transferencia: "bg-blue-100 text-blue-800",
  zelle:         "bg-violet-100 text-violet-800",
  pago_movil:    "bg-orange-100 text-orange-800",
  usdt:          "bg-yellow-100 text-yellow-800",
};

function localDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { desde: localDateStr(first), hasta: localDateStr(last) };
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { desde: localDateStr(monday), hasta: localDateStr(sunday) };
}

const MONTH = getMonthRange();
const today = new Date().toISOString().slice(0, 10);

export function ResumenClient() {
  const [desde, setDesde] = useState(MONTH.desde);
  const [hasta, setHasta] = useState(MONTH.hasta);
  const [appliedDesde, setAppliedDesde] = useState(MONTH.desde);
  const [appliedHasta, setAppliedHasta] = useState(MONTH.hasta);
  const [activePreset, setActivePreset] = useState<Preset>("mes");

  const [data, setData] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResumen = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (appliedDesde) params.set("desde", appliedDesde);
      if (appliedHasta) params.set("hasta", appliedHasta);
      const res = await fetch(`/api/finanzas/resumen?${params}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError("No se pudo cargar el resumen financiero");
    } finally {
      setLoading(false);
    }
  }, [appliedDesde, appliedHasta]);

  useEffect(() => {
    fetchResumen();
  }, [fetchResumen]);

  function applyCustom() {
    setAppliedDesde(desde);
    setAppliedHasta(hasta);
    setActivePreset("custom");
  }

  function applyPreset(preset: Preset) {
    const range = preset === "semana" ? getWeekRange() : getMonthRange();
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

  const CARDS = data
    ? [
        {
          label: "Total vendido",
          value: data.ventas,
          icon: TrendingUp,
          color: "text-emerald-600",
          bg: "bg-emerald-50",
          desc: `${data.ordenes_completadas} órdenes completadas`,
        },
        {
          label: "Total gastos",
          value: data.gastos,
          icon: TrendingDown,
          color: "text-red-600",
          bg: "bg-red-50",
          desc: "Gastos registrados",
        },
        {
          label: "Cuentas por cobrar",
          value: data.cobrar,
          icon: Clock,
          color: "text-amber-600",
          bg: "bg-amber-50",
          desc: "Saldo pendiente de cobro",
        },
        {
          label: "Cuentas por pagar",
          value: data.pagar,
          icon: AlertCircle,
          color: "text-orange-600",
          bg: "bg-orange-50",
          desc: "Deudas a proveedores",
        },
        {
          label: "Por confirmar",
          value: data.monto_por_confirmar,
          icon: Hourglass,
          color: "text-violet-600",
          bg: "bg-violet-50",
          desc: `${data.pagos_por_confirmar_count} pago${data.pagos_por_confirmar_count !== 1 ? "s" : ""} pendiente${data.pagos_por_confirmar_count !== 1 ? "s" : ""} de verificación`,
        },
      ]
    : [];

  const LINKS = [
    { href: "/dashboard/finanzas/nominas",       label: "Nóminas",            icon: DollarSign, desc: "Comisiones y pagos por vendedora" },
    { href: "/dashboard/finanzas/gastos",         label: "Gastos",             icon: Receipt,    desc: "Registro de gastos operativos" },
    { href: "/dashboard/finanzas/cuentas-cobrar", label: "Cuentas por cobrar", icon: BarChart3,   desc: "Abonos y deudas de clientes" },
    { href: "/dashboard/finanzas/cuentas-pagar",  label: "Cuentas por pagar",  icon: FileText,   desc: "Deudas a proveedores" },
  ];

  const totalIngresosMetodo = data?.ingresos_por_metodo.reduce((s, m) => s + m.total, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activePreset === "mes" ? "default" : "outline"}
            onClick={() => applyPreset("mes")}
          >
            Este mes
          </Button>
          <Button
            variant={activePreset === "semana" ? "default" : "outline"}
            onClick={() => applyPreset("semana")}
          >
            Esta semana
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-gray-500">Desde</Label>
            <Input
              type="date"
              value={desde}
              max={today}
              onChange={(e) => { setDesde(e.target.value); setActivePreset("custom"); }}
              className="w-40 max-w-full text-sm appearance-none"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-gray-500">Hasta</Label>
            <Input
              type="date"
              value={hasta}
              max={today}
              onChange={(e) => { setHasta(e.target.value); setActivePreset("custom"); }}
              className="w-40 max-w-full text-sm appearance-none"
            />
          </div>
          <Button
            onClick={applyCustom}
            disabled={loading || (!desde && !hasta)}
            variant={activePreset === "custom" ? "default" : "outline"}
            className="rounded-full px-4"
          >
            {loading ? "Cargando..." : "Aplicar filtro"}
          </Button>
        </div>

        <p className="text-xs text-gray-400">
          Mostrando: <span className="font-medium text-gray-600">{periodLabel}</span>
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5">
                  <div className="h-4 w-24 rounded bg-gray-100" />
                  <div className="mt-3 h-8 w-32 rounded bg-gray-100" />
                </CardContent>
              </Card>
            ))
          : CARDS.map((c) => (
              <Card key={c.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {c.label}
                  </CardTitle>
                  <div className={`rounded-lg p-2 ${c.bg}`}>
                    <c.icon size={16} className={c.color} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-gray-900">
                    ${c.value.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{c.desc}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Ingresos por método de pago */}
      {!loading && data && (
        <div className="rounded-xl border bg-white">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div>
              <h2 className="font-semibold text-gray-900">Ingresos por método de pago</h2>
              <p className="text-xs text-gray-500">Pagos verificados en el período seleccionado</p>
            </div>
            <span className="text-sm font-semibold text-emerald-700">
              Total: ${totalIngresosMetodo.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {data.ingresos_por_metodo.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              No hay pagos verificados en este período
            </div>
          ) : (
            <div className="divide-y">
              {data.ingresos_por_metodo
                .sort((a, b) => b.total - a.total)
                .map((m) => {
                  const pct = totalIngresosMetodo > 0 ? (m.total / totalIngresosMetodo) * 100 : 0;
                  return (
                    <div key={m.metodo} className="flex items-center gap-4 px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${METODO_COLORS[m.metodo] ?? "bg-gray-100 text-gray-700"}`}>
                        {METODO_LABELS[m.metodo] ?? m.metodo}
                      </span>
                      <div className="flex-1">
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${pct.toFixed(1)}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-12 text-right text-xs text-gray-500">
                        {pct.toFixed(0)}%
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          ${m.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-400">
                          {m.count} pago{m.count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Alerta pagos pendientes de verificación */}
      {!loading && data && data.pagos_pendientes > 0 && (
        <Link
          href="/dashboard/pagos"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 transition hover:border-amber-300 hover:bg-amber-100"
        >
          <div className="rounded-lg bg-amber-100 p-2">
            <AlertTriangle size={16} className="text-amber-700" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              {data.pagos_pendientes} orden{data.pagos_pendientes !== 1 ? "es" : ""} pendiente{data.pagos_pendientes !== 1 ? "s" : ""} de verificación de pago
            </p>
            <p className="text-xs text-amber-700">Ver en pantalla de pagos →</p>
          </div>
        </Link>
      )}

      {/* Accesos rápidos */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Accesos rápidos</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-start gap-3 rounded-xl border bg-white p-4 transition hover:border-gray-300 hover:shadow-sm"
            >
              <div className="mt-0.5 rounded-lg bg-gray-100 p-2">
                <l.icon size={16} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{l.label}</p>
                <p className="mt-0.5 text-xs text-gray-500">{l.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
