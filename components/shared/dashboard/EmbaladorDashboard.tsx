import { prisma } from "@/lib/prisma";
import { shortOrderNumber } from "@/lib/order-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PackageCheck, Truck, CheckCircle2 } from "lucide-react";
import Link from "next/link";

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const days  = Math.floor(diff / 86_400_000);
  const hours = Math.floor(diff / 3_600_000);
  const mins  = Math.floor(diff / 60_000);
  if (days  >= 1) return `hace ${days} día${days  > 1 ? "s" : ""}`;
  if (hours >= 1) return `hace ${hours} h`;
  if (mins  >= 1) return `hace ${mins} min`;
  return "justo ahora";
}

function buildItemsSummary(
  items: Array<{ quantity: number; variant: { size: string; product: { name: string } } }>
): string {
  if (items.length === 0) return "Sin productos";
  const grouped = new Map<string, number>();
  for (const item of items) {
    const key = item.variant.product.name;
    grouped.set(key, (grouped.get(key) ?? 0) + item.quantity);
  }
  return Array.from(grouped.entries())
    .map(([name, qty]) => `${qty}× ${name}`)
    .join(", ");
}

export async function EmbaladorDashboard() {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const monday = new Date(now);
  const dow = now.getDay();
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);

  const [enEmbalajeCount, enviadasHoyCount, completadasSemanaCount, colaEmbalaje] =
    await Promise.all([
      prisma.order.count({ where: { status: "en_embalaje" } }),
      prisma.order.count({
        where: { status: "enviada", updated_at: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.order.count({
        where: { status: "completada", updated_at: { gte: monday } },
      }),
      prisma.order.findMany({
        where: { status: "en_embalaje" },
        orderBy: { updated_at: "asc" },
        select: {
          id: true,
          order_number: true,
          customer_name: true,
          customer_lastname: true,
          address: true,
          updated_at: true,
          items: {
            select: {
              quantity: true,
              variant: { select: { size: true, product: { select: { name: true } } } },
            },
          },
        },
      }),
    ]);

  const CARDS = [
    {
      label: "En embalaje",
      value: String(enEmbalajeCount),
      desc: "Órdenes esperando ser empacadas",
      icon: PackageCheck,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Enviadas hoy",
      value: String(enviadasHoyCount),
      desc: "Despachadas durante el día",
      icon: Truck,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Completadas esta semana",
      value: String(completadasSemanaCount),
      desc: "Lunes a hoy",
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tarjetas */}
      <div className="grid gap-4 sm:grid-cols-3">
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

      {/* Cola de embalaje */}
      <div className="rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <h2 className="font-semibold text-gray-900">Cola de embalaje</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Ordenado de más antigua a más reciente
            </p>
          </div>
          <Link
            href="/dashboard/embalaje"
            className="text-xs text-blue-600 hover:underline"
          >
            Ver todas
          </Link>
        </div>

        {colaEmbalaje.length === 0 ? (
          <div className="py-12 text-center">
            <PackageCheck size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">No hay órdenes en embalaje</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead># Orden</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>En cola</TableHead>
                <TableHead className="text-center">Ir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colaEmbalaje.map((o) => (
                <TableRow key={o.id} className="hover:bg-gray-50">
                  <TableCell className="font-mono text-xs font-semibold text-gray-700">
                    {shortOrderNumber(o.order_number)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {o.customer_name} {o.customer_lastname}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-xs text-gray-500">
                    {o.address ?? "Retiro en tienda"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-gray-600">
                    {buildItemsSummary(o.items)}
                  </TableCell>
                  <TableCell className="text-xs font-medium text-amber-700 whitespace-nowrap">
                    {timeAgo(o.updated_at)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Link
                      href={`/dashboard/embalaje/${o.id}`}
                      className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                    >
                      Empacar
                    </Link>
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
