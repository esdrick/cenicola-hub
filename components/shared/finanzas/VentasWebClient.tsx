"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  shortOrderNumber,
  formatDocenas,
  STATUS_LABELS,
  STATUS_CLASSES,
} from "@/lib/order-utils";
import {
  formatRangoLabel,
  rangoPorTipo,
} from "@/lib/payroll-periods";
import { getVenezuelaDateString } from "@/lib/date-utils";
import { getOptimizedCloudinaryUrl } from "@/lib/cloudinary";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Globe,
  Package,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Truck,
  Store,
  CreditCard,
  Calendar,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  X,
  ExternalLink,
} from "lucide-react";

export type WebPeriodPreset = "dia" | "semana" | "quincena" | "mes" | "personalizado";

export type WebOrderItemRecord = {
  id: string;
  product_id: string;
  product_name: string;
  product_type: string;
  product_color: string | null;
  photo: string | null;
  size: string;
  sku: string;
  quantity: number;
  unit_price_usd: number;
  subtotal_usd: number;
};

export type WebOrderPaymentRecord = {
  id: string;
  payment_type: string;
  payment_label: string;
  amount_usd: number;
  status: string;
  reference: string;
};

export type WebOrderRecord = {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  dateStr: string;
  dayOfWeek: number;
  customer_name: string;
  customer_lastname: string;
  customer_id_doc: string;
  customer_key: string;
  address: string | null;
  shipping_company: string | null;
  isPickup: boolean;
  total_usd: number;
  productos_count: number;
  items: WebOrderItemRecord[];
  payments: WebOrderPaymentRecord[];
};

export type WebPrevStats = {
  ordenes_count: number;
  productos_vendidos: number;
  total_ventas: number;
  completadas_count: number;
  completadas_productos: number;
  completadas_ventas: number;
};

export type WebCompanyStats = {
  total_ventas_confirmadas: number;
  total_ordenes_confirmadas: number;
  total_productos_confirmados: number;
  total_ventas_completadas: number;
  total_ordenes_completadas: number;
  total_productos_completados: number;
};

type Props = {
  ordenes: WebOrderRecord[];
  prevStats: WebPrevStats;
  companyStats: WebCompanyStats;
  tipo: WebPeriodPreset;
  desde: string;
  hasta: string;
};

type ScopeMode = "confirmadas" | "completadas" | "en_proceso" | "todas";
type ModalidadFilter = "all" | "envio" | "retiro";
type DetailTab = "clientes" | "productos" | "dias";
type InsightType = "positive" | "negative" | "warning" | "info";

type ClienteWebSummary = {
  key: string;
  nombre: string;
  documento: string;
  ordenes_count: number;
  productos_vendidos: number;
  total_ventas: number;
  ticket_promedio: number;
  pickup_count: number;
  envio_count: number;
  ultima_compra: string;
  ordenes: WebOrderRecord[];
};

type ProductoWebSummary = {
  id: string;
  name: string;
  type: string;
  color: string | null;
  photo: string | null;
  ordenes_count: number;
  totalUnits: number;
  totalUsd: number;
  sizes: Record<string, number>;
};

const PRESETS: { tipo: "dia" | "semana" | "quincena" | "mes"; label: string }[] = [
  { tipo: "dia", label: "Hoy" },
  { tipo: "semana", label: "Semana" },
  { tipo: "quincena", label: "15 días" },
  { tipo: "mes", label: "Mes" },
];

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const METODO_COLORS: Record<string, string> = {
  efectivo_bs: "bg-emerald-100 text-emerald-800",
  efectivo_usd: "bg-teal-100 text-teal-800",
  transferencia: "bg-blue-100 text-blue-800",
  zelle: "bg-violet-100 text-violet-800",
  pago_movil: "bg-orange-100 text-orange-800",
  usdt: "bg-yellow-100 text-yellow-800",
};

const INSIGHT_STYLE: Record<
  InsightType,
  { bg: string; border: string; text: string; icon: React.ElementType }
> = {
  positive: {
    bg: "bg-emerald-50/80",
    border: "border-emerald-200",
    text: "text-emerald-900",
    icon: TrendingUp,
  },
  negative: {
    bg: "bg-red-50/80",
    border: "border-red-200",
    text: "text-red-900",
    icon: TrendingDown,
  },
  warning: {
    bg: "bg-amber-50/80",
    border: "border-amber-200",
    text: "text-amber-900",
    icon: AlertTriangle,
  },
  info: {
    bg: "bg-purple-50/80",
    border: "border-purple-200",
    text: "text-purple-900",
    icon: Info,
  },
};

