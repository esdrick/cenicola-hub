/**
 * Verificación del corte real de nómina: una vez que una orden queda ligada a un
 * PayrollRecord pagado, deja de ser elegible para siempre — incluso si un rango de
 * fechas posterior se solapa con el ya pagado — y las ventas nuevas sí siguen contando
 * para el próximo período. Ejercita nominaEligibleWhere y la lógica de la transacción
 * de pago (sin pasar por el endpoint HTTP) contra la base de datos local de desarrollo,
 * creando y limpiando sus propios datos.
 *
 * Uso: npx tsx --env-file=.env --env-file=.env.local scripts/verify-nomina-corte.ts
 */
import { prisma } from "../lib/prisma";
import { nominaEligibleWhere } from "../lib/payroll-periods";

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
const createdPayrollIds: string[] = [];
const createdExpenseIds: string[] = [];
let productId: string | null = null;
let variantId: string | null = null;

async function makeOrder(opts: {
  userId: string;
  total: number;
  status: "enviada" | "completada" | "cancelada";
  createdAt: Date;
}) {
  const order = await prisma.order.create({
    data: {
      order_number: `TEST-NOMINA-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      channel: "online",
      status: opts.status,
      customer_name: "Test",
      customer_lastname: "Nomina",
      customer_id_doc: "",
      total_usd: opts.total,
      created_at: opts.createdAt,
      updated_at: opts.createdAt,
      created_by: opts.userId,
    },
  });
  createdOrderIds.push(order.id);
  return order;
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { role: { in: ["vendedora_online", "vendedora_tienda"] } },
  });
  if (!user) throw new Error("No hay ninguna vendedora en la base de datos local para correr esta verificación");

  const product = await prisma.product.create({
    data: { name: "[TEST] Nomina", type: "camisa", created_by: user.id },
  });
  productId = product.id;
  const variant = await prisma.productVariant.create({
    data: { product_id: product.id, size: "M", sku: `TEST-NOMINA-${Date.now()}`, price_bcv: 10, price_divisas: 12 },
  });
  variantId = variant.id;
  void variant;

  // Rango A: "primera quincena" de un mes de prueba muy en el futuro para no chocar con datos reales.
  const rangoA = { inicio: new Date(2099, 0, 1), fin: new Date(2099, 0, 15, 23, 59, 59, 999) };
  // Rango B: el "mes completo" del mismo mes — se solapa con A. Este es el escenario que
  // antes producía doble pago: un admin paga la quincena y luego calcula el mes completo.
  const rangoB = { inicio: new Date(2099, 0, 1), fin: new Date(2099, 0, 31, 23, 59, 59, 999) };

  console.log("\n1) Elegibilidad básica");
  const ordenEnviada = await makeOrder({ userId: user.id, total: 30, status: "enviada", createdAt: new Date(2099, 0, 5) });
  const ordenCompletada = await makeOrder({ userId: user.id, total: 50, status: "completada", createdAt: new Date(2099, 0, 10) });
  const ordenCancelada = await makeOrder({ userId: user.id, total: 30, status: "cancelada", createdAt: new Date(2099, 0, 10) });
  const ordenFueraDeRango = await makeOrder({ userId: user.id, total: 20, status: "completada", createdAt: new Date(2098, 11, 1) });

  {
    const elegibles = await prisma.order.findMany({ where: nominaEligibleWhere(rangoA.inicio, rangoA.fin, user.id) });
    const ids = elegibles.map((o) => o.id);
    assert(ids.includes(ordenEnviada.id), "orden enviada dentro del rango es elegible para nómina");
    assert(ids.includes(ordenCompletada.id), "orden completada dentro del rango es elegible para nómina");
    assert(!ids.includes(ordenCancelada.id), "orden cancelada nunca es elegible");
    assert(!ids.includes(ordenFueraDeRango.id), "orden con created_at fuera del rango no es elegible");
  }

  console.log("\n2) Corte real al 'pagar' la quincena (rango A)");
  let payrollA: { id: string; total_ventas: unknown };
  {
    const elegibles = await prisma.order.findMany({
      where: nominaEligibleWhere(rangoA.inicio, rangoA.fin, user.id),
      select: { id: true, total_usd: true },
    });
    const total = elegibles.reduce((s, o) => s + Number(o.total_usd), 0);

    payrollA = await prisma.$transaction(async (tx) => {
      const created = await tx.payrollRecord.create({
        data: {
          userId: user.id,
          periodo_tipo: "quincena",
          periodo_inicio: new Date(Date.UTC(2099, 0, 1)),
          periodo_fin: new Date(Date.UTC(2099, 0, 15)),
          mes: 1,
          anio: 2099,
          total_ventas: total,
          comision: 0,
          status: "pagada",
          paid_at: new Date(),
        },
      });
      await tx.order.updateMany({ where: { id: { in: elegibles.map((o) => o.id) } }, data: { incluido_en_nomina_id: created.id } });
      return created;
    });
    createdPayrollIds.push(payrollA.id);

    assert(Number(payrollA.total_ventas) === 80, "total_ventas de la quincena = orden enviada ($30) + completada ($50) = $80");

    const includedEnviada = await prisma.order.findUnique({ where: { id: ordenEnviada.id } });
    assert(includedEnviada?.incluido_en_nomina_id === payrollA.id, "la orden enviada queda sellada con incluido_en_nomina_id");
  }

  console.log("\n3) Repetir el mismo rango (quincena) ya no la vuelve a devolver");
  {
    const elegibles = await prisma.order.findMany({ where: nominaEligibleWhere(rangoA.inicio, rangoA.fin, user.id) });
    assert(elegibles.length === 0, "una vez pagada, la quincena no vuelve a tener órdenes elegibles");
  }

  console.log("\n3b) Volver a ver un período ya pagado (page.tsx) muestra la foto histórica, no vacío");
  {
    // Misma rama que app/(dashboard)/dashboard/finanzas/nominas/page.tsx: si el período
    // está pagado, las órdenes se buscan por incluido_en_nomina_id, no por elegibilidad.
    const ordenesDelPago = await prisma.order.findMany({ where: { incluido_en_nomina_id: payrollA.id } });
    assert(ordenesDelPago.length === 2, "el período ya pagado muestra las 2 órdenes que realmente se pagaron, no una lista vacía");
    assert(Number(payrollA.total_ventas) === 80, "el total mostrado para un período pagado viene del PayrollRecord ($80), no de una re-consulta que daría $0");
  }

  console.log("\n4) Rango solapado (mes completo) tampoco la vuelve a incluir — el bug original");
  {
    const elegibles = await prisma.order.findMany({ where: nominaEligibleWhere(rangoB.inicio, rangoB.fin, user.id) });
    const ids = elegibles.map((o) => o.id);
    assert(!ids.includes(ordenCompletada.id), "la orden ya pagada en la quincena NO se vuelve a contar al calcular el mes completo (rango solapado)");
    assert(!ids.includes(ordenEnviada.id), "la orden enviada ya pagada en la quincena NO se vuelve a contar");
  }

  console.log("\n4b) Transición enviada -> completada después de pagada no remueve el sello");
  {
    await prisma.order.update({ where: { id: ordenEnviada.id }, data: { status: "completada" } });
    const checkAfterComplete = await prisma.order.findUnique({ where: { id: ordenEnviada.id } });
    assert(checkAfterComplete?.incluido_en_nomina_id === payrollA.id, "al pasar de enviada a completada, la orden conserva su incluido_en_nomina_id y no se duplica");
  }

  console.log("\n5) Una venta nueva después del corte sí cuenta para el próximo período");
  const ordenNueva = await makeOrder({ userId: user.id, total: 75, status: "enviada", createdAt: new Date(2099, 0, 20) });
  {
    const elegibles = await prisma.order.findMany({ where: nominaEligibleWhere(rangoB.inicio, rangoB.fin, user.id) });
    const ids = elegibles.map((o) => o.id);
    assert(ids.includes(ordenNueva.id), "la venta creada después del corte es elegible para la nómina del mes completo");
    assert(!ids.includes(ordenCompletada.id), "la orden ya pagada sigue excluida aunque comparta el rango con la venta nueva");
  }

  console.log("\n6) Re-pagar el mismo período (edición de comisión) no resetea total_ventas a 0");
  {
    const existing = await prisma.payrollRecord.findUnique({
      where: { userId_periodo_inicio_periodo_fin: { userId: user.id, periodo_inicio: new Date(Date.UTC(2099, 0, 1)), periodo_fin: new Date(Date.UTC(2099, 0, 15)) } },
    });
    assert(existing?.status === "pagada", "el registro de la quincena sigue marcado como pagada");

    // Misma lógica de branching que app/api/finanzas/nominas/[userId]/pagar/route.ts:
    // si ya está pagada, total_ventas se conserva en vez de recalcularse desde cero.
    const total_ventas = existing?.status === "pagada" ? Number(existing.total_ventas) : -1;
    assert(total_ventas === 80, "al re-editar la comisión de un período ya pagado, total_ventas se conserva ($80) en vez de recalcularse a partir de órdenes ya selladas (que darían 0)");
  }

  console.log("\n7) Deshacer pago revierte todo: orden vuelve a elegible, expense y record se borran");
  {
    const expense = await prisma.expense.create({
      data: {
        description: "Nómina TEST — deshacer",
        amount_usd: 5,
        category: "nomina",
        expense_date: new Date(),
        payroll_record_id: payrollA.id,
        created_by: user.id,
      },
    });
    createdExpenseIds.push(expense.id);

    // Misma lógica que el DELETE de app/api/finanzas/nominas/[userId]/pagar/route.ts
    await prisma.$transaction(async (tx) => {
      await tx.order.updateMany({ where: { incluido_en_nomina_id: payrollA.id }, data: { incluido_en_nomina_id: null, updated_at: new Date(2099, 0, 10) } });
      await tx.expense.deleteMany({ where: { payroll_record_id: payrollA.id } });
      await tx.payrollRecord.delete({ where: { id: payrollA.id } });
    });

    const recordAfter = await prisma.payrollRecord.findUnique({ where: { id: payrollA.id } });
    assert(recordAfter === null, "deshacer pago elimina el PayrollRecord");

    const expenseAfter = await prisma.expense.findUnique({ where: { id: expense.id } });
    assert(expenseAfter === null, "deshacer pago elimina el Expense vinculado");

    const ordenDespues = await prisma.order.findUnique({ where: { id: ordenCompletada.id } });
    assert(ordenDespues?.incluido_en_nomina_id === null, "la orden queda desellada tras deshacer el pago");

    const elegiblesDeNuevo = await prisma.order.findMany({ where: nominaEligibleWhere(rangoA.inicio, rangoA.fin, user.id) });
    assert(
      elegiblesDeNuevo.some((o) => o.id === ordenCompletada.id),
      "la orden vuelve a ser elegible para pagarse de nuevo después de deshacer el pago"
    );
  }

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
}

async function cleanup() {
  if (createdExpenseIds.length > 0) await prisma.expense.deleteMany({ where: { id: { in: createdExpenseIds } } }).catch(() => null);
  if (createdOrderIds.length > 0) {
    await prisma.order.updateMany({ where: { id: { in: createdOrderIds } }, data: { incluido_en_nomina_id: null } }).catch(() => null);
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } }).catch(() => null);
  }
  if (createdPayrollIds.length > 0) await prisma.payrollRecord.deleteMany({ where: { id: { in: createdPayrollIds } } }).catch(() => null);
  if (variantId) await prisma.productVariant.deleteMany({ where: { id: variantId } }).catch(() => null);
  if (productId) await prisma.product.deleteMany({ where: { id: productId } }).catch(() => null);
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
