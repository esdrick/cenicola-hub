import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find all pago_parcial orders that have no AccountReceivable
  const orders = await prisma.order.findMany({
    where: {
      status: "pago_parcial",
      receivables: { none: {} },
    },
    include: {
      payments: {
        where: { status: { not: "rechazado" } },
        select: { amount_usd: true },
      },
    },
  });

  if (orders.length === 0) {
    console.log("No hay órdenes con pago_parcial sin cuenta por cobrar.");
    return;
  }

  console.log(`Encontradas ${orders.length} órdenes sin cuenta por cobrar:\n`);

  for (const order of orders) {
    const totalUsd = Number(order.total_usd);
    const totalPaid = order.payments.reduce((s, p) => s + Number(p.amount_usd), 0);
    const debtUsd = parseFloat((totalUsd - totalPaid).toFixed(2));

    if (debtUsd <= 0) {
      console.log(`  ${order.order_number}: saldo = $0, se omite.`);
      continue;
    }

    await prisma.accountReceivable.create({
      data: {
        description: `Saldo pendiente - Orden ${order.order_number}`,
        debtor_name: `${order.customer_name} ${order.customer_lastname}`,
        amount_usd: debtUsd,
        amount_paid_usd: 0,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: "pendiente",
        order_id: order.id,
        created_by: order.created_by,
      },
    });

    console.log(
      `  ${order.order_number} — ${order.customer_name} ${order.customer_lastname}: deuda $${debtUsd.toFixed(2)}`
    );
  }

  console.log("\nBackfill completado.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
