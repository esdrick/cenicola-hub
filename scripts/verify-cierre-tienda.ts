/**
 * Verificación de funcionamiento de Cierre de Tienda. Ejercita la elegibilidad de
 * órdenes, el cálculo de rangos de fecha y el flujo completo de creación (transacción +
 * exclusividad de órdenes entre cierres) contra la base de datos local de desarrollo,
 * creando y limpiando sus propios datos.
 *
 * Uso: npx tsx --env-file=.env --env-file=.env.local scripts/verify-cierre-tienda.ts
 */
import { prisma } from "../lib/prisma";
import {
  calcularRangoFechas,
  cierreEligibleWhere,
  cierreOrderInclude,
  buildCierreRows,
  buildResumen,
} from "../lib/cierre-tienda";

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string): void {
  if (!condition) {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  } else {
    passed++;
    console.log(`  ✓ ${message}`);
  }
}

const createdOrderIds: string[] = [];
const createdVariantIds: string[] = [];
const createdProductIds: string[] = [];
const createdCierreIds: string[] = [];

async function makeVariant(prefix: string, userId: string) {
  const product = await prisma.product.create({
    data: { name: `[TEST] ${prefix}`, type: "camisa", created_by: userId },
  });
  createdProductIds.push(product.id);

  const variant = await prisma.productVariant.create({
    data: {
      product_id: product.id,
      size: "M",
      sku: `TEST-CIERRE-${prefix}-${Date.now()}`,
      price_bcv: 10,
      price_bundle_bcv: 9,
      price_mayor_bcv: 8,
      price_divisas: 12,
      price_bundle_divisas: 11,
      price_mayor_divisas: 10,
    },
  });
  createdVariantIds.push(variant.id);
  return variant;
}

