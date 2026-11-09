import { prisma } from "@/lib/prisma";
import { shortOrderNumber } from "@/lib/order-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ShoppingBag, TrendingUp, Clock, ShoppingCart, Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ImportWhatsAppModal } from "@/components/shared/ordenes/ImportWhatsAppModal";
import { getVenezuelaStartOfDay, getVenezuelaParts, formatVenezuelaDate } from "@/lib/date-utils";
import { formatRangoLabel, rangoMes, rangoADateTime } from "@/lib/payroll-periods";
import type { SessionUser } from "@/types";

const MESES_NOMBRE = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const STATUS_LABELS: Record<string, string> = {
  pendiente_pago:   "Pendiente pago",
  pago_parcial:     "Pago parcial",
  pago_verificado:  "Pago verificado",
  en_embalaje:      "En embalaje",
  enviada:          "Enviada",
  completada:       "Completada",
  cancelada:        "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  pendiente_pago:  "bg-yellow-100 text-yellow-800",
  pago_parcial:    "bg-orange-100 text-orange-800",
  pago_verificado: "bg-blue-100 text-blue-800",
  en_embalaje:     "bg-purple-100 text-purple-800",
  enviada:         "bg-indigo-100 text-indigo-800",
  completada:      "bg-emerald-100 text-emerald-800",
  cancelada:       "bg-gray-100 text-gray-700",
};

function fmt(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date) {
  return formatVenezuelaDate(d, { day: "2-digit", month: "short", year: "numeric" });
}

type Props = { session: SessionUser };

