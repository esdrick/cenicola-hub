import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, Activity } from "lucide-react";

const MOVEMENT_LABELS: Record<string, string> = {
  entrada:      "Entrada",
  salida_venta: "Salida venta",
  ajuste:       "Ajuste",
  devolucion:   "Devolución",
};

const MOVEMENT_COLORS: Record<string, string> = {
  entrada:      "bg-emerald-100 text-emerald-800",
  salida_venta: "bg-red-100 text-red-800",
  ajuste:       "bg-yellow-100 text-yellow-800",
  devolucion:   "bg-blue-100 text-blue-800",
};

function fmtDateTime(d: Date) {
  return d.toLocaleString("es-VE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export async function InventarioDashboard() {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const [
    totalProductos,
    stockBajoCount,
    movimientosHoyCount,
    variantesStockBajo,
    ultimosMovimientos,
  ] = await Promise.all([
    prisma.product.count({ where: { is_active: true } }),
    prisma.productVariant.count({ where: { is_active: true, stock_total: { lt: 5 } } }),
    prisma.inventoryMovement.count({
      where: { created_at: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.productVariant.findMany({
      where: { is_active: true, stock_total: { lt: 5 } },
      include: { product: { select: { name: true, color: true } } },
      orderBy: { stock_total: "asc" },
      take: 10,
    }),
    prisma.inventoryMovement.findMany({
      take: 5,
      orderBy: { created_at: "desc" },
      include: {
        variant: { include: { product: { select: { name: true } } } },
        created_by_user: { select: { name: true } },
      },
    }),
  ]);

  const CARDS = [
    {
      label: "Productos activos",
      value: String(totalProductos),
      desc: "Con al menos una variante",
      icon: Package,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Stock bajo",
      value: String(stockBajoCount),
      desc: "Variantes con menos de 5 unidades",
      icon: AlertTriangle,
      color: stockBajoCount > 0 ? "text-amber-600" : "text-gray-400",
      bg: stockBajoCount > 0 ? "bg-amber-50" : "bg-gray-50",
    },
    {
      label: "Movimientos hoy",
      value: String(movimientosHoyCount),
      desc: "Entradas, salidas y ajustes",
      icon: Activity,
      color: "text-purple-600",
      bg: "bg-purple-50",
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

      {/* Sección inferior */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Stock bajo */}
        <div className="rounded-xl border bg-white">
          <div className="border-b px-5 py-3">
            <h2 className="font-semibold text-gray-900">Stock crítico</h2>
            <p className="text-xs text-gray-500 mt-0.5">Variantes con menos de 5 unidades en total</p>
          </div>
          {variantesStockBajo.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              Todos los productos tienen stock suficiente
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-center">Online</TableHead>
                  <TableHead className="text-center">Tienda</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variantesStockBajo.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{v.product.name}</p>
                      <p className="text-xs text-gray-400">
                        {v.size}{v.product.color ? ` · ${v.product.color}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-center text-sm">{v.stock_online}</TableCell>
                    <TableCell className="text-center text-sm">{v.stock_store}</TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-block min-w-[2rem] rounded-full px-2 py-0.5 text-xs font-bold ${
                        v.stock_total === 0
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {v.stock_total}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Últimos movimientos */}
        <div className="rounded-xl border bg-white">
          <div className="border-b px-5 py-3">
            <h2 className="font-semibold text-gray-900">Últimos movimientos</h2>
          </div>
          {ultimosMovimientos.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              No hay movimientos registrados
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Producto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimosMovimientos.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{m.variant.product.name}</p>
                      <p className="text-xs text-gray-400">{m.variant.size}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={`border-0 text-xs ${MOVEMENT_COLORS[m.type] ?? "bg-gray-100 text-gray-700"}`}>
                        {MOVEMENT_LABELS[m.type] ?? m.type}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-semibold text-sm ${m.qty_change > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {m.qty_change > 0 ? "+" : ""}{m.qty_change}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {m.created_by_user.name.split(" ")[0]}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                      {fmtDateTime(m.created_at)}
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
