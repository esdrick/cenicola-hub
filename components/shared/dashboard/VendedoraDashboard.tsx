import { prisma } from "@/lib/prisma";
import { shortOrderNumber } from "@/lib/order-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, TrendingUp, Clock, ShoppingCart } from "lucide-react";
import Link from "next/link";
import type { SessionUser } from "@/types";

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
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
}

type Props = { session: SessionUser };

export async function VendedoraDashboard({ session }: Props) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [ordenesHoy, unidadesMes, ordenesActivas, ordenesEnProceso, misUltimasOrdenes] = await Promise.all([
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
          status: "completada",
          created_at: { gte: startOfMonth },
        },
      },
      _sum: { quantity: true },
    }),
    prisma.order.count({
      where: {
        created_by: session.id,
        status: { notIn: ["completada", "cancelada"] },
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

  const CARDS = [
    {
      label: "Órdenes hoy",
      value: String(ordenesHoy),
      desc: "Creadas por ti hoy",
      icon: ShoppingBag,
      color: "text-blue-600",
      bg: "bg-blue-50",
      href: "/dashboard/ordenes",
    },
    {
      label: "Vendido este mes",
      value: String(unidadesMes._sum.quantity ?? 0),
      desc: "Unidades vendidas en tus órdenes completadas",
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      href: null,
    },
    {
      label: "Órdenes activas",
      value: String(ordenesActivas),
      desc: "En proceso actualmente",
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      href: "/dashboard/ordenes",
    },
    {
      label: "En proceso",
      value: String(ordenesEnProceso),
      desc: "Preórdenes sin confirmar",
      icon: ShoppingCart,
      color: "text-violet-600",
      bg: "bg-violet-50",
      href: "/dashboard/ordenes",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tarjetas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c) => {
          const inner = (
            <Card key={c.label} className={c.href ? "cursor-pointer hover:border-gray-300 transition-colors" : ""}>
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
