import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, ShoppingCart, Clock } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  pendiente_pago:   "Pendiente pago",
  pago_parcial:     "Pago parcial",
  pago_verificado:  "Pago verificado",
  en_embalaje:      "En embalaje",
  enviada:          "Enviada",
  completada:       "Completada",
  cancelada:        "Cancelada",
};

const STATUS_ORDER = [
  "pendiente_pago","pago_parcial","pago_verificado",
  "en_embalaje","enviada","completada","cancelada",
];

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

export async function AdminDashboard() {
  const now = new Date();

  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const monday = new Date(now);
  const dow = now.getDay();
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [
    ventasHoy,
    ventasSemana,
    ordenesActivas,
    cuentasCobrar,
    ordenesPorEstado,
    topSellersRaw,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { status: "completada", created_at: { gte: todayStart, lte: todayEnd } },
      _sum: { total_usd: true },
    }),
    prisma.order.aggregate({
      where: { status: "completada", created_at: { gte: monday, lte: todayEnd } },
      _sum: { total_usd: true },
    }),
    prisma.order.count({
      where: { status: { notIn: ["completada", "cancelada"] } },
    }),
    prisma.accountReceivable.findMany({
      where: { status: { in: ["pendiente", "cobrado_parcial"] } },
      select: { amount_usd: true, amount_paid_usd: true },
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["created_by"],
      where: { status: "completada", created_at: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { total_usd: true },
      orderBy: { _sum: { total_usd: "desc" } },
      take: 3,
    }),
  ]);

  const sellerIds = topSellersRaw.map((s) => s.created_by);
  const sellerUsers =
    sellerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: sellerIds } },
          select: { id: true, name: true },
        })
      : [];
  const sellerMap = Object.fromEntries(sellerUsers.map((u) => [u.id, u.name]));

  const topVendedoras = topSellersRaw.map((s) => ({
    nombre: sellerMap[s.created_by] ?? "Desconocida",
    total: Number(s._sum.total_usd ?? 0),
  }));

  const totalCobrar = cuentasCobrar.reduce(
    (sum, c) => sum + Number(c.amount_usd) - Number(c.amount_paid_usd),
    0
  );

  const statusMap = Object.fromEntries(ordenesPorEstado.map((o) => [o.status, o._count._all]));
  const estadosData = STATUS_ORDER.map((s) => ({ status: s, count: statusMap[s] ?? 0 })).filter(
    (s) => s.count > 0
  );

  const CARDS = [
    {
      label: "Ventas hoy",
      value: fmt(Number(ventasHoy._sum.total_usd ?? 0)),
      desc: "Órdenes completadas hoy",
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Ventas esta semana",
      value: fmt(Number(ventasSemana._sum.total_usd ?? 0)),
      desc: "Lunes a hoy",
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Órdenes activas",
      value: String(ordenesActivas),
      desc: "En proceso (sin completar ni cancelar)",
      icon: ShoppingCart,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Por cobrar",
      value: fmt(totalCobrar),
      desc: "Cuentas por cobrar pendientes",
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tarjetas */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{c.label}</CardTitle>
              <div className={`rounded-lg p-2 ${c.bg}`}>
                <c.icon size={18} className={c.color} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{c.value}</p>
              <p className="mt-0.5 text-xs text-gray-500">{c.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sección inferior */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Órdenes por estado */}
        <div className="rounded-xl border bg-white">
          <div className="border-b px-5 py-3">
            <h2 className="font-semibold text-gray-900">Órdenes por estado</h2>
          </div>
          {estadosData.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">No hay órdenes registradas</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estadosData.map((e) => (
                  <TableRow key={e.status}>
                    <TableCell>
                      <Badge className={`border-0 text-xs ${STATUS_COLORS[e.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {STATUS_LABELS[e.status] ?? e.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{e.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Top vendedoras del mes */}
        <div className="rounded-xl border bg-white">
          <div className="border-b px-5 py-3">
            <h2 className="font-semibold text-gray-900">Top vendedoras del mes</h2>
            <p className="text-xs text-gray-500 mt-0.5">Órdenes completadas en el mes actual</p>
          </div>
          {topVendedoras.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              Sin ventas completadas este mes
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>#</TableHead>
                  <TableHead>Vendedora</TableHead>
                  <TableHead className="text-right">Total vendido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topVendedoras.map((v, i) => (
                  <TableRow key={v.nombre}>
                    <TableCell className="font-bold text-gray-400 w-8">{i + 1}</TableCell>
                    <TableCell className="font-medium">{v.nombre}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-700">
                      {fmt(v.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
