/**
 * Elimina definitivamente (hard delete) las órdenes listadas en ORDER_NUMBERS.
 *
 * Para cada orden encontrada:
 *   - si status !== "cancelada": por cada OrderItem devuelve la cantidad al stock
 *     (stock_online si channel=online, stock_store si channel=tienda), recalcula
 *     stock_total, y crea un InventoryMovement tipo "devolucion" — misma lógica que
 *     app/api/orders/[id]/cancel/route.ts.
 *   - si status === "cancelada": el stock ya fue devuelto por el endpoint de cancelar
 *     anteriormente, así que NO se vuelve a tocar (evita duplicar el stock).
 *   - borra OrderShipment (si existe), OrderPayment[], OrderItem[] y por último Order.
 *     Los InventoryMovement de la orden (los de venta originales y el de devolución
 *     recién creado) NO se borran: al borrar la orden, order_id se pone en NULL
 *     automáticamente (ON DELETE SET NULL), quedando el movimiento como rastro.
 *   - registra un AuditLog (action: "DELETE") con snapshot completo de la orden.
 *
 * Por defecto corre en modo DRY RUN (no escribe nada, solo imprime qué haría).
 * Pasa --apply para ejecutar de verdad.
 *
 * Uso (dev):        npx tsx --env-file=.env --env-file=.env.local scripts/delete-orders-restore-stock.ts [--apply]
 * Uso (producción):  DATABASE_URL=... DIRECT_URL=... npx tsx scripts/delete-orders-restore-stock.ts [--apply]
 */
import { prisma } from "../lib/prisma";

const ORDER_NUMBERS = [
  "ORD-20260711-0059",
  "ORD-20260701-0002",
  "ORD-20260706-0001",
  "ORD-20260705-0001",
  "ORD-20260701-0001",
  "ORD-20260630-0001",
  "ORD-20260627-0003",
  "ORD-20260627-0002",
  "ORD-20260627-0001",
];

const ATTRIBUTED_ADMIN_EMAIL = "admin@admin.cenicolas.com";

const APPLY = process.argv.includes("--apply");

async function main() {
  const orderNumbers = [...new Set(ORDER_NUMBERS)];

  const adminUser = await prisma.user.findFirst({ where: { email: ATTRIBUTED_ADMIN_EMAIL } });
  if (!adminUser) {
    throw new Error(
      `No se encontró el usuario "${ATTRIBUTED_ADMIN_EMAIL}" en esta base de datos. Ajusta ATTRIBUTED_ADMIN_EMAIL en el script.`
    );
  }

  console.log(`Modo: ${APPLY ? "APLICAR (escribe en la base de datos)" : "DRY RUN (no escribe nada)"}`);
  console.log(`Usuario atribuido: ${adminUser.name} <${adminUser.email}> (${adminUser.id})\n`);

  const orders = await prisma.order.findMany({
    where: { order_number: { in: orderNumbers } },
    include: {
      items: true,
      payments: { select: { id: true, status: true } },
      shipment: { select: { id: true } },
      receivables: { select: { id: true } },
    },
  });

  const found = new Set(orders.map((o) => o.order_number));
  const missing = orderNumbers.filter((n) => !found.has(n));
  if (missing.length > 0) {
    console.log(`No encontradas en esta base de datos (se omiten): ${missing.join(", ")}\n`);
  }

  let ok = 0;
  let failed = 0;

  for (const order of orders) {
    console.log(`--- ${order.order_number} (status=${order.status}, channel=${order.channel}, id=${order.id}) ---`);
    console.log(
      `  items=${order.items.length} payments=${order.payments.length} shipment=${order.shipment ? "sí" : "no"} receivables=${order.receivables.length}`
    );

    const needsStockReversal = order.status !== "cancelada";
    if (needsStockReversal) {
      for (const item of order.items) {
        console.log(`  devolver stock: variant ${item.variant_id} +${item.quantity} (canal ${order.channel})`);
      }
    } else {
      console.log(`  ya estaba cancelada -> el stock ya fue devuelto antes, no se vuelve a tocar`);
    }

    if (!APPLY) {
      ok++;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (needsStockReversal) {
          for (const item of order.items) {
            const variant = await tx.productVariant.findUnique({ where: { id: item.variant_id } });
            if (!variant) continue;

            const newOnline = order.channel === "online" ? variant.stock_online + item.quantity : variant.stock_online;
            const newStore = order.channel === "tienda" ? variant.stock_store + item.quantity : variant.stock_store;
            const newTotal = newOnline + newStore;

            await tx.productVariant.update({
              where: { id: item.variant_id },
              data: { stock_online: newOnline, stock_store: newStore, stock_total: newTotal },
            });

            const movChannel = order.channel === "online" ? "online" : "tienda";
            const qtyBefore = order.channel === "online" ? variant.stock_online : variant.stock_store;
            await tx.inventoryMovement.create({
              data: {
                variant_id: item.variant_id,
                type: "devolucion",
                channel: movChannel,
                qty_before: qtyBefore,
                qty_change: item.quantity,
                qty_after: qtyBefore + item.quantity,
                reason: `Eliminación definitiva de orden ${order.order_number}`,
                order_id: order.id,
                created_by: adminUser.id,
              },
            });
          }
        }

        await tx.auditLog.create({
          data: {
            user_id: adminUser.id,
            action: "DELETE",
            entity_type: "Order",
            entity_id: order.id,
            data_before: JSON.parse(JSON.stringify(order)),
            ip_address: null,
          },
        });

        if (order.shipment) {
          await tx.orderShipment.delete({ where: { order_id: order.id } });
        }
        await tx.orderPayment.deleteMany({ where: { order_id: order.id } });
        await tx.orderItem.deleteMany({ where: { order_id: order.id } });
        await tx.order.delete({ where: { id: order.id } });
      });

      console.log(`  ✓ eliminada`);
      ok++;
    } catch (err) {
      console.error(`  ✗ error:`, err);
      failed++;
    }
  }

  console.log(`\n${APPLY ? "Aplicado" : "Simulado"}: ${ok} ok, ${failed} error(es), ${missing.length} no encontrada(s)`);
}

main()
  .catch((err) => {
    console.error("Error inesperado:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