function fmtUSD(n: number) {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function calcChangePct(current: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((current - prev) / prev) * 100;
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-[11px] text-gray-400">Sin base anterior</span>;
  }
  const isPos = pct > 0;
  const isZero = Math.abs(pct) < 0.5;
  const Icon = isZero ? Minus : isPos ? ArrowUpRight : ArrowDownRight;
  const colorClass = isZero
    ? "text-gray-500 bg-gray-100"
    : isPos
    ? "text-emerald-700 bg-emerald-50"
    : "text-red-700 bg-red-50";

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${colorClass}`}
    >
      <Icon size={11} />
      {isPos ? "+" : ""}
      {pct.toFixed(0)}% vs ant.
    </span>
  );
}

export function VentasWebClient({
  ordenes,
  prevStats,
  companyStats,
  tipo,
  desde,
  hasta,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const todayStr = getVenezuelaDateString();

  // Period filter state
  const [selectedTipo, setSelectedTipo] = useState<WebPeriodPreset>(tipo);
  const [selectedDesde, setSelectedDesde] = useState(desde > todayStr ? todayStr : desde);
  const [selectedHasta, setSelectedHasta] = useState(hasta > todayStr ? todayStr : hasta);

  // Interactive analysis filters
  const [scope, setScope] = useState<ScopeMode>("confirmadas");
  const [modalidadFilter, setModalidadFilter] = useState<ModalidadFilter>("all");
  const [metodoFilter, setMetodoFilter] = useState<string>("all");
  const [diaFilter, setDiaFilter] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("clientes");

  // Modals
  const [selectedCliente, setSelectedCliente] = useState<ClienteWebSummary | null>(null);
  const [selectedOrden, setSelectedOrden] = useState<WebOrderRecord | null>(null);

  function aplicarPreset(t: "dia" | "semana" | "quincena" | "mes") {
    const r = rangoPorTipo(t, new Date());
    const cappedDesde = r.desde > todayStr ? todayStr : r.desde;
    const cappedHasta = r.hasta > todayStr ? todayStr : r.hasta;
    setSelectedTipo(t);
    setSelectedDesde(cappedDesde);
    setSelectedHasta(cappedHasta);
    startTransition(() => {
      router.push(
        `/dashboard/finanzas/web?tipo=${t}&desde=${cappedDesde}&hasta=${cappedHasta}`
      );
    });
  }

  function onFechaChange(campo: "desde" | "hasta", valor: string) {
    const cappedValue = valor > todayStr ? todayStr : valor;
    setSelectedTipo("personalizado");
    if (campo === "desde") setSelectedDesde(cappedValue);
    else setSelectedHasta(cappedValue);
  }

  function applyFilter() {
    startTransition(() => {
      router.push(
        `/dashboard/finanzas/web?tipo=${selectedTipo}&desde=${selectedDesde}&hasta=${selectedHasta}`
      );
    });
  }

  function resetInteractiveFilters() {
    setModalidadFilter("all");
    setMetodoFilter("all");
    setDiaFilter(null);
  }

  // Counts by status across all web orders in period
  const statusSummary = useMemo(() => {
    let confirmadas = 0;
    let completadas = 0;
    let enviadas = 0;
    let enProceso = 0;
    let canceladas = 0;

    for (const o of ordenes) {
      if (o.status === "completada") {
        completadas++;
        confirmadas++;
      } else if (o.status === "enviada") {
        enviadas++;
        confirmadas++;
      } else if (o.status === "cancelada") {
        canceladas++;
      } else {
        enProceso++;
      }
    }
    return { confirmadas, completadas, enviadas, enProceso, canceladas };
  }, [ordenes]);

  // Step 1: Orders filtered by status scope
  const scopedOrders = useMemo(() => {
    return ordenes.filter((o) => {
      if (scope === "confirmadas") {
        return o.status === "enviada" || o.status === "completada";
      }
      if (scope === "completadas") {
        return o.status === "completada";
      }
      if (scope === "en_proceso") {
        return (
          o.status !== "enviada" &&
          o.status !== "completada" &&
          o.status !== "cancelada"
        );
      }
      return o.status !== "cancelada";
    });
  }, [ordenes, scope]);

  // Step 2: Orders filtered by interactive controls (modalidad, método de pago, día)
  const filteredOrders = useMemo(() => {
    return scopedOrders.filter((o) => {
      if (modalidadFilter === "envio" && o.isPickup) return false;
      if (modalidadFilter === "retiro" && !o.isPickup) return false;
      if (metodoFilter !== "all") {
        const hasMethod = o.payments.some((p) => p.payment_type === metodoFilter);
        if (!hasMethod) return false;
      }
      if (diaFilter !== null && o.dayOfWeek !== diaFilter) return false;
      return true;
    });
  }, [scopedOrders, modalidadFilter, metodoFilter, diaFilter]);

  // Aggregate KPIs from filteredOrders
  const kpis = useMemo(() => {
    const ordenesCount = filteredOrders.length;
    let productosVendidos = 0;
    let totalVentas = 0;
    let pickupOrders = 0;
    let pickupUsd = 0;
    let envioOrders = 0;
    let envioUsd = 0;

    for (const o of filteredOrders) {
      productosVendidos += o.productos_count;
      totalVentas += o.total_usd;
      if (o.isPickup) {
        pickupOrders++;
        pickupUsd += o.total_usd;
      } else {
        envioOrders++;
        envioUsd += o.total_usd;
      }
    }

    const ticketPromedio = ordenesCount > 0 ? totalVentas / ordenesCount : 0;
    const piezasPorOrden = ordenesCount > 0 ? productosVendidos / ordenesCount : 0;

    // Baseline comparison against previous period (when no sub-filter is active)
    const prevBaseVentas =
      scope === "completadas" ? prevStats.completadas_ventas : prevStats.total_ventas;
    const prevBaseOrdenes =
      scope === "completadas" ? prevStats.completadas_count : prevStats.ordenes_count;
    const prevBaseProductos =
      scope === "completadas"
        ? prevStats.completadas_productos
        : prevStats.productos_vendidos;

    const companyBaseVentas =
      scope === "completadas"
        ? companyStats.total_ventas_completadas
        : companyStats.total_ventas_confirmadas;
    const companyBaseProductos =
      scope === "completadas"
        ? companyStats.total_productos_completados
        : companyStats.total_productos_confirmados;

    const shareVentasEmpresa =
      companyBaseVentas > 0 ? (totalVentas / companyBaseVentas) * 100 : 0;
    const shareProductosEmpresa =
      companyBaseProductos > 0 ? (productosVendidos / companyBaseProductos) * 100 : 0;

    return {
      ordenesCount,
      productosVendidos,
      totalVentas,
      ticketPromedio,
      piezasPorOrden,
      pickupOrders,
      pickupUsd,
      envioOrders,
      envioUsd,
      ventasChangePct: calcChangePct(totalVentas, prevBaseVentas),
      ordenesChangePct: calcChangePct(ordenesCount, prevBaseOrdenes),
      productosChangePct: calcChangePct(productosVendidos, prevBaseProductos),
      shareVentasEmpresa,
      shareProductosEmpresa,
    };
  }, [filteredOrders, scope, prevStats, companyStats]);

  // Group by Customer (like Vendedoras in Nóminas)
  const clientesList = useMemo<ClienteWebSummary[]>(() => {
    const map = new Map<string, ClienteWebSummary>();

    for (const o of filteredOrders) {
      const existing = map.get(o.customer_key);
      const fullName = `${o.customer_name} ${o.customer_lastname}`.trim() || "Cliente Web";
      if (!existing) {
        map.set(o.customer_key, {
          key: o.customer_key,
          nombre: fullName,
          documento: o.customer_id_doc || "S/D",
          ordenes_count: 1,
          productos_vendidos: o.productos_count,
          total_ventas: o.total_usd,
          ticket_promedio: o.total_usd,
          pickup_count: o.isPickup ? 1 : 0,
          envio_count: o.isPickup ? 0 : 1,
          ultima_compra: o.dateStr,
          ordenes: [o],
        });
      } else {
        existing.ordenes_count += 1;
        existing.productos_vendidos += o.productos_count;
        existing.total_ventas += o.total_usd;
        existing.ticket_promedio = existing.total_ventas / existing.ordenes_count;
        if (o.isPickup) existing.pickup_count += 1;
        else existing.envio_count += 1;
        if (o.dateStr > existing.ultima_compra) existing.ultima_compra = o.dateStr;
        existing.ordenes.push(o);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.total_ventas - a.total_ventas);
  }, [filteredOrders]);

  // Group by Product
  const productosList = useMemo<ProductoWebSummary[]>(() => {
    const map = new Map<string, ProductoWebSummary & { orderIds: Set<string> }>();

    for (const o of filteredOrders) {
      for (const item of o.items) {
        const existing = map.get(item.product_id);
        if (!existing) {
          map.set(item.product_id, {
            id: item.product_id,
            name: item.product_name,
            type: item.product_type,
            color: item.product_color,
            photo: item.photo,
            ordenes_count: 1,
            totalUnits: item.quantity,
            totalUsd: item.subtotal_usd,
            sizes: { [item.size]: item.quantity },
            orderIds: new Set([o.id]),
          });
        } else {
          existing.totalUnits += item.quantity;
          existing.totalUsd += item.subtotal_usd;
          existing.sizes[item.size] = (existing.sizes[item.size] ?? 0) + item.quantity;
          existing.orderIds.add(o.id);
          existing.ordenes_count = existing.orderIds.size;
        }
      }
    }

    return Array.from(map.values())
      .map(({ orderIds: _unused, ...rest }) => {
        void _unused;
        return rest;
      })
      .sort((a, b) => b.totalUnits - a.totalUnits || b.totalUsd - a.totalUsd);
  }, [filteredOrders]);

  // Group by Payment Method (from scopedOrders so filter pills stay visible)
  const metodosList = useMemo(() => {
    const map = new Map<
      string,
      { type: string; label: string; totalUsd: number; count: number }
    >();
    for (const o of scopedOrders) {
      for (const p of o.payments) {
        if (p.status === "rechazado") continue;
        const curr = map.get(p.payment_type) ?? {
          type: p.payment_type,
          label: p.payment_label,
          totalUsd: 0,
          count: 0,
        };
        curr.totalUsd += p.amount_usd;
        curr.count += 1;
        map.set(p.payment_type, curr);
      }
    }
    const list = Array.from(map.values()).sort((a, b) => b.totalUsd - a.totalUsd);
    const sum = list.reduce((s, m) => s + m.totalUsd, 0);
    return list.map((m) => ({
      ...m,
      pct: sum > 0 ? (m.totalUsd / sum) * 100 : 0,
    }));
  }, [scopedOrders]);

  // Group by Day of Week (from scopedOrders so user can click a day bar to filter)
  const diasSemanaList = useMemo(() => {
    const base = Array.from({ length: 7 }, (_, idx) => ({
      dayOfWeek: idx,
      label: DAY_NAMES[idx],
      short: DAY_SHORT[idx],
      ordenes: 0,
      productos: 0,
      totalUsd: 0,
    }));

    for (const o of scopedOrders) {
      const bucket = base[o.dayOfWeek];
      if (bucket) {
        bucket.ordenes += 1;
        bucket.productos += o.productos_count;
        bucket.totalUsd += o.total_usd;
      }
    }
    return base;
  }, [scopedOrders]);

  // Group by Calendar Date (for Tendencia Diaria tab)
  const fechasList = useMemo(() => {
    const map = new Map<
      string,
      { dateStr: string; dayOfWeek: number; ordenes: number; productos: number; totalUsd: number }
    >();
    for (const o of filteredOrders) {
      const curr = map.get(o.dateStr) ?? {
        dateStr: o.dateStr,
        dayOfWeek: o.dayOfWeek,
        ordenes: 0,
        productos: 0,
        totalUsd: 0,
      };
      curr.ordenes += 1;
      curr.productos += o.productos_count;
      curr.totalUsd += o.total_usd;
      map.set(o.dateStr, curr);
    }
    return Array.from(map.values()).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [filteredOrders]);

  // Interactive Insights generator
  const insights = useMemo(() => {
    const list: { type: InsightType; title: string; text: string }[] = [];

    if (filteredOrders.length === 0) {
      list.push({
        type: "info",
        title: "Sin ventas para los filtros actuales",
        text: "No se encontraron órdenes web en este rango o combinación de filtros. Prueba cambiando el período o limpiando los filtros.",
      });
      return list;
    }

    // 1. Revenue trend vs previous period
    if (kpis.ventasChangePct !== null && modalidadFilter === "all" && metodoFilter === "all" && diaFilter === null) {
      if (kpis.ventasChangePct >= 15) {
        list.push({
          type: "positive",
          title: `Crecimiento Web +${kpis.ventasChangePct.toFixed(0)}%`,
          text: `La facturación web subió a ${fmtUSD(kpis.totalVentas)} (${kpis.productosVendidos} pzas / ${formatDocenas(kpis.productosVendidos)}) frente al período anterior.`,
        });
      } else if (kpis.ventasChangePct <= -15) {
        list.push({
          type: "negative",
          title: `Variación Web ${kpis.ventasChangePct.toFixed(0)}%`,
          text: `La facturación web disminuyó respecto al período previo. Revisa los productos de mayor rotación o campañas activas.`,
        });
      } else {
        list.push({
          type: "info",
          title: "Ritmo de ventas estable",
          text: `Facturación web de ${fmtUSD(kpis.totalVentas)} (${kpis.ventasChangePct >= 0 ? "+" : ""}${kpis.ventasChangePct.toFixed(0)}% vs período anterior).`,
        });
      }
    }

    // 2. Share of company total sales
    if (kpis.shareVentasEmpresa > 0 && modalidadFilter === "all" && metodoFilter === "all") {
      list.push({
        type: kpis.shareVentasEmpresa >= 30 ? "positive" : "info",
        title: `${kpis.shareVentasEmpresa.toFixed(1)}% de la facturación del negocio`,
        text: `El canal Web aportó ${kpis.productosVendidos} unidades (${formatDocenas(kpis.productosVendidos)}), equivalentes al ${kpis.shareProductosEmpresa.toFixed(1)}% de todas las piezas vendidas en la empresa.`,
      });
    }

    // 3. Top Product insight
    if (productosList.length > 0) {
      const topProd = productosList[0];
      const topSizes = Object.entries(topProd.sizes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([sz, q]) => `${sz} (${q})`)
        .join(", ");
      list.push({
        type: "positive",
        title: `Producto estrella Web: ${topProd.name}`,
        text: `${topProd.totalUnits} unidades vendidas (${formatDocenas(topProd.totalUnits)}) por ${fmtUSD(topProd.totalUsd)}. Tallas más pedidas: ${topSizes}.`,
      });
    }

    // 4. Delivery preference (Envío vs Retiro en tienda)
    const totalModalidad = kpis.envioOrders + kpis.pickupOrders;
    if (totalModalidad > 0) {
      const envioPct = (kpis.envioOrders / totalModalidad) * 100;
      const pickupPct = (kpis.pickupOrders / totalModalidad) * 100;
      if (kpis.pickupOrders > 0 && kpis.envioOrders > 0) {
        const lidera = kpis.envioOrders >= kpis.pickupOrders ? "Envío nacional" : "Retiro en tienda";
        const lideraPct = Math.max(envioPct, pickupPct).toFixed(0);
        list.push({
          type: "info",
          title: `Modalidad líder: ${lidera} (${lideraPct}%)`,
          text: `${kpis.envioOrders} órdenes con envío (${fmtUSD(kpis.envioUsd)}) y ${kpis.pickupOrders} con retiro en tienda (${fmtUSD(kpis.pickupUsd)}).`,
        });
      } else if (kpis.pickupOrders > 0) {
        list.push({
          type: "info",
          title: "100% Retiro en tienda",
          text: `Todas las ${kpis.pickupOrders} órdenes seleccionadas fueron solicitadas para retiro por tienda.`,
        });
      } else {
        list.push({
          type: "info",
          title: "100% Envíos nacionales",
          text: `Las ${kpis.envioOrders} órdenes web del período fueron despachadas por agencia de envío.`,
        });
      }
    }

    // 5. Best day of the week
    const bestDay = [...diasSemanaList].sort((a, b) => b.totalUsd - a.totalUsd)[0];
    if (bestDay && bestDay.totalUsd > 0) {
      list.push({
        type: "info",
        title: `Día más fuerte: ${bestDay.label}`,
        text: `Los ${bestDay.label.toLowerCase()}s concentran ${bestDay.ordenes} órdenes, ${bestDay.productos} piezas (${formatDocenas(bestDay.productos)}) y ${fmtUSD(bestDay.totalUsd)} en ventas web.`,
      });
    }

    // 6. Pending / in-progress alert
    if (statusSummary.enProceso > 0 && scope !== "en_proceso") {
      list.push({
        type: "warning",
        title: `${statusSummary.enProceso} orden${statusSummary.enProceso !== 1 ? "es" : ""} web en proceso`,
        text: `Hay órdenes web pendientes de verificación, embalaje o retiro en este período. Cambia el botón a "En proceso" para revisarlas.`,
      });
    }

    return list.slice(0, 6);
  }, [
    filteredOrders.length,
    kpis,
    modalidadFilter,
    metodoFilter,
    diaFilter,
    productosList,
    diasSemanaList,
    statusSummary.enProceso,
    scope,
  ]);

  const hasActiveSubFilters =
    modalidadFilter !== "all" ||
    metodoFilter !== "all" ||
    diaFilter !== null;

  const maxDayUsd = Math.max(1, ...diasSemanaList.map((d) => d.totalUsd));
  const maxProdUnits = Math.max(1, productosList[0]?.totalUnits ?? 1);
  const maxFechaUsd = Math.max(1, ...fechasList.map((f) => f.totalUsd));

  return (
    <div className="space-y-5">
      {/* Barra superior de período y filtros */}
      <div className="flex flex-col gap-4 rounded-xl border bg-white p-3.5 sm:p-4">
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            {/* Presets de período: 4 columnas iguales en móvil */}
            <div className="w-full sm:w-auto space-y-1">
              <Label className="text-xs text-gray-500">Período</Label>
              <div className="grid grid-cols-4 gap-1.5 sm:flex">
                {PRESETS.map((p) => (
                  <Button
                    key={p.tipo}
                    type="button"
                    size="sm"
                    variant={selectedTipo === p.tipo ? "default" : "outline"}
                    className="h-9 w-full sm:w-auto rounded-lg sm:rounded-full px-2 sm:px-3.5 text-xs whitespace-nowrap"
                    disabled={isPending}
                    onClick={() => aplicarPreset(p.tipo)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Fechas Desde / Hasta: 2 columnas iguales en móvil */}
            <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto sm:flex sm:items-end">
              <div className="min-w-0 space-y-1">
                <Label className="text-xs text-gray-500">Desde</Label>
                <input
                  type="date"
                  value={selectedDesde}
                  max={todayStr}
                  onChange={(e) => onFechaChange("desde", e.target.value)}
                  className="h-9 w-full max-w-full appearance-none rounded-md border border-input bg-white px-2.5 sm:px-3 text-xs sm:text-sm"
                />
              </div>

              <div className="min-w-0 space-y-1">
                <Label className="text-xs text-gray-500">Hasta</Label>
                <input
                  type="date"
                  value={selectedHasta}
                  max={todayStr}
                  onChange={(e) => onFechaChange("hasta", e.target.value)}
                  className="h-9 w-full max-w-full appearance-none rounded-md border border-input bg-white px-2.5 sm:px-3 text-xs sm:text-sm"
                />
              </div>
            </div>

            <Button
              variant="outline"
              onClick={applyFilter}
              disabled={isPending}
              className="h-9 w-full sm:w-auto rounded-lg sm:rounded-full px-4 text-xs font-medium"
            >
              {isPending ? "Cargando..." : "Ver período"}
            </Button>
          </div>

          {/* Alcance de estado: cuadrícula 2x2 uniforme en móvil */}
          <div className="w-full lg:w-auto space-y-1">
            <Label className="text-xs text-gray-500">Estado de órdenes</Label>
            <div className="grid grid-cols-2 sm:flex gap-1 rounded-lg border bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setScope("confirmadas")}
                className={`flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                  scope === "confirmadas"
                    ? "bg-gray-900 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Confirmadas ({statusSummary.confirmadas})
              </button>
              <button
                type="button"
                onClick={() => setScope("completadas")}
                className={`flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                  scope === "completadas"
                    ? "bg-gray-900 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Completadas ({statusSummary.completadas})
              </button>
              <button
                type="button"
                onClick={() => setScope("en_proceso")}
                className={`flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                  scope === "en_proceso"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                En proceso ({statusSummary.enProceso})
              </button>
              <button
                type="button"
                onClick={() => setScope("todas")}
                className={`flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                  scope === "todas"
                    ? "bg-gray-900 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Todas ({statusSummary.confirmadas + statusSummary.enProceso})
              </button>
            </div>
          </div>
        </div>

        {/* Filtros de Entrega y Pago: 3 columnas iguales en móvil */}
        <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center w-full sm:w-auto">
            <div className="w-full sm:w-auto space-y-1 sm:space-y-0 sm:flex sm:items-center sm:gap-2">
              <Label className="text-xs text-gray-500 block sm:inline">Entrega</Label>
              <div className="grid grid-cols-3 sm:inline-flex w-full sm:w-auto gap-1 rounded-lg border bg-gray-50 p-1">
                {[
                  { id: "all", label: "Todas", icon: Globe },
                  { id: "envio", label: "Envío", icon: Truck },
                  { id: "retiro", label: "Retiro", icon: Store },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModalidadFilter(m.id as ModalidadFilter)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                      modalidadFilter === m.id
                        ? "bg-white text-purple-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    <m.icon size={13} className="shrink-0" />
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {metodosList.length > 0 && (
              <div className="w-full sm:w-auto space-y-1 sm:space-y-0 sm:flex sm:items-center sm:gap-2">
                <Label className="text-xs text-gray-500 block sm:inline">Pago</Label>
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setMetodoFilter("all")}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition ${
                      metodoFilter === "all"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Todos
                  </button>
                  {metodosList.map((m) => (
                    <button
                      key={m.type}
                      type="button"
                      onClick={() =>
                        setMetodoFilter((prev) => (prev === m.type ? "all" : m.type))
                      }
                      className={`rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition ${
                        metodoFilter === m.type
                          ? "bg-purple-700 text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {m.label} ({m.count})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {hasActiveSubFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetInteractiveFilters}
              className="h-8 w-full sm:w-auto px-2.5 text-xs text-purple-700 hover:bg-purple-50 hover:text-purple-900"
            >
              <X size={13} className="mr-1" />
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Tarjetas KPI Principales */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {/* 1. Facturación Web */}
        <div className="rounded-xl border bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Facturación Web</p>
            <div className="rounded-lg bg-emerald-50 p-2">
              <DollarSign size={16} className="text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">
            {fmtUSD(kpis.totalVentas)}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <ChangeBadge pct={kpis.ventasChangePct} />
            <span className="text-[11px] text-gray-400">
              {kpis.shareVentasEmpresa.toFixed(1)}% del total empresa
            </span>
          </div>
        </div>

        {/* 2. Cantidad de Órdenes Web */}
        <div className="rounded-xl border bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Órdenes Web</p>
            <div className="rounded-lg bg-purple-50 p-2">
              <ShoppingBag size={16} className="text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">
            {kpis.ordenesCount}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <ChangeBadge pct={kpis.ordenesChangePct} />
            <span className="text-[11px] text-gray-400">
              {kpis.envioOrders} envío · {kpis.pickupOrders} retiro
            </span>
          </div>
        </div>

        {/* 3. Cantidad de Productos Vendidos */}
        <div className="rounded-xl border bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Productos vendidos</p>
            <div className="rounded-lg bg-blue-50 p-2">
              <Package size={16} className="text-blue-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-gray-900 tabular-nums">
              {kpis.productosVendidos}
            </p>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {formatDocenas(kpis.productosVendidos)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <ChangeBadge pct={kpis.productosChangePct} />
            <span className="text-[11px] text-gray-400">
              {productosList.length} modelo{productosList.length !== 1 ? "s" : ""} distinto
              {productosList.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* 4. Ticket Promedio & Piezas por Orden */}
        <div className="rounded-xl border bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Ticket promedio Web</p>
            <div className="rounded-lg bg-amber-50 p-2">
              <TrendingUp size={16} className="text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">
            {fmtUSD(kpis.ticketPromedio)}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-gray-500">
            <span>Prom. {kpis.piezasPorOrden.toFixed(1)} pzas / orden</span>
            <span>{clientesList.length} cliente{clientesList.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Resumen y distribución del período */}
      <div className="rounded-xl border bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-purple-100 p-1.5 text-purple-700">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Ventas Web — {formatRangoLabel(desde, hasta)}
              </h2>
            </div>
          </div>
        </div>

        {/* Tarjetas de Insights */}
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((ins, i) => {
            const style = INSIGHT_STYLE[ins.type];
            const Icon = style.icon;
            return (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-lg border p-3 ${style.bg} ${style.border}`}
              >
                <Icon size={16} className={`mt-0.5 shrink-0 ${style.text}`} />
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${style.text}`}>{ins.title}</p>
                  <p className={`mt-0.5 text-xs leading-relaxed opacity-90 ${style.text}`}>
                    {ins.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Gráficos interactivos: Días de la semana + Modalidad y Métodos de Pago */}
        <div className="grid gap-4 pt-2 lg:grid-cols-2">
          {/* Actividad por Día de la Semana */}
          <div className="rounded-xl border bg-gray-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-purple-600" />
                <h3 className="text-xs font-semibold text-gray-800">
                  Ventas por día de la semana
                </h3>
              </div>
              {diaFilter !== null && (
                <button
                  type="button"
                  onClick={() => setDiaFilter(null)}
                  className="text-[11px] font-medium text-purple-700 hover:underline"
                >
                  Ver todos los días
                </button>
              )}
            </div>

            <div className="space-y-2">
              {diasSemanaList.map((d) => {
                const pct = d.totalUsd > 0 ? (d.totalUsd / maxDayUsd) * 100 : 0;
                const isSelected = diaFilter === d.dayOfWeek;
                return (
                  <button
                    key={d.dayOfWeek}
                    type="button"
                    onClick={() =>
                      setDiaFilter((prev) => (prev === d.dayOfWeek ? null : d.dayOfWeek))
                    }
                    className={`w-full rounded-lg px-2.5 py-1.5 text-left transition ${
                      isSelected
                        ? "bg-purple-100/80 ring-1 ring-purple-400"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-800">
                        {d.label}{" "}
                        <span className="text-gray-400 font-normal">
                          ({d.ordenes} órd. · {d.productos} pzas)
                        </span>
                      </span>
                      <span className="font-semibold text-gray-900">
                        {fmtUSD(d.totalUsd)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200/80">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isSelected ? "bg-purple-700" : "bg-purple-500"
                        }`}
                        style={{ width: `${d.totalUsd > 0 ? Math.max(4, pct) : 0}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Distribución por Modalidad + Métodos de Pago */}
          <div className="rounded-xl border bg-gray-50/60 p-4 space-y-4">
            {/* Modalidad */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Truck size={14} className="text-blue-600" />
                  <h3 className="text-xs font-semibold text-gray-800">
                    Modalidad de entrega
                  </h3>
                </div>
                {modalidadFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setModalidadFilter("all")}
                    className="text-[11px] font-medium text-purple-700 hover:underline"
                  >
                    Ver ambas
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setModalidadFilter((p) => (p === "envio" ? "all" : "envio"))
                  }
                  className={`flex flex-col justify-between gap-1.5 rounded-lg border bg-white p-3 text-left transition ${
                    modalidadFilter === "envio"
                      ? "border-purple-500 ring-1 ring-purple-400"
                      : "hover:border-gray-300"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-800 whitespace-nowrap">
                    <Truck size={13} className="shrink-0" />
                    Envío nacional
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm sm:text-base font-bold text-gray-900 tabular-nums">
                      {fmtUSD(kpis.envioUsd)}
                    </p>
                    <span className="text-[11px] font-medium text-gray-500 whitespace-nowrap">
                      {kpis.envioOrders} órd.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setModalidadFilter((p) => (p === "retiro" ? "all" : "retiro"))
                  }
                  className={`flex flex-col justify-between gap-1.5 rounded-lg border bg-white p-3 text-left transition ${
                    modalidadFilter === "retiro"
                      ? "border-red-500 ring-1 ring-red-400"
                      : "hover:border-gray-300"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
                    <Store size={13} className="shrink-0" />
                    Retiro en tienda
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm sm:text-base font-bold text-gray-900 tabular-nums">
                      {fmtUSD(kpis.pickupUsd)}
                    </p>
                    <span className="text-[11px] font-medium text-gray-500 whitespace-nowrap">
                      {kpis.pickupOrders} órd.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Métodos de pago */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CreditCard size={14} className="text-emerald-600" />
                  <h3 className="text-xs font-semibold text-gray-800">
                    Métodos de pago
                  </h3>
                </div>
                {metodoFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setMetodoFilter("all")}
                    className="text-[11px] font-medium text-purple-700 hover:underline"
                  >
                    Ver todos
                  </button>
                )}
              </div>

              {metodosList.length === 0 ? (
                <p className="py-3 text-center text-xs text-gray-400">
                  Sin pagos registrados en este período
                </p>
              ) : (
                <div className="space-y-1.5">
                  {metodosList.map((m) => {
                    const isSelected = metodoFilter === m.type;
                    return (
                      <button
                        key={m.type}
                        type="button"
                        onClick={() =>
                          setMetodoFilter((prev) => (prev === m.type ? "all" : m.type))
                        }
                        className={`w-full rounded-lg px-2.5 py-1.5 text-left transition ${
                          isSelected
                            ? "bg-emerald-50 ring-1 ring-emerald-400"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                METODO_COLORS[m.type] ?? "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {m.label}
                            </span>
                            <span className="text-gray-400">({m.count} pagos)</span>
                          </span>
                          <span className="font-semibold text-gray-900">
                            {fmtUSD(m.totalUsd)}{" "}
                            <span className="text-gray-400 font-normal">
                              ({m.pct.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200/80">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${Math.max(4, m.pct)}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resumen Top 10: Clientes / Productos / Últimas 10 Fechas */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b p-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3">
          <div className="grid grid-cols-3 sm:flex w-full sm:w-auto gap-1 rounded-lg border bg-gray-50 p-1">
            {[
              {
                id: "clientes",
                label: "Top Clientes",
                icon: Users,
              },
              {
                id: "productos",
                label: "Top Productos",
                icon: Package,
              },
              {
                id: "dias",
                label: "Por Fecha",
                icon: Calendar,
              },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as DetailTab)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                  activeTab === t.id
                    ? "bg-gray-900 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <t.icon size={14} className="shrink-0" />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <span className="text-[11px] text-gray-400">
            {activeTab === "clientes" &&
              `Top ${Math.min(10, clientesList.length)} de ${clientesList.length} clientes`}
            {activeTab === "productos" &&
              `Top ${Math.min(10, productosList.length)} de ${productosList.length} productos`}
            {activeTab === "dias" &&
              `Últimas ${Math.min(10, fechasList.length)} de ${fechasList.length} fechas`}
          </span>
        </div>

        {/* TAB 1: TOP 10 CLIENTES */}
        {activeTab === "clientes" && (
          <div>
            {clientesList.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                No hay clientes con compras web para los filtros seleccionados.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Cliente Web</TableHead>
                    <TableHead className="text-center">Modalidad</TableHead>
                    <TableHead className="text-center">Órdenes</TableHead>
                    <TableHead className="text-center">Productos</TableHead>
                    <TableHead className="text-right">Ticket prom.</TableHead>
                    <TableHead className="text-right">Total facturado</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesList.slice(0, 10).map((c, idx) => (
                    <TableRow
                      key={c.key}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedCliente(c)}
                    >
                      <TableCell className="font-bold text-xs text-gray-400">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-sm text-gray-900">{c.nombre}</p>
                        <p className="text-xs text-gray-400">
                          {c.documento} · Últ. compra: {c.ultima_compra}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="inline-flex flex-wrap justify-center gap-1">
                          {c.envio_count > 0 && (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-800 whitespace-nowrap">
                              Envío ({c.envio_count})
                            </span>
                          )}
                          {c.pickup_count > 0 && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800 whitespace-nowrap">
                              Retiro ({c.pickup_count})
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium">
                        {c.ordenes_count}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center gap-1 text-sm font-medium">
                            <Package size={13} className="text-gray-400" />
                            {c.productos_vendidos}
                          </span>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">
                            {formatDocenas(c.productos_vendidos)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs text-gray-600 whitespace-nowrap">
                        {fmtUSD(c.ticket_promedio)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-emerald-700 whitespace-nowrap">
                        {fmtUSD(c.total_ventas)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-gray-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCliente(c);
                          }}
                        >
                          <ChevronRight size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {/* TAB 2: TOP 10 PRODUCTOS VENDIDOS EN WEB */}
        {activeTab === "productos" && (
          <div>
            {productosList.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                No hay productos vendidos para los filtros seleccionados.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Órdenes</TableHead>
                    <TableHead className="w-44">Cantidad vendida</TableHead>
                    <TableHead className="hidden md:table-cell">Desglose de tallas</TableHead>
                    <TableHead className="text-right">Facturación USD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productosList.slice(0, 10).map((p, idx) => {
                    const pct = (p.totalUnits / maxProdUnits) * 100;
                    return (
                      <TableRow key={p.id} className="hover:bg-gray-50">
                        <TableCell className="font-bold text-xs text-gray-400">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {p.photo ? (
                              <Image
                                src={getOptimizedCloudinaryUrl(p.photo, 400)}
                                alt={p.name}
                                width={36}
                                height={36}
                                loading="lazy"
                                className="h-9 w-9 rounded-md border object-cover shrink-0"
                              />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-gray-100 text-gray-400 shrink-0">
                                <Package size={16} />
                              </div>
                            )}
                            <div className="min-w-0">
                              {p.id !== "unknown" ? (
                                <Link
                                  href={`/dashboard/productos/${p.id}`}
                                  className="font-medium text-sm text-gray-900 hover:text-purple-700 hover:underline block truncate"
                                >
                                  {p.name}
                                </Link>
                              ) : (
                                <p className="font-medium text-sm text-gray-900 truncate">
                                  {p.name}
                                </p>
                              )}
                              <p className="text-xs text-gray-400 capitalize">
                                {p.type}
                                {p.color ? ` · ${p.color}` : ""}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm text-gray-700">
                          {p.ordenes_count}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-semibold text-sm text-gray-900 whitespace-nowrap">
                                {p.totalUnits} {p.totalUnits === 1 ? "pieza" : "piezas"}
                              </span>
                              <span className="text-[11px] text-gray-400 whitespace-nowrap">
                                {formatDocenas(p.totalUnits)}
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-purple-600"
                                style={{ width: `${Math.max(5, pct)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(p.sizes).map(([sz, qty]) => (
                              <Badge
                                key={sz}
                                variant="secondary"
                                className="bg-gray-100 font-mono text-[11px] px-1.5 py-0"
                              >
                                {sz}: {qty}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm text-emerald-700 whitespace-nowrap">
                          {fmtUSD(p.totalUsd)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {/* TAB 3: ÚLTIMAS 10 FECHAS */}
        {activeTab === "dias" && (
          <div>
            {fechasList.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                No hay registros diarios en este período.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Día</TableHead>
                    <TableHead className="text-center">Órdenes</TableHead>
                    <TableHead className="text-center">Productos vendidos</TableHead>
                    <TableHead className="w-48">Proporción</TableHead>
                    <TableHead className="text-right">Facturación USD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fechasList.slice(0, 10).map((f) => {
                    const pct = (f.totalUsd / maxFechaUsd) * 100;
                    return (
                      <TableRow key={f.dateStr} className="hover:bg-gray-50">
                        <TableCell className="font-mono text-xs font-medium text-gray-800 whitespace-nowrap">
                          {f.dateStr}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {DAY_NAMES[f.dayOfWeek]}
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium">
                          {f.ordenes}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="text-sm font-medium text-gray-900">
                              {f.productos}
                            </span>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                              {formatDocenas(f.productos)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.max(4, pct)}%` }}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-emerald-700 whitespace-nowrap">
                          {fmtUSD(f.totalUsd)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </div>

      {/* Dialog 1: Detalle de Órdenes por Cliente Web (Idéntico al de Nóminas por Vendedora) */}
      <Dialog
        open={selectedCliente !== null}
        onOpenChange={(o) => !o && setSelectedCliente(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedCliente?.nombre} — {formatRangoLabel(desde, hasta)}
            </DialogTitle>
            <DialogDescription>
              Documento: {selectedCliente?.documento} · Compras por Canal Web
            </DialogDescription>
          </DialogHeader>

          {selectedCliente && (
            <>
              {/* Resumen de 3 bloques igual que en Nóminas */}
              <div className="grid grid-cols-3 gap-3 rounded-xl border bg-gray-50 p-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Órdenes</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedCliente.ordenes_count}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 whitespace-nowrap">
                    Productos comprados
                  </p>
                  <div className="flex items-center justify-center gap-1">
                    <Package size={16} className="text-gray-400" />
                    <p className="text-2xl font-bold text-gray-900">
                      {selectedCliente.productos_vendidos}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDocenas(selectedCliente.productos_vendidos)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Total facturado</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {fmtUSD(selectedCliente.total_ventas)}
                  </p>
                </div>
              </div>

              {/* Tabla de órdenes del cliente */}
              <div className="max-h-[55vh] overflow-y-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 sticky top-0">
                      <TableHead className="whitespace-nowrap"># Orden</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Modalidad</TableHead>
                      <TableHead className="text-center">Productos</TableHead>
                      <TableHead className="text-right">Total USD</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCliente.ordenes.map((o) => (
                      <TableRow
                        key={o.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => setSelectedOrden(o)}
                      >
                        <TableCell className="font-mono text-xs font-semibold text-purple-700">
                          {shortOrderNumber(o.order_number)}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">{o.dateStr}</TableCell>
                        <TableCell>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              o.isPickup
                                ? "bg-red-100 text-red-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {o.isPickup ? "Retiro en tienda" : "Envío Web"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 text-sm">
                            <ShoppingBag size={12} className="text-gray-400" />
                            {o.productos_count} ({formatDocenas(o.productos_count)})
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-emerald-700">
                          {fmtUSD(o.total_usd)}
                        </TableCell>
                        <TableCell className="text-right">
                          <ChevronRight size={14} className="text-gray-400" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCliente(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog 2: Detalle Completo de una Orden Web (productos, tallas, cantidades, pagos) */}
      <Dialog
        open={selectedOrden !== null}
        onOpenChange={(o) => !o && setSelectedOrden(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Orden {selectedOrden?.order_number}</span>
              {selectedOrden && (
                <Badge
                  className={`border-0 text-xs ${
                    STATUS_CLASSES[selectedOrden.status] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {STATUS_LABELS[selectedOrden.status] ?? selectedOrden.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedOrden?.customer_name} {selectedOrden?.customer_lastname} (
              {selectedOrden?.customer_id_doc}) · Fecha: {selectedOrden?.dateStr}
            </DialogDescription>
          </DialogHeader>

          {selectedOrden && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 rounded-xl border bg-gray-50 p-3.5 text-center">
                <div>
                  <p className="text-xs text-gray-500">Modalidad</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-900">
                    {selectedOrden.isPickup
                      ? "Retiro en tienda"
                      : `Envío (${selectedOrden.shipping_company || "Nacional"})`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Cantidad de productos</p>
                  <p className="mt-0.5 text-sm font-bold text-gray-900">
                    {selectedOrden.productos_count} pzas (
                    {formatDocenas(selectedOrden.productos_count)})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total facturado</p>
                  <p className="mt-0.5 text-base font-bold text-emerald-700">
                    {fmtUSD(selectedOrden.total_usd)}
                  </p>
                </div>
              </div>

              {/* Lista de productos de la orden */}
              <div className="max-h-[45vh] overflow-y-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 sticky top-0">
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-center">Talla</TableHead>
                      <TableHead className="text-center">Cantidad</TableHead>
                      <TableHead className="text-right">Precio unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrden.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            {item.photo ? (
                              <Image
                                src={getOptimizedCloudinaryUrl(item.photo, 200)}
                                alt={item.product_name}
                                width={32}
                                height={32}
                                className="h-8 w-8 rounded border object-cover shrink-0"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded border bg-gray-100 text-gray-400 shrink-0">
                                <Package size={14} />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {item.product_name}
                              </p>
                              <p className="text-[11px] text-gray-400">
                                {item.product_type}
                                {item.product_color ? ` · ${item.product_color}` : ""}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {item.size}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right text-xs text-gray-600">
                          {fmtUSD(item.unit_price_usd)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold">
                          {fmtUSD(item.subtotal_usd)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            {selectedOrden && (
              <Link
                href={`/dashboard/ordenes/${selectedOrden.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 hover:underline"
              >
                Ver expediente completo de la orden
                <ExternalLink size={13} />
              </Link>
            )}
            <Button variant="outline" onClick={() => setSelectedOrden(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
