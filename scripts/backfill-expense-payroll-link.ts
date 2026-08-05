/**
 * Backfill de un solo uso: vincula los gastos de categoría "nomina" ya existentes
 * con su PayrollRecord correspondiente (Expense.payroll_record_id), reconstruyendo
 * la descripción exacta que genera app/api/finanzas/nominas/[userId]/pagar/route.ts
 * ("Nómina {rango} — {vendedora}") para encontrar el match. Sin este backfill, esos
 * gastos antiguos seguirían siendo borrables desde Gastos aunque su pago siga existiendo.
 *
 * Uso: npx tsx --env-file=.env --env-file=.env.local scripts/backfill-expense-payroll-link.ts
 */
import { prisma } from "../lib/prisma";
import { formatRangoLabel } from "../lib/payroll-periods";

async function main() {
  const pagadas = await prisma.payrollRecord.findMany({
    where: { status: "pagada" },
    include: { user: { select: { name: true } } },
    orderBy: { paid_at: "asc" },
  });

  console.log(`PayrollRecords pagados: ${pagadas.length}\n`);

  let vinculados = 0;
  for (const record of pagadas) {
    const desde = record.periodo_inicio.toISOString().slice(0, 10);
    const hasta = record.periodo_fin.toISOString().slice(0, 10);
    const rangoLabel = formatRangoLabel(desde, hasta);
    const description = `Nómina ${rangoLabel} — ${record.user.name}`;

    const match = await prisma.expense.findFirst({
      where: { category: "nomina", description, payroll_record_id: null },
    });

    if (match) {
      await prisma.expense.update({ where: { id: match.id }, data: { payroll_record_id: record.id } });
      vinculados++;
      console.log(`✓ vinculado: "${description}" ($${Number(match.amount_usd).toFixed(2)})`);
    } else {
      console.log(`  sin match: "${description}" (comisión $${Number(record.comision).toFixed(2)} — puede ser $0, no genera gasto)`);
    }
  }

  const sinVincular = await prisma.expense.count({ where: { category: "nomina", payroll_record_id: null } });
  console.log(`\nVinculados: ${vinculados}/${pagadas.length}`);
  console.log(`Gastos "nomina" sin vincular tras el backfill: ${sinVincular} (revisar a mano si es > 0)`);
}

main()
  .catch((err) => {
    console.error("Error inesperado:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
