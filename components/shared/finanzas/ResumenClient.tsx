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
} from "lucide-react";
import Link from "next/link";

type Resumen = {
  ventas: number;
  gastos: number;
  cobrar: number;
  pagar: number;
};

type Preset = "mes" | "semana" | "custom";

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
  const day = now.getDay(); // 0 = domingo
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { desde: localDateStr(monday), hasta: localDateStr(sunday) };
}

const MONTH = getMonthRange();

export function ResumenClient() {
  // Input state — lo que el usuario ve en los campos
  const [desde, setDesde] = useState(MONTH.desde);
  const [hasta, setHasta] = useState(MONTH.hasta);

  // Applied state — lo que realmente se consulta
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

  // Aplica los valores de los inputs al filtro
  function applyCustom() {
    setAppliedDesde(desde);
    setAppliedHasta(hasta);
    setActivePreset("custom");
  }

  // Shortcuts — actualiza inputs Y el filtro aplicado de inmediato
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
          desc: "Órdenes completadas",
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
          desc: "Pendientes de cobro",
        },
        {
          label: "Cuentas por pagar",
          value: data.pagar,
          icon: AlertCircle,
          color: "text-orange-600",
          bg: "bg-orange-50",
          desc: "Deudas a proveedores",
        },
      ]
    : [];

  const LINKS = [
    { href: "/dashboard/finanzas/nominas",      label: "Nóminas",             icon: DollarSign, desc: "Comisiones y pagos por vendedora" },
    { href: "/dashboard/finanzas/gastos",        label: "Gastos",              icon: Receipt,    desc: "Registro de gastos operativos" },
    { href: "/dashboard/finanzas/cuentas-cobrar",label: "Cuentas por cobrar",  icon: BarChart3,  desc: "Abonos y deudas de clientes" },
    { href: "/dashboard/finanzas/cuentas-pagar", label: "Cuentas por pagar",   icon: FileText,   desc: "Deudas a proveedores" },
  ];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        {/* Shortcuts */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={activePreset === "mes" ? "default" : "outline"}
            onClick={() => applyPreset("mes")}
          >
            Este mes
          </Button>
          <Button
            size="sm"
            variant={activePreset === "semana" ? "default" : "outline"}
            onClick={() => applyPreset("semana")}
          >
            Esta semana
          </Button>
        </div>

        {/* Separador visual */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Desde</Label>
            <Input
              type="date"
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value);
                setActivePreset("custom");
              }}
              className="w-40 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Hasta</Label>
            <Input
              type="date"
              value={hasta}
              onChange={(e) => {
                setHasta(e.target.value);
                setActivePreset("custom");
              }}
              className="w-40 text-sm"
            />
          </div>
          <Button
            size="sm"
            onClick={applyCustom}
            disabled={loading || (!desde && !hasta)}
            variant={activePreset === "custom" ? "default" : "outline"}
          >
            {loading ? "Cargando..." : "Aplicar filtro"}
          </Button>
        </div>

        {/* Período activo */}
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
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

      {/* Accesos rápidos */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Accesos rápidos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