export async function VendedoraDashboard({ session }: Props) {
  const now = new Date();
  const todayStart = getVenezuelaStartOfDay(now);
  const { month: currentMonth } = getVenezuelaParts(now);
  const mesNombre = MESES_NOMBRE[currentMonth - 1] ?? "este mes";

  const mesActualRango = rangoMes(now);
  const { inicio: startOfMonth, fin: endOfMonth } = rangoADateTime(
    mesActualRango.desde,
    mesActualRango.hasta
  );

  const ultimoCorte = await prisma.payrollRecord.findFirst({
    where: { userId: session.id, status: "pagada" },
    orderBy: [{ periodo_fin: "desc" }, { paid_at: "desc" }],
    select: { periodo_inicio: true, periodo_fin: true, paid_at: true },
  });

  const ultimoInicioISO = ultimoCorte ? ultimoCorte.periodo_inicio.toISOString().slice(0, 10) : null;
  const ultimoFinISO    = ultimoCorte ? ultimoCorte.periodo_fin.toISOString().slice(0, 10) : null;
  const corteDesde      = ultimoInicioISO && ultimoFinISO
    ? rangoADateTime(ultimoInicioISO, ultimoFinISO).inicio
    : null;

  const [ordenesHoy, unidadesCorte, unidadesMes, ordenesActivas, ordenesEnProceso, misUltimasOrdenes] = await Promise.all([
    prisma.order.count({
      where: {
        created_by: session.id,
        created_at: { gte: todayStart },
      },
    }),
    prisma.orderItem.aggregate({
      where: {
        order: {
          created_by: session.id,
          status: { in: ["enviada", "completada"] },
          incluido_en_nomina_id: null,
          ...(corteDesde ? { updated_at: { gte: corteDesde } } : {}),
        },
      },
      _sum: { quantity: true },
    }),
    prisma.orderItem.aggregate({
      where: {
        order: {
          created_by: session.id,
          status: { in: ["enviada", "completada"] },
          updated_at: { gte: startOfMonth, lte: endOfMonth },
        },
      },
      _sum: { quantity: true },
    }),
    prisma.order.count({
      where: {
        created_by: session.id,
        status: { notIn: ["enviada", "completada", "cancelada"] },
      },
    }),
    prisma.cart.count({
      where: {
        vendor_id: session.id,
        status: "active",
      },
    }),
    prisma.order.findMany({
      where: { created_by: session.id },
      orderBy: { created_at: "desc" },
      take: 5,
      select: {
        id: true,
        order_number: true,
        customer_name: true,
        customer_lastname: true,
        status: true,
        total_usd: true,
        created_at: true,
      },
    }),
  ]);

  const piezasCorte = unidadesCorte._sum.quantity ?? 0;
  const piezasMes   = unidadesMes._sum.quantity ?? 0;
  const descCorte   = ultimoInicioISO && ultimoFinISO
    ? `Desde último corte (${formatRangoLabel(ultimoInicioISO, ultimoFinISO)})`
    : "Pendientes de corte (sin cortes previos)";

  const CARDS = [
    {
      label: "Órdenes hoy",
      value: String(ordenesHoy),
      desc: "Creadas por ti hoy",
      sub: null as string | null,
      icon: ShoppingBag,
      color: "text-blue-600",
      bg: "bg-blue-50",
      href: "/dashboard/ordenes",
    },
    {
      label: "Piezas (corte actual)",
      value: String(piezasCorte),
      desc: descCorte,
      sub: `Total en ${mesNombre}: ${piezasMes} pza${piezasMes === 1 ? "" : "s"}`,
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      href: null,
    },
    {
      label: "Órdenes activas",
      value: String(ordenesActivas),
      desc: "En proceso actualmente",
      sub: null as string | null,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      href: "/dashboard/ordenes",
    },
    {
      label: "En proceso",
      value: String(ordenesEnProceso),
      desc: "Preórdenes sin confirmar",
      sub: null as string | null,
      icon: ShoppingCart,
      color: "text-violet-600",
      bg: "bg-violet-50",
      href: "/dashboard/ordenes",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hola, {session.name} 👋</h1>
          <p className="text-sm text-gray-500">Resumen de tus ventas y órdenes activas</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ImportWhatsAppModal className="flex-1 sm:flex-initial justify-center text-xs sm:text-sm px-2.5 sm:px-4 py-2" />
          <Link
            href="/dashboard/ordenes/nueva"
            className={cn(
              buttonVariants(),
              "flex-1 sm:flex-initial justify-center text-xs sm:text-sm px-2.5 sm:px-4 py-2 shrink-0 whitespace-nowrap"
            )}
          >
            <Plus size={16} className="shrink-0" />
            <span>Nueva orden</span>
          </Link>
        </div>
      </div>

      {/* Tarjetas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c) => {
          const inner = (
            <Card key={c.label} className={cn("h-full", c.href ? "cursor-pointer hover:border-gray-300 transition-colors" : "")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{c.label}</CardTitle>
                <div className={`rounded-lg p-2 ${c.bg}`}>
                  <c.icon size={18} className={c.color} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900">{c.value}</p>
                <p className="mt-0.5 text-xs text-gray-500">{c.desc}</p>
                {c.sub && (
                  <p className="mt-1.5 inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    {c.sub}
                  </p>
                )}
              </CardContent>
            </Card>
          );
          return c.href ? (
            <Link key={c.label} href={c.href}>{inner}</Link>
          ) : (
            <div key={c.label}>{inner}</div>
          );
        })}
      </div>

      {/* Mis últimas órdenes */}
      <div className="rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold text-gray-900">Mis últimas órdenes</h2>
          <Link href="/dashboard/ordenes" className="text-xs text-blue-600 hover:underline">
            Ver todas
          </Link>
        </div>
        {misUltimasOrdenes.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">
            Aún no has creado órdenes
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead># Orden</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {misUltimasOrdenes.map((o) => (
                <TableRow key={o.id} className="cursor-pointer hover:bg-gray-50">
                  <TableCell className="font-mono text-xs font-semibold text-gray-700">
                    <Link href={`/dashboard/ordenes/${o.id}`} className="hover:underline">
                      {shortOrderNumber(o.order_number)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {o.customer_name} {o.customer_lastname}
                  </TableCell>
                  <TableCell>
                    <Badge className={`border-0 text-xs ${STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-sm">
                    {fmt(Number(o.total_usd))}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {fmtDate(o.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
