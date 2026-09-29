export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ResumenClient } from "@/components/shared/finanzas/ResumenClient";
import { HistorialClient } from "@/components/shared/finanzas/HistorialClient";
import { FinanzasTabs } from "@/components/shared/finanzas/FinanzasTabs";
import { getOrderCategory } from "@/lib/order-utils";
import type { HistorialData, InsightType } from "@/components/shared/finanzas/HistorialClient";

import { ProductosAnalisisClient } from "@/components/shared/finanzas/ProductosAnalisisClient";

type SP = { [key: string]: string | string[] | undefined };
function s(v: SP[string]) { return typeof v === "string" ? v : ""; }

function localDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const CAT_LABELS: Record<string, string> = {
  operativo: "Operativo",
  logistica: "Logística",
  nomina:    "Nómina",
  otro:      "Otro",
};

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function pct(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

function generateInsights(d: {
  totalIngresos: number; totalEgresos: number; margen: number; margenPct: number;
  ticketPromedio: number; countOrdenes: number; prevTotalIngresos: number;
  prevCountOrdenes: number; ingresosChangePct: number | null; egresosChangePct: number | null;
  ingresosOnline: number; ingresosTienda: number; ingresosWeb: number;
  countOnline: number; countTienda: number; countWeb: number;
  topVendedora: { nombre: string; total: number } | null;
  categoryBreakdown: { category: string; label: string; total: number; percentage: number; count: number }[];
}): { type: InsightType; text: string }[] {
  const out: { type: InsightType; text: string }[] = [];

  if (d.countOrdenes === 0 && d.totalEgresos === 0) {
    out.push({ type: "info", text: "No hay datos en el período seleccionado." });
    return out;
  }

  if (d.totalIngresos > 0) {
    if (d.margenPct >= 60)
      out.push({ type: "positive", text: `Margen bruto de ${d.margenPct.toFixed(0)}% — muy saludable para el período.` });
    else if (d.margenPct >= 30)
      out.push({ type: "info", text: `Margen bruto del ${d.margenPct.toFixed(0)}%. Hay espacio para optimizar gastos.` });
    else if (d.margenPct >= 0)
      out.push({ type: "warning", text: `Margen bruto bajo: ${d.margenPct.toFixed(0)}%. Los gastos están absorbiendo casi todo el ingreso.` });
    else
      out.push({ type: "negative", text: `Los egresos superan los ingresos en $${Math.abs(d.margen).toFixed(2)}. Revisar gastos urgente.` });
  }

  if (d.ingresosChangePct !== null) {
    if (d.ingresosChangePct > 15)
      out.push({ type: "positive", text: `Ingresos +${d.ingresosChangePct.toFixed(0)}% respecto al período anterior — tendencia al alza.` });
    else if (d.ingresosChangePct < -15)
      out.push({ type: "negative", text: `Ingresos ${d.ingresosChangePct.toFixed(0)}% vs período anterior. La facturación bajó significativamente.` });
    else
      out.push({ type: "info", text: `Ingresos estables respecto al período anterior (${d.ingresosChangePct > 0 ? "+" : ""}${d.ingresosChangePct.toFixed(0)}%).` });
  }
  if (d.egresosChangePct !== null && d.egresosChangePct > 20)
    out.push({ type: "warning", text: `Los gastos subieron un ${d.egresosChangePct.toFixed(0)}% vs el período anterior.` });

  if (d.countOrdenes > 0)
    out.push({ type: "info", text: `Ticket promedio: $${d.ticketPromedio.toFixed(2)} sobre ${d.countOrdenes} orden${d.countOrdenes !== 1 ? "es" : ""} completada${d.countOrdenes !== 1 ? "s" : ""}.` });

  const totalCanal = d.ingresosOnline + d.ingresosTienda + d.ingresosWeb;
  if (totalCanal > 0) {
    const channels = [
      { name: "Web", total: d.ingresosWeb, count: d.countWeb },
      { name: "Online", total: d.ingresosOnline, count: d.countOnline },
      { name: "Tienda", total: d.ingresosTienda, count: d.countTienda },
    ].filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

    if (channels.length > 1) {
      const top = channels[0];
      const topPct = ((top.total / totalCanal) * 100).toFixed(0);
      out.push({
        type: "info",
        text: `Canal ${top.name} lidera con el ${topPct}% de las ventas ($${top.total.toFixed(2)} sobre ${top.count} órdenes).`,
      });
    } else if (channels.length === 1) {
      out.push({
        type: "info",
        text: `Todas las ventas del período son del canal ${channels[0].name} ($${channels[0].total.toFixed(2)}).`,
      });
    }
  }

  if (d.categoryBreakdown.length > 0) {
    const topCat = d.categoryBreakdown[0];
    if (topCat.percentage >= 50)
      out.push({ type: "warning", text: `"${topCat.label}" representa el ${topCat.percentage.toFixed(0)}% del total de egresos ($${topCat.total.toFixed(2)}).` });
    else
      out.push({ type: "info", text: `Gasto principal: "${topCat.label}" (${topCat.percentage.toFixed(0)}% — $${topCat.total.toFixed(2)}).` });
  }

  if (d.topVendedora)
    out.push({ type: "positive", text: `Mejor vendedora del período: ${d.topVendedora.nombre} con $${d.topVendedora.total.toFixed(2)} en ventas enviadas o completadas.` });

  if (d.totalIngresos > 0 && d.totalEgresos === 0)
    out.push({ type: "info", text: "No se registraron gastos en este período. Considera registrarlos para un análisis completo." });

  return out;
}

export default async function FinanzasPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const tab = s(searchParams.tab) || "resumen";

  // ── Productos tab ────────────────────────────────────────────────────────────
  if (tab === "productos") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanzas</h1>
          <p className="mt-0.5 text-sm text-gray-500">Análisis interactivo de productos y rotación de inventario</p>
        </div>
        <FinanzasTabs active="productos" />
        <ProductosAnalisisClient />
      </div>
    );
  }

  // ── Resumen tab ─────────────────────────────────────────────────────────────
  if (tab !== "historial") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanzas</h1>
          <p className="mt-0.5 text-sm text-gray-500">Resumen financiero del negocio</p>
        </div>
        <FinanzasTabs active="resumen" />
        <ResumenClient />
      </div>
    );
  }

  // ── Historial tab ────────────────────────────────────────────────────────────
  const now = new Date();
  const defaultDesde = localDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultHasta = localDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const desdeStr = s(searchParams.desde) || defaultDesde;
  const hastaStr = s(searchParams.hasta) || defaultHasta;

  const desde  = new Date(desdeStr);
  const hastaD = new Date(`${hastaStr}T23:59:59`);
  const periodDays = Math.max(1, Math.ceil((hastaD.getTime() - desde.getTime()) / 86_400_000));

  const prevHasta = new Date(desde.getTime() - 1);
  const prevDesde = new Date(prevHasta.getTime() - (periodDays - 1) * 86_400_000);
  prevDesde.setHours(0, 0, 0, 0);
  prevHasta.setHours(23, 59, 59, 999);

  const [ordenes, gastos, prevAggrOrdenes, prevAggrGastos, topVendedoraRaw] = await Promise.all([
    prisma.order.findMany({
      where: { status: "completada", created_at: { gte: desde, lte: hastaD } },
      orderBy: { created_at: "desc" },
      select: {
        id: true, order_number: true, created_at: true,
        customer_name: true, customer_lastname: true,
        channel: true, total_usd: true,
        created_by: true, notes: true,
        creator: { select: { name: true } },
      },
    }),
    prisma.expense.findMany({
      where: { expense_date: { gte: desde, lte: hastaD } },
      select: {
        id: true,
        expense_date: true,
        description: true,
        category: true,
        amount_usd: true,
        notas: true,
        creator: { select: { name: true } },
      },
      orderBy: { expense_date: "desc" },
    }),
    prisma.order.aggregate({
      where: { status: "completada", created_at: { gte: prevDesde, lte: prevHasta } },
      _sum: { total_usd: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { expense_date: { gte: prevDesde, lte: prevHasta } },
      _sum: { amount_usd: true },
    }),
    prisma.order.groupBy({
      by: ["created_by"],
      where: { status: { in: ["enviada", "completada"] }, created_at: { gte: desde, lte: hastaD } },
      _sum: { total_usd: true },
      orderBy: { _sum: { total_usd: "desc" } },
      take: 1,
    }),
  ]);

  let topVendedora: { nombre: string; total: number } | null = null;
  if (topVendedoraRaw.length > 0 && topVendedoraRaw[0].created_by) {
    const u = await prisma.user.findUnique({
      where: { id: topVendedoraRaw[0].created_by },
      select: { name: true },
    });
    if (u) topVendedora = { nombre: u.name, total: Number(topVendedoraRaw[0]._sum.total_usd ?? 0) };
  } else if (topVendedoraRaw.length > 0) {
    topVendedora = { nombre: "Web Directa", total: Number(topVendedoraRaw[0]._sum.total_usd ?? 0) };
  }

  const totalIngresos  = ordenes.reduce((s, o) => s + Number(o.total_usd), 0);
  const totalEgresos   = gastos.reduce((s, g) => s + Number(g.amount_usd), 0);
  const margen         = totalIngresos - totalEgresos;
  const margenPct      = totalIngresos > 0 ? (margen / totalIngresos) * 100 : 0;
  const countOrdenes   = ordenes.length;
  const ticketPromedio = countOrdenes > 0 ? totalIngresos / countOrdenes : 0;

  let ingresosTienda = 0;
  let countTienda = 0;
  let ingresosOnline = 0;
  let countOnline = 0;
  let ingresosWeb = 0;
  let countWeb = 0;

  for (const o of ordenes) {
    const cat = getOrderCategory(o);
    const val = Number(o.total_usd);
    if (cat === "web") {
      ingresosWeb += val;
      countWeb++;
    } else if (cat === "online") {
      ingresosOnline += val;
      countOnline++;
    } else {
      ingresosTienda += val;
      countTienda++;
    }
  }

  const prevTotalIngresos = Number(prevAggrOrdenes._sum.total_usd ?? 0);
  const prevTotalEgresos  = Number(prevAggrGastos._sum.amount_usd ?? 0);
  const prevCountOrdenes  = prevAggrOrdenes._count;
  const ingresosChangePct = pct(totalIngresos, prevTotalIngresos);
  const egresosChangePct  = pct(totalEgresos, prevTotalEgresos);

  const catMap = new Map<string, { total: number; count: number }>();
  for (const g of gastos) {
    const e = catMap.get(g.category) ?? { total: 0, count: 0 };
    catMap.set(g.category, { total: e.total + Number(g.amount_usd), count: e.count + 1 });
  }
  const categoryBreakdown = Array.from(catMap.entries())
    .map(([cat, data]) => ({
      category: cat, label: CAT_LABELS[cat] ?? cat,
      total: data.total,
      percentage: totalEgresos > 0 ? (data.total / totalEgresos) * 100 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.total - a.total);

  const dayMap = new Map<number, { count: number; total: number }>();
  for (const o of ordenes) {
    const day = new Date(o.created_at).getDay();
    const e = dayMap.get(day) ?? { count: 0, total: 0 };
    dayMap.set(day, { count: e.count + 1, total: e.total + Number(o.total_usd) });
  }
  const diasActivos = Array.from(dayMap.entries())
    .map(([day, data]) => ({ dia: DAY_NAMES[day], dayNum: day, count: data.count, total: data.total }))
    .sort((a, b) => b.count - a.count);

  const insights = generateInsights({
    totalIngresos, totalEgresos, margen, margenPct, ticketPromedio, countOrdenes,
    prevTotalIngresos, prevCountOrdenes, ingresosChangePct, egresosChangePct,
    ingresosOnline, ingresosTienda, ingresosWeb,
    countOnline, countTienda, countWeb,
    topVendedora, categoryBreakdown,
  });

  const data: HistorialData = {
    desde: desdeStr, hasta: hastaStr, periodDays,
    totalIngresos, totalEgresos, margen, margenPct, ticketPromedio, countOrdenes,
    prevTotalIngresos, prevTotalEgresos, prevCountOrdenes,
    ingresosChangePct, egresosChangePct,
    ingresosOnline, ingresosTienda, ingresosWeb,
    countOnline, countTienda, countWeb,
    topVendedora, categoryBreakdown, diasActivos, insights,
    ingresos: ordenes.map((o) => ({
      id: o.id, order_number: o.order_number,
      date: o.created_at.toISOString().slice(0, 10),
      customer: `${o.customer_name} ${o.customer_lastname}`,
      channel: o.channel,
      notes: o.notes,
      created_by: o.created_by,
      seller: o.creator?.name ?? (getOrderCategory(o) === "web" ? "Cliente Web" : "Sin asignar"),
      total_usd: Number(o.total_usd),
    })),
    egresos: gastos.map((g) => ({
      id: g.id, date: g.expense_date.toISOString().slice(0, 10),
      description: g.description, category: g.category,
      categoryLabel: CAT_LABELS[g.category] ?? g.category,
      amount_usd: Number(g.amount_usd), creator: g.creator.name,
      notas: g.notas,
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finanzas</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {ordenes.length} ingresos · {gastos.length} egresos en el período
        </p>
      </div>
      <FinanzasTabs active="historial" />
      <HistorialClient data={data} />
    </div>
  );
}
