"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, TrendingDown, AlertTriangle, Info,
  ArrowUpRight, ArrowDownRight, Minus,
  ShoppingBag, Receipt, Star, DollarSign,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { rangoDia, rangoSemana, rangoQuincena } from "@/lib/payroll-periods";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InsightType = "positive" | "negative" | "warning" | "info";

type IngresosRow = {
  id: string;
  order_number: string;
  date: string;
  customer: string;
  channel: string;
  seller: string;
  total_usd: number;
};

type EgresosRow = {
  id: string;
  date: string;
  description: string;
  category: string;
  categoryLabel: string;
  amount_usd: number;
  creator: string;
  notas: string | null;
};

export type HistorialData = {
  desde: string;
  hasta: string;
  periodDays: number;
  totalIngresos: number;
  totalEgresos: number;
  margen: number;
  margenPct: number;
  ticketPromedio: number;
  countOrdenes: number;
  prevTotalIngresos: number;
  prevTotalEgresos: number;
  prevCountOrdenes: number;
  ingresosChangePct: number | null;
  egresosChangePct: number | null;
  ingresosOnline: number;
  ingresosTienda: number;
  countOnline: number;
  countTienda: number;
  topVendedora: { nombre: string; total: number } | null;
  categoryBreakdown: { category: string; label: string; total: number; percentage: number; count: number }[];
  diasActivos: { dia: string; dayNum: number; count: number; total: number }[];
  insights: { type: InsightType; text: string }[];
  ingresos: IngresosRow[];
  egresos: EgresosRow[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INSIGHT_STYLE: Record<InsightType, { bg: string; border: string; text: string; icon: React.ElementType }> = {
  positive: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", icon: TrendingUp },
  negative: { bg: "bg-red-50",     border: "border-red-200",     text: "text-red-800",     icon: TrendingDown },
  warning:  { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-800",   icon: AlertTriangle },
  info:     { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-800",    icon: Info },
};

const today = new Date().toISOString().slice(0, 10);

const CAT_COLORS: Record<string, string> = {
  operativo: "bg-blue-500",
  logistica: "bg-violet-500",
  nomina:    "bg-amber-500",
  otro:      "bg-gray-400",
};

function ChangePill({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-gray-400">sin comparación</span>;
  const positive = pct >= 0;
  const Icon = pct === 0 ? Minus : positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? "text-emerald-700" : "text-red-700"}`}>
      <Icon size={12} />
      {Math.abs(pct).toFixed(0)}% vs anterior
    </span>
  );
}

type Tab = "resumen" | "ingresos" | "egresos";

// ─── Main Component ───────────────────────────────────────────────────────────

export function HistorialClient({ data }: { data: HistorialData }) {
  const router = useRouter();
  const [, start] = useTransition();

  const [tab, setTab] = useState<Tab>("resumen");
  const [desde, setDesde] = useState(data.desde);
  const [hasta, setHasta] = useState(data.hasta);

  function nav(f: string, l: string) {
    start(() => router.push(`?tab=historial&desde=${f}&hasta=${l}`));
  }

  function applyFilter() { nav(desde, hasta); }

  function setToday() {
    const r = rangoDia(new Date());
    setDesde(r.desde); setHasta(r.hasta);
    nav(r.desde, r.hasta);
  }

  function setThisWeek() {
    const r = rangoSemana(new Date());
    setDesde(r.desde); setHasta(r.hasta);
    nav(r.desde, r.hasta);
  }

  function setQuincena() {
    const r = rangoQuincena(new Date());
    setDesde(r.desde); setHasta(r.hasta);
    nav(r.desde, r.hasta);
  }

  function setCurrentMonth() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const first = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const last  = new Date(y, m + 1, 0);
    const lastStr = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
    setDesde(first); setHasta(lastStr);
    nav(first, lastStr);
  }

  function setLastMonth() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m - 1, 1);
    const last  = new Date(y, m, 0);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const f = fmt(first), l = fmt(last);
    setDesde(f); setHasta(l);
    nav(f, l);
  }

  function setCurrentYear() {
    const y = new Date().getFullYear();
    const f = `${y}-01-01`, l = `${y}-12-31`;
    setDesde(f); setHasta(l);
    nav(f, l);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "resumen",  label: "Resumen" },
    { id: "ingresos", label: `Ingresos (${data.countOrdenes})` },
    { id: "egresos",  label: `Egresos (${data.egresos.length})` },
  ];

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="rounded-xl border bg-white px-5 py-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-gray-500">Desde</Label>
            <Input
              type="date"
              value={desde}
              max={today}
              onChange={(e) => setDesde(e.target.value)}
              className="w-36 max-w-full text-sm appearance-none"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-gray-500">Hasta</Label>
            <Input
              type="date"
              value={hasta}
              max={today}
              onChange={(e) => setHasta(e.target.value)}
              className="w-36 max-w-full text-sm appearance-none"
            />
          </div>
          <Button variant="outline" onClick={applyFilter} className="rounded-full px-4">
            Aplicar
          </Button>
          <Separator orientation="vertical" className="h-9" />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={setToday}>Hoy</Button>
            <Button variant="outline" onClick={setThisWeek}>Esta semana</Button>
            <Button variant="outline" onClick={setQuincena}>Esta quincena</Button>
            <Button variant="outline" onClick={setCurrentMonth}>Este mes</Button>
            <Button variant="outline" onClick={setLastMonth}>Mes anterior</Button>
            <Button variant="outline" onClick={setCurrentYear}>Este año</Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Período: {data.desde} → {data.hasta} ({data.periodDays} día{data.periodDays !== 1 ? "s" : ""})
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Ingresos"
          value={`$${data.totalIngresos.toFixed(2)}`}
          icon={<DollarSign size={16} className="text-emerald-600" />}
          sub={<ChangePill pct={data.ingresosChangePct} />}
          accent="emerald"
        />
        <StatCard
          label="Egresos"
          value={`$${data.totalEgresos.toFixed(2)}`}
          icon={<Receipt size={16} className="text-red-500" />}
          sub={<ChangePill pct={data.egresosChangePct} />}
          accent="red"
        />
        <StatCard
          label="Margen bruto"
          value={`$${data.margen.toFixed(2)}`}
          icon={
            data.margen >= 0
              ? <TrendingUp size={16} className="text-blue-600" />
              : <TrendingDown size={16} className="text-red-600" />
          }
          sub={
            <span className={`text-xs font-medium ${data.margenPct >= 30 ? "text-emerald-700" : data.margenPct >= 0 ? "text-amber-700" : "text-red-700"}`}>
              {data.margenPct.toFixed(0)}% del ingreso
            </span>
          }
          accent={data.margen >= 0 ? "blue" : "red"}
        />
        <StatCard
          label="Ticket promedio"
          value={`$${data.ticketPromedio.toFixed(2)}`}
          icon={<ShoppingBag size={16} className="text-violet-600" />}
          sub={<span className="text-xs text-gray-400">{data.countOrdenes} órdenes completadas</span>}
          accent="violet"
        />
      </div>

      {/* Tabs */}
      <div className="rounded-xl border bg-white">
        <div className="flex border-b">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-b-2 border-gray-900 text-gray-900"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "resumen" && <ResumenTab data={data} />}
          {tab === "ingresos" && <IngresosTab rows={data.ingresos} />}
          {tab === "egresos" && <EgresosTab rows={data.egresos} breakdown={data.categoryBreakdown} />}
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, sub, accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub: React.ReactNode;
  accent: "emerald" | "red" | "blue" | "violet";
}) {
  const bg = {
    emerald: "bg-emerald-50",
    red:     "bg-red-50",
    blue:    "bg-blue-50",
    violet:  "bg-violet-50",
  }[accent];

  return (
    <div className="rounded-xl border bg-white p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{label}</p>
        <div className={`rounded-lg p-1.5 ${bg}`}>{icon}</div>
      </div>
      <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
      <div>{sub}</div>
    </div>
  );
}

// ─── Resumen Tab ──────────────────────────────────────────────────────────────

function ResumenTab({ data }: { data: HistorialData }) {
  return (
    <div className="space-y-6">
      {/* Insights */}
      {data.insights.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Análisis automático</h3>
          <div className="grid grid-cols-2 gap-2">
            {data.insights.map((ins, i) => {
              const style = INSIGHT_STYLE[ins.type];
              const Icon = style.icon;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${style.bg} ${style.border}`}
                >
                  <Icon size={15} className={`mt-0.5 shrink-0 ${style.text}`} />
                  <p className={`text-sm ${style.text}`}>{ins.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Separator />

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Canal breakdown */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Ingresos por canal</h3>
          {data.totalIngresos === 0 ? (
            <p className="text-sm text-gray-400">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {[
                { label: "Online",  value: data.ingresosOnline, count: data.countOnline,  color: "bg-blue-500" },
                { label: "Tienda",  value: data.ingresosTienda, count: data.countTienda,  color: "bg-violet-500" },
              ].map((c) => {
                const pctVal = data.totalIngresos > 0 ? (c.value / data.totalIngresos) * 100 : 0;
                return (
                  <div key={c.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-gray-600">{c.label} <span className="text-gray-400">({c.count} órd.)</span></span>
                      <span className="font-medium text-gray-800">${c.value.toFixed(2)} <span className="text-gray-400">({pctVal.toFixed(0)}%)</span></span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-2 rounded-full ${c.color} transition-all`} style={{ width: `${pctVal}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category breakdown */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Egresos por categoría</h3>
          {data.categoryBreakdown.length === 0 ? (
            <p className="text-sm text-gray-400">Sin gastos registrados</p>
          ) : (
            <div className="space-y-3">
              {data.categoryBreakdown.map((cat) => (
                <div key={cat.category}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-gray-600">{cat.label} <span className="text-gray-400">({cat.count})</span></span>
                    <span className="font-medium text-gray-800">${cat.total.toFixed(2)} <span className="text-gray-400">({cat.percentage.toFixed(0)}%)</span></span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full transition-all ${CAT_COLORS[cat.category] ?? "bg-gray-400"}`}
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Top vendedora */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Mejor vendedora del período</h3>
          {data.topVendedora ? (
            <div className="flex items-center gap-3 rounded-lg border bg-amber-50 border-amber-200 px-4 py-3">
              <Star size={16} className="text-amber-500" />
              <div>
                <p className="text-sm font-semibold text-gray-800">{data.topVendedora.nombre}</p>
                <p className="text-xs text-gray-500">${data.topVendedora.total.toFixed(2)} en ventas completadas</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin datos</p>
          )}
        </div>

        {/* Días más activos */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Días más activos</h3>
          {data.diasActivos.length === 0 ? (
            <p className="text-sm text-gray-400">Sin órdenes en el período</p>
          ) : (
            <div className="space-y-1">
              {data.diasActivos.slice(0, 4).map((d) => (
                <div key={d.dayNum} className="flex justify-between text-sm">
                  <span className="text-gray-600">{d.dia}</span>
                  <span className="text-gray-800">
                    <span className="font-medium">{d.count}</span>
                    <span className="ml-1 text-xs text-gray-400">ó.</span>
                    <span className="ml-2 text-xs text-gray-500">${d.total.toFixed(0)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Comparación vs período anterior */}
      <Separator />
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Comparación vs período anterior</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg border bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Ingresos ant.</p>
            <p className="font-semibold text-gray-800">${data.prevTotalIngresos.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Egresos ant.</p>
            <p className="font-semibold text-gray-800">${data.prevTotalEgresos.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Órdenes ant.</p>
            <p className="font-semibold text-gray-800">{data.prevCountOrdenes}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Ingresos Tab ─────────────────────────────────────────────────────────────

function IngresosTab({ rows }: { rows: IngresosRow[] }) {
  const total = rows.reduce((s, r) => s + r.total_usd, 0);

  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No hay ingresos en el período.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{rows.length} órdenes completadas</p>
        <p className="text-sm font-semibold text-gray-800">Total: ${total.toFixed(2)}</p>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 text-xs">
              <TableHead>Orden</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Vendedora</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="text-sm">
                <TableCell className="font-mono text-xs text-blue-600">{r.order_number}</TableCell>
                <TableCell className="text-gray-500">{r.date}</TableCell>
                <TableCell>{r.customer}</TableCell>
                <TableCell>
                  <Badge className={`text-xs border-0 ${r.channel === "online" ? "bg-blue-100 text-blue-800" : "bg-violet-100 text-violet-800"}`}>
                    {r.channel === "online" ? "Online" : "Tienda"}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-600">{r.seller}</TableCell>
                <TableCell className="text-right font-semibold text-emerald-700">${r.total_usd.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Egresos Tab ──────────────────────────────────────────────────────────────

function EgresosTab({
  rows,
  breakdown,
}: {
  rows: EgresosRow[];
  breakdown: { category: string; label: string; total: number; percentage: number; count: number }[];
}) {
  const total = rows.reduce((s, r) => s + r.amount_usd, 0);

  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No hay gastos en el período.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{rows.length} registros de gasto</p>
        <p className="text-sm font-semibold text-gray-800">Total: ${total.toFixed(2)}</p>
      </div>

      {/* Mini breakdown bar */}
      {breakdown.length > 1 && (
        <div className="flex rounded-full overflow-hidden h-2">
          {breakdown.map((cat) => (
            <div
              key={cat.category}
              className={`${CAT_COLORS[cat.category] ?? "bg-gray-400"} transition-all`}
              style={{ width: `${cat.percentage}%` }}
              title={`${cat.label}: ${cat.percentage.toFixed(0)}%`}
            />
          ))}
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 text-xs">
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Registrado por</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="text-sm">
                <TableCell className="text-gray-500 text-xs">{r.date}</TableCell>
                <TableCell className="max-w-[200px] truncate">{r.description}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1.5 text-xs`}>
                    <span className={`inline-block h-2 w-2 rounded-full ${CAT_COLORS[r.category] ?? "bg-gray-400"}`} />
                    {r.categoryLabel}
                  </span>
                </TableCell>
                <TableCell className="text-gray-600 text-xs">{r.creator}</TableCell>
                <TableCell className="text-gray-400 text-xs max-w-[140px] truncate">{r.notas ?? "—"}</TableCell>
                <TableCell className="text-right font-semibold text-red-700">${r.amount_usd.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
