/**
 * Backfill de Order.pago_verificado_at para órdenes que ya estaban pagadas antes de que
 * este campo existiera (Cierre de Tienda depende de él para filtrar por rango de fecha).
 *
 * Para cada orden con status pagado y pago_verificado_at NULL:
 *   - usa el MAX(verified_at) entre sus pagos activos (no rechazados) si alguno fue
 *     verificado manualmente
 *   - si ninguno tiene verified_at (venta en efectivo auto-verificada), usa order.updated_at
 *     como mejor aproximación disponible
 *
 * Es seguro correrlo más de una vez: solo toca órdenes con pago_verificado_at IS NULL.
 *
 * Uso (dev):        npx tsx --env-file=.env --env-file=.env.local scripts/backfill-pago-verificado-at.ts
 * Uso (producción):  DATABASE_URL=... DIRECT_URL=... npx tsx scripts/backfill-pago-verificado-at.ts
 */
import { prisma } from "../lib/prisma";

const ESTATUS_ELEGIBLES = ["pago_verificado", "en_embalaje", "enviada", "completada"] as const;

async function main() {
  const orders = await prisma.order.findMany({
    where: { status: { in: [...ESTATUS_ELEGIBLES] }, pago_verificado_at: null },
    select: {
      id: true,
      order_number: true,
      updated_at: true,
      payments: {
        where: { status: { not: "rechazado" } },
        select: { verified_at: true },
      },
    },
  });

  console.log(`${orders.length} orden(es) pagada(s) sin pago_verificado_at\n`);

  let fromVerifiedAt = 0;
  let fromUpdatedAt = 0;

  for (const order of orders) {
    const verifiedDates = order.payments
      .map((p) => p.verified_at)
      .filter((d): d is Date => d !== null);

    const backfillDate = verifiedDates.length > 0
      ? new Date(Math.max(...verifiedDates.map((d) => d.getTime())))
      : order.updated_at;

    if (verifiedDates.length > 0) fromVerifiedAt++;
    else fromUpdatedAt++;

    await prisma.order.update({
      where: { id: order.id },
      data: { pago_verificado_at: backfillDate },
    });

    console.log(`  ${order.order_number} → ${backfillDate.toISOString()} ${verifiedDates.length > 0 ? "(verified_at)" : "(updated_at, fallback)"}`);
  }

  console.log(`\n${orders.length} orden(es) actualizada(s): ${fromVerifiedAt} desde verified_at, ${fromUpdatedAt} desde updated_at (fallback)`);
}

main()
  .catch((err) => {
    console.error("Error inesperado:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