async function makePaidOrder(opts: {
  userId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  pricingMethod: "bcv" | "divisas";
  paymentType: "efectivo_bs" | "zelle";
  pagoVerificadoAt: Date;
  status: "pago_verificado" | "en_embalaje" | "completada";
  channel?: "tienda" | "online";
}) {
  const totalUsd = opts.unitPrice * opts.quantity;
  const order = await prisma.order.create({
    data: {
      order_number: `TEST-CIERRE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      channel: opts.channel ?? "tienda",
      status: opts.status,
      customer_name: "Test",
      customer_lastname: "Cliente",
      customer_id_doc: "",
      total_usd: totalUsd,
      pricing_method: opts.pricingMethod,
      pago_verificado_at: opts.pagoVerificadoAt,
      created_by: opts.userId,
    },
  });
  createdOrderIds.push(order.id);

  await prisma.orderItem.create({
    data: {
      order_id: order.id,
      variant_id: opts.variantId,
      quantity: opts.quantity,
      unit_price_usd: opts.unitPrice,
      subtotal_usd: totalUsd,
      variant_snapshot: {},
    },
  });

  await prisma.orderPayment.create({
    data: {
      order_id: order.id,
      payment_type: opts.paymentType,
      amount_usd: totalUsd,
      is_partial: false,
      payment_date: new Date(),
      reference: opts.paymentType.startsWith("efectivo") ? "EFECTIVO" : `REF${Date.now()}`,
      status: "verificado",
    },
  });

  return order;
}

async function main() {
  const user = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!user) throw new Error("No hay ningún usuario admin en la base de datos local para correr esta verificación");

  console.log("\n1) calcularRangoFechas");
  {
    const ref = new Date(2026, 6, 11); // 11 jul 2026, sábado
    const dia = calcularRangoFechas("diario", ref);
    assert(dia.fechaInicio.getDate() === 11 && dia.fechaFin.getDate() === 11, "diario: mismo día, límites 00:00–23:59");
    assert(dia.fechaInicio.getHours() === 0 && dia.fechaFin.getHours() === 23, "diario: horas de inicio/fin correctas");

    const semana = calcularRangoFechas("semanal", ref);
    assert(semana.fechaInicio.getDay() === 1, "semanal: inicia en lunes");
    assert(semana.fechaFin.getDay() === 0, "semanal: termina en domingo");
    assert(semana.fechaInicio.getDate() === 6 && semana.fechaFin.getDate() === 12, "semanal: 6–12 jul 2026 para ref 11 jul (sábado)");

    const quincena1 = calcularRangoFechas("quincenal", new Date(2026, 6, 10));
    assert(quincena1.fechaInicio.getDate() === 1 && quincena1.fechaFin.getDate() === 15, "quincenal: día 10 cae en la primera mitad (1–15)");

    const quincena2 = calcularRangoFechas("quincenal", new Date(2026, 6, 20));
    assert(quincena2.fechaInicio.getDate() === 16 && quincena2.fechaFin.getDate() === 31, "quincenal: día 20 cae en la segunda mitad (16–31, julio tiene 31 días)");

    const mes = calcularRangoFechas("mensual", ref);
    assert(mes.fechaInicio.getDate() === 1 && mes.fechaFin.getDate() === 31, "mensual: 1–31 jul 2026");

    const mesOffset = calcularRangoFechas("mensual", ref, -1);
    assert(mesOffset.fechaInicio.getMonth() === 5, "mensual offset=-1: retrocede a junio");

    const febBisiesto = calcularRangoFechas("mensual", new Date(2028, 1, 10));
    assert(febBisiesto.fechaFin.getDate() === 29, "mensual: respeta año bisiesto (feb 2028 = 29 días)");
  }

  console.log("\n2) Elegibilidad + construcción de filas");
  const variant = await makeVariant("A", user.id);
  const now = new Date();
  const rango = { fechaInicio: new Date(now.getTime() - 60_000), fechaFin: new Date(now.getTime() + 60_000) };

  const ordenSimpleBcv = await makePaidOrder({
    userId: user.id, variantId: variant.id, quantity: 3, unitPrice: 10,
    pricingMethod: "bcv", paymentType: "efectivo_bs", pagoVerificadoAt: now, status: "completada",
  });

  const ordenCancelada = await prisma.order.create({
    data: {
      order_number: `TEST-CIERRE-CANC-${Date.now()}`,
      channel: "tienda", status: "cancelada",
      customer_name: "Test", customer_lastname: "Cancelada", customer_id_doc: "",
      total_usd: 5, pago_verificado_at: now, created_by: user.id,
    },
  });
  createdOrderIds.push(ordenCancelada.id);

  const ordenFueraDeRango = await makePaidOrder({
    userId: user.id, variantId: variant.id, quantity: 1, unitPrice: 10,
    pricingMethod: "bcv", paymentType: "efectivo_bs",
    pagoVerificadoAt: new Date(now.getTime() - 3 * 86_400_000), status: "completada",
  });

  {
    const orders = await prisma.order.findMany({
      where: cierreEligibleWhere(rango.fechaInicio, rango.fechaFin),
      include: cierreOrderInclude,
    });
    const ids = orders.map((o) => o.id);
    assert(ids.includes(ordenSimpleBcv.id), "la orden completada con pago dentro del rango es elegible");
    assert(!ids.includes(ordenCancelada.id), "una orden cancelada NUNCA es elegible aunque tenga pago_verificado_at en rango");
    assert(!ids.includes(ordenFueraDeRango.id), "una orden con pago_verificado_at fuera del rango no es elegible");

    const rows = buildCierreRows(orders.filter((o) => o.id === ordenSimpleBcv.id));
    assert(rows.length === 1, "buildCierreRows produce una fila por orden elegible");
    assert(rows[0].cantidadPiezas === 3, "cantidadPiezas suma las cantidades de OrderItem");
    assert(rows[0].monto === 30, "monto = total_usd de la orden");
    assert(rows[0].moneda === "BCV", "moneda se deriva de los pagos activos (bcv)");
    assert(rows[0].metodoPago === "Efectivo BS", "metodoPago usa PAYMENT_TYPE_LABELS");

    const resumen = buildResumen(rows);
    assert(resumen.totalPiezas === 3, "buildResumen suma piezas de todas las filas");
    assert(resumen.resumenTotales.length === 1 && resumen.resumenTotales[0].monto === 30, "resumenTotales agrupa por (moneda, metodoPago)");
  }

  console.log("\n3) Pago mixto (moneda/método MIXTO)");
  const ordenMixta = await prisma.order.create({
    data: {
      order_number: `TEST-CIERRE-MIX-${Date.now()}`,
      channel: "tienda", status: "completada",
      customer_name: "Test", customer_lastname: "Mixto", customer_id_doc: "",
      total_usd: 20, pricing_method: null, pago_verificado_at: now, created_by: user.id,
    },
  });
  createdOrderIds.push(ordenMixta.id);
  await prisma.orderItem.create({
    data: { order_id: ordenMixta.id, variant_id: variant.id, quantity: 2, unit_price_usd: 10, subtotal_usd: 20, variant_snapshot: {} },
  });
  await prisma.orderPayment.create({
    data: { order_id: ordenMixta.id, payment_type: "efectivo_bs", amount_usd: 10, is_partial: false, payment_date: new Date(), reference: "EFECTIVO", status: "verificado" },
  });
  await prisma.orderPayment.create({
    data: { order_id: ordenMixta.id, payment_type: "zelle", amount_usd: 10, is_partial: false, payment_date: new Date(), reference: `REFZ${Date.now()}`, status: "verificado" },
  });
  {
    const orders = await prisma.order.findMany({ where: { id: ordenMixta.id }, include: cierreOrderInclude });
    const rows = buildCierreRows(orders);
    assert(rows[0].moneda === "MIXTO", "orden con pagos bcv y divisas se marca como moneda MIXTO");
    assert(rows[0].metodoPago === "Mixto", "orden con 2 payment_type distintos se marca como método Mixto");
  }

  console.log("\n4) Exclusividad: crear un cierre real y verificar que la orden no vuelve a aparecer");
  {
    const ordersBefore = await prisma.order.findMany({
      where: cierreEligibleWhere(rango.fechaInicio, rango.fechaFin),
      include: cierreOrderInclude,
    });
    const rows = buildCierreRows(ordersBefore);
    const { totalPiezas, resumenTotales } = buildResumen(rows);

    const cierre = await prisma.$transaction(async (tx) => {
      const created = await tx.cierreTienda.create({
        data: {
          tipo: "diario",
          fecha_inicio: rango.fechaInicio,
          fecha_fin: rango.fechaFin,
          generado_por_id: user.id,
          total_piezas: totalPiezas,
          resumen_totales: resumenTotales,
          detalles: {
            create: rows.map((r) => ({
              order_id: r.orderId, numero_orden: r.numeroOrden, cliente_nombre: r.clienteNombre,
              fecha_confirmacion: r.fechaConfirmacion, cantidad_piezas: r.cantidadPiezas,
              monto: r.monto, moneda: r.moneda, metodo_pago: r.metodoPago, referencia_pago: r.referencia,
            })),
          },
        },
        include: { detalles: true },
      });
      await tx.order.updateMany({ where: { id: { in: rows.map((r) => r.orderId) } }, data: { incluido_en_cierre_id: created.id } });
      return created;
    });
    createdCierreIds.push(cierre.id);

    assert(cierre.detalles.length === rows.length, "el cierre guarda un CierreTiendaDetalle por cada orden elegible");

    const includedOrder = await prisma.order.findUnique({ where: { id: ordenSimpleBcv.id } });
    assert(includedOrder?.incluido_en_cierre_id === cierre.id, "la orden queda marcada con incluido_en_cierre_id");

    const ordersAfter = await prisma.order.findMany({
      where: cierreEligibleWhere(rango.fechaInicio, rango.fechaFin),
      include: cierreOrderInclude,
    });
    assert(
      !ordersAfter.some((o) => o.id === ordenSimpleBcv.id),
      "una vez incluida en un cierre, la orden deja de ser elegible para un segundo cierre"
    );

    // Editar la orden original después del cierre no debe afectar el snapshot guardado
    await prisma.order.update({ where: { id: ordenSimpleBcv.id }, data: { customer_name: "Editado" } });
    const detalleGuardado = await prisma.cierreTiendaDetalle.findFirst({ where: { order_id: ordenSimpleBcv.id } });
    assert(detalleGuardado?.cliente_nombre === "Test Cliente", "editar la orden después del cierre no muta el CierreTiendaDetalle ya guardado");
  }

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
}

async function cleanup() {
  await prisma.cierreTiendaDetalle.deleteMany({ where: { cierre_id: { in: createdCierreIds } } });
  await prisma.order.updateMany({ where: { id: { in: createdOrderIds } }, data: { incluido_en_cierre_id: null } });
  await prisma.cierreTienda.deleteMany({ where: { id: { in: createdCierreIds } } });
  await prisma.orderPayment.deleteMany({ where: { order_id: { in: createdOrderIds } } });
  await prisma.orderItem.deleteMany({ where: { order_id: { in: createdOrderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  await prisma.productVariant.deleteMany({ where: { id: { in: createdVariantIds } } });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
}

main()
  .catch((err) => {
    failed++;
    console.error("Error inesperado:", err);
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
  });
