import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Layers, DollarSign, AlertTriangle } from "lucide-react";

type Props = {
  lowStockThreshold: number;
  showValue: boolean;
};

export async function InventarioStats({ lowStockThreshold, showValue }: Props) {
  const [totalProductos, stockAgg, stockBajoCount] = await Promise.all([
    prisma.product.count({ where: { is_active: true } }),
    prisma.productVariant.findMany({
      where: { is_active: true },
      select: { stock_total: true, price_bcv: true },
    }),
    prisma.productVariant.count({
      where: { is_active: true, stock_total: { lt: lowStockThreshold } },
    }),
  ]);

  const totalUnidades = stockAgg.reduce((sum, v) => sum + v.stock_total, 0);

  const CARDS = [
    {
      label: "Productos activos",
      value: String(totalProductos),
      desc: `${stockAgg.length} variante${stockAgg.length !== 1 ? "s" : ""}`,
      icon: Package,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Unidades en stock",
      value: totalUnidades.toLocaleString("es-VE"),
      desc: "Suma de todas las variantes",
      icon: Layers,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    ...(showValue
      ? [
          {
            label: "Valor de inventario",
            value: `$${stockAgg
              .reduce((sum, v) => sum + v.stock_total * Number(v.price_bcv), 0)
              .toFixed(2)}`,
            desc: "A precio de venta BCV",
            icon: DollarSign,
            color: "text-indigo-600",
            bg: "bg-indigo-50",
          },
        ]
      : []),
    {
      label: "Stock bajo",
      value: String(stockBajoCount),
      desc: `Menos de ${lowStockThreshold} unidades`,
      icon: AlertTriangle,
      color: stockBajoCount > 0 ? "text-amber-600" : "text-gray-400",
      bg: stockBajoCount > 0 ? "bg-amber-50" : "bg-gray-50",
    },
  ];

  return (
    <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${showValue ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
      {CARDS.map((c) => (
        <Card key={c.label}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-xs font-medium text-gray-600 sm:text-sm">{c.label}</CardTitle>
            <div className={`flex-shrink-0 rounded-lg p-1.5 sm:p-2 ${c.bg}`}>
              <c.icon size={16} className={c.color} />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 sm:text-3xl">{c.value}</p>
            <p className="mt-0.5 text-xs text-gray-500">{c.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
