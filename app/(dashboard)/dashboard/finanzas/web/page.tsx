export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  rangoMes,
  rangoPorTipo,
  rangoADateTime,
} from "@/lib/payroll-periods";
import { getVenezuelaDateString } from "@/lib/date-utils";
import {
  buildOrderChannelWhere,
  isWebStorePickup,
  getPaymentTypeLabel,
} from "@/lib/order-utils";
import {
  VentasWebClient,
  type WebPeriodPreset,
  type WebOrderRecord,
  type WebPrevStats,
  type WebCompanyStats,
} from "@/components/shared/finanzas/VentasWebClient";

type SP = { [key: string]: string | string[] | undefined };
function s(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}

const VALID_PRESETS: WebPeriodPreset[] = [
  "dia",
  "semana",
  "quincena",
  "mes",
  "personalizado",
];

export default async function VentasWebPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const now = new Date();
  const tipoParam = s(searchParams.tipo);
  const tipo: WebPeriodPreset = VALID_PRESETS.includes(
    tipoParam as WebPeriodPreset
  )
    ? (tipoParam as WebPeriodPreset)
    : "mes";

  const desdeParam = s(searchParams.desde);
  const hastaParam = s(searchParams.hasta);

  let desde: string;
  let hasta: string;
  if (desdeParam && hastaParam) {
    desde = desdeParam;
    hasta = hastaParam;
  } else {
    const r =
      tipo === "personalizado" ? rangoMes(now) : rangoPorTipo(tipo, now);
    desde = r.desde;
    hasta = r.hasta;
  }

  const todayStr = getVenezuelaDateString();
  if (hasta > todayStr) hasta = todayStr;
  if (desde > todayStr) desde = todayStr;

  const { inicio, fin } = rangoADateTime(desde, hasta);

  // Período anterior equivalente para comparación de crecimiento
  const durationMs = Math.max(86_400_000, fin.getTime() - inicio.getTime() + 1);
  const prevFin = new Date(inicio.getTime() - 1);
  const prevInicio = new Date(prevFin.getTime() - durationMs + 1);

  const webWhere = buildOrderChannelWhere("web");

  const [webOrdersRaw, prevWebOrdersRaw, companyOrdersRaw] = await Promise.all([
    prisma.order.findMany({
      where: {
        ...webWhere,
        created_at: { gte: inicio, lte: fin },
      },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        order_number: true,
        channel: true,
        status: true,
        customer_id: true,
        customer_account_id: true,
        customer_name: true,
        customer_lastname: true,
        customer_id_doc: true,
        address: true,
        shipping_company: true,
        total_usd: true,
        notes: true,
        created_by: true,
        created_at: true,
        items: {
          select: {
            id: true,
            quantity: true,
            unit_price_usd: true,
            subtotal_usd: true,
            variant_snapshot: true,
            variant: {
              select: {
                id: true,
                size: true,
                sku: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    color: true,
                    photos: true,
                  },
                },
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            payment_type: true,
            amount_usd: true,
            status: true,
            reference: true,
          },
        },
      },
    }),
    prisma.order.findMany({
      where: {
        ...webWhere,
        status: { in: ["enviada", "completada"] },
        created_at: { gte: prevInicio, lte: prevFin },
      },
      select: {
        status: true,
        total_usd: true,
        items: { select: { quantity: true } },
      },
    }),
    prisma.order.findMany({
      where: {
        status: { in: ["enviada", "completada"] },
        created_at: { gte: inicio, lte: fin },
      },
      select: {
        status: true,
        total_usd: true,
        items: { select: { quantity: true } },
      },
    }),
  ]);

  type VariantSnapshot = {
    product_name?: string;
    product_type?: string;
    size?: string;
    sku?: string;
  };

  const ordenes: WebOrderRecord[] = webOrdersRaw.map((o) => {
    const dateStr = getVenezuelaDateString(o.created_at);
    const [yy, mm, dd] = dateStr.split("-").map(Number);
    const dayOfWeek = new Date(yy, mm - 1, dd).getDay();

    const items = o.items.map((item) => {
      const snap = item.variant_snapshot as VariantSnapshot | null;
      const prod = item.variant?.product;
      return {
        id: item.id,
        product_id: prod?.id ?? "unknown",
        product_name:
          prod?.name ?? snap?.product_name ?? "Producto no especificado",
        product_type: prod?.type ?? snap?.product_type ?? "General",
        product_color: prod?.color ?? null,
        photo: prod?.photos?.[0] ?? null,
        size: item.variant?.size ?? snap?.size ?? "Única",
        sku: item.variant?.sku ?? snap?.sku ?? "—",
        quantity: item.quantity,
        unit_price_usd: Number(item.unit_price_usd),
        subtotal_usd: Number(item.subtotal_usd),
      };
    });

    const productos_count = items.reduce((s, i) => s + i.quantity, 0);

    const payments = o.payments.map((p) => ({
      id: p.id,
      payment_type: p.payment_type as string,
      payment_label: getPaymentTypeLabel({
        payment_type: p.payment_type as string,
        notes: o.notes,
        reference: p.reference,
      }),
      amount_usd: Number(p.amount_usd),
      status: p.status as string,
      reference: p.reference,
    }));

    const docKey = (o.customer_id_doc || "").trim().toUpperCase();
    const nameKey = `${o.customer_name} ${o.customer_lastname}`
      .trim()
      .toLowerCase();
    const customer_key =
      o.customer_account_id ||
      o.customer_id ||
      (docKey && docKey !== "S/D" ? `doc:${docKey}` : `name:${nameKey}`);

    return {
      id: o.id,
      order_number: o.order_number,
      status: o.status as string,
      created_at: o.created_at.toISOString(),
      dateStr,
      dayOfWeek,
      customer_name: o.customer_name,
      customer_lastname: o.customer_lastname,
      customer_id_doc: o.customer_id_doc,
      customer_key,
      address: o.address,
      shipping_company: o.shipping_company,
      isPickup: isWebStorePickup(o),
      total_usd: Number(o.total_usd),
      productos_count,
      items,
      payments,
    };
  });

  // Estadísticas del período anterior
  const prevStats: WebPrevStats = {
    ordenes_count: prevWebOrdersRaw.length,
    productos_vendidos: prevWebOrdersRaw.reduce(
      (s, o) => s + o.items.reduce((acc, i) => acc + i.quantity, 0),
      0
    ),
    total_ventas: prevWebOrdersRaw.reduce(
      (s, o) => s + Number(o.total_usd),
      0
    ),
    completadas_count: prevWebOrdersRaw.filter(
      (o) => o.status === "completada"
    ).length,
    completadas_productos: prevWebOrdersRaw
      .filter((o) => o.status === "completada")
      .reduce((s, o) => s + o.items.reduce((acc, i) => acc + i.quantity, 0), 0),
    completadas_ventas: prevWebOrdersRaw
      .filter((o) => o.status === "completada")
      .reduce((s, o) => s + Number(o.total_usd), 0),
  };

  // Estadísticas globales de la empresa en el mismo período (para participación % del canal Web)
  const companyStats: WebCompanyStats = {
    total_ordenes_confirmadas: companyOrdersRaw.length,
    total_ventas_confirmadas: companyOrdersRaw.reduce(
      (s, o) => s + Number(o.total_usd),
      0
    ),
    total_productos_confirmados: companyOrdersRaw.reduce(
      (s, o) => s + o.items.reduce((acc, i) => acc + i.quantity, 0),
      0
    ),
    total_ordenes_completadas: companyOrdersRaw.filter(
      (o) => o.status === "completada"
    ).length,
    total_ventas_completadas: companyOrdersRaw
      .filter((o) => o.status === "completada")
      .reduce((s, o) => s + Number(o.total_usd), 0),
    total_productos_completados: companyOrdersRaw
      .filter((o) => o.status === "completada")
      .reduce((s, o) => s + o.items.reduce((acc, i) => acc + i.quantity, 0), 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/finanzas"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 w-fit"
        >
          <ArrowLeft size={15} />
          Volver a Finanzas
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ventas Web</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Órdenes, productos y facturación del canal web
        </p>
      </div>

      <VentasWebClient
        ordenes={ordenes}
        prevStats={prevStats}
        companyStats={companyStats}
        tipo={tipo}
        desde={desde}
        hasta={hasta}
      />
    </div>
  );
}
