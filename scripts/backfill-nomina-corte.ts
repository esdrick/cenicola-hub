/**
 * Backfill de un solo uso: vincula las órdenes de cada PayrollRecord ya pagado
 * (incluido_en_nomina_id) para que el corte real de nómina no las vuelva a contar.
 * Sin este backfill, las ventas ya liquidadas antes de este cambio aparecerían como
 * "pendientes" de nuevo y se pagaría su comisión dos veces.
 *
 * Uso: npx tsx --env-file=.env --env-file=.env.local scripts/backfill-nomina-corte.ts
 */
import { prisma } from "../lib/prisma";
import { nominaEligibleWhere } from "../lib/payroll-periods";

async function main() {
  const pagadas = await prisma.payrollRecord.findMany({
    where: { status: "pagada" },
    orderBy: { paid_at: "asc" },
  });

  console.log(`Registros pagados encontrados: ${pagadas.length}\n`);

  for (const record of pagadas) {
    // periodo_inicio/periodo_fin se guardaron como medianoche UTC del día
    // desde/hasta original — se reconstruyen los mismos límites de día local
    // que usó la página al mostrar el período (ver rangoADateTime).
    const inicio = new Date(
      record.periodo_inicio.getUTCFullYear(),
      record.periodo_inicio.getUTCMonth(),
      record.periodo_inicio.getUTCDate(),
    );
    const fin = new Date(
      record.periodo_fin.getUTCFullYear(),
      record.periodo_fin.getUTCMonth(),
      record.periodo_fin.getUTCDate(),
      23, 59, 59, 999,
    );

    const ordenes = await prisma.order.findMany({
      where: nominaEligibleWhere(inicio, fin, record.userId),
      select: { id: true, total_usd: true },
    });

    const suma = ordenes.reduce((s, o) => s + Number(o.total_usd), 0);

    console.log(
      `PayrollRecord ${record.id} (userId ${record.userId}, ` +
      `${record.periodo_inicio.toISOString().slice(0, 10)} – ${record.periodo_fin.toISOString().slice(0, 10)}, ` +
      `paid_at ${record.paid_at?.toISOString() ?? "?"})`
    );
    console.log(`  total_ventas guardado: $${Number(record.total_ventas).toFixed(2)}`);
    console.log(`  órdenes a vincular ahora: ${ordenes.length} — suma: $${suma.toFixed(2)}`);

    if (ordenes.length > 0) {
      await prisma.order.updateMany({
        where: { id: { in: ordenes.map((o) => o.id) } },
        data: { incluido_en_nomina_id: record.id },
      });
    }
    console.log("");
  }

  console.log("Backfill completado.");
}

main()
  .catch((err) => {
    console.error("Error inesperado:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
