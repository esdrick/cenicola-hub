import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, withRole, getClientIp } from "@/lib/api-auth";
import { generateSku } from "@/lib/sku";

type Ctx = { params: { id: string } };

// GET /api/products/[id]
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      variants: { orderBy: { size: "asc" } },
      creator: { select: { id: true, name: true } },
    },
  });

  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

  return NextResponse.json({
    ...product,
    created_at: product.created_at.toISOString(),
    updated_at: product.updated_at.toISOString(),
    variants: product.variants.map((v) => ({
      ...v,
      price_bcv: Number(v.price_bcv),
      price_divisas: Number(v.price_divisas),
      price_bundle_bcv: Number(v.price_bundle_bcv),
      price_bundle_divisas: Number(v.price_bundle_divisas),
      price_mayor_bcv: Number(v.price_mayor_bcv),
      price_mayor_divisas: Number(v.price_mayor_divisas),
      updated_at: v.updated_at.toISOString(),
    })),
  });
}

// PUT /api/products/[id]
export async function PUT(request: NextRequest, { params }: Ctx) {
  const auth = await withRole(["admin", "inventario"]);
  if (!auth.ok) return auth.response;

  const existing = await prisma.product.findUnique({
    where: { id: params.id },
    include: { variants: true },
  });
  if (!existing) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { name, type, color, description, photos, price_bcv, price_divisas, price_bundle_bcv, price_bundle_divisas, price_mayor_bcv, price_mayor_divisas, variants } = body;
  const ip = getClientIp(request);

  const dataBefore = { name: existing.name, type: existing.type, color: existing.color };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: params.id },
        data: {
          name: name?.trim() || existing.name,
          type: type?.trim() || existing.type,
          color: color?.trim() || null,
          description: description?.trim() || null,
          photos: Array.isArray(photos) ? photos.filter(Boolean) : existing.photos,
        },
      });

      if (Array.isArray(variants)) {
        const pBcv       = price_bcv           != null ? parseFloat(Number(price_bcv).toFixed(2))           : null;
        const pDivisas   = price_divisas       != null ? parseFloat(Number(price_divisas).toFixed(2))       : null;
        const pBundleBcv = price_bundle_bcv    != null ? parseFloat(Number(price_bundle_bcv).toFixed(2))    : null;
        const pBundleDiv = price_bundle_divisas != null ? parseFloat(Number(price_bundle_divisas).toFixed(2)) : null;
        const pMayorBcv  = price_mayor_bcv     != null ? parseFloat(Number(price_mayor_bcv).toFixed(2))     : null;
        const pMayorDiv  = price_mayor_divisas != null ? parseFloat(Number(price_mayor_divisas).toFixed(2)) : null;

        for (const v of variants) {
          if (v.id) {
            // Update existing variant
            const ev = existing.variants.find((x) => x.id === v.id);
            if (!ev) continue;

            const stockOnline = Math.max(0, Math.floor(Number(v.stock_online) ?? ev.stock_online));
            const stockStore = Math.max(0, Math.floor(Number(v.stock_store) ?? ev.stock_store));
            const stockTotal = stockOnline + stockStore;
            const isActive = v.is_active ?? ev.is_active;

            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                size: v.size?.trim() || ev.size,
                stock_online: stockOnline,
                stock_store: stockStore,
                stock_total: stockTotal,
                price_bcv:            pBcv       ?? Number(ev.price_bcv),
                price_divisas:        pDivisas   ?? Number(ev.price_divisas),
                price_bundle_bcv:     pBundleBcv ?? Number(ev.price_bundle_bcv),
                price_bundle_divisas: pBundleDiv ?? Number(ev.price_bundle_divisas),
                price_mayor_bcv:      pMayorBcv  ?? Number(ev.price_mayor_bcv),
                price_mayor_divisas:  pMayorDiv  ?? Number(ev.price_mayor_divisas),
                is_active: isActive,
              },
            });

            const totalChange = stockTotal - ev.stock_total;
            if (totalChange !== 0) {
              await tx.inventoryMovement.create({
                data: {
                  variant_id: v.id,
                  type: "ajuste",
                  channel: "total",
                  qty_before: ev.stock_total,
                  qty_change: totalChange,
                  qty_after: stockTotal,
                  reason: "Ajuste al editar producto",
                  created_by: auth.session.id,
                },
              });
            }
          } else {
            // New variant
            const size = v.size?.trim();
            if (!size) continue;
            const stockOnline = Math.max(0, Math.floor(Number(v.stock_online) || 0));
            const stockStore = Math.max(0, Math.floor(Number(v.stock_store) || 0));
            const stockTotal = stockOnline + stockStore;

            const newVariant = await tx.productVariant.create({
              data: {
                product_id: params.id,
                size,
                sku: generateSku(existing.name, size),
                stock_online: stockOnline,
                stock_store: stockStore,
                stock_total: stockTotal,
                price_bcv:            pBcv       ?? Number(existing.variants[0]?.price_bcv ?? 0),
                price_divisas:        pDivisas   ?? Number(existing.variants[0]?.price_divisas ?? 0),
                price_bundle_bcv:     pBundleBcv ?? Number(existing.variants[0]?.price_bundle_bcv ?? 0),
                price_bundle_divisas: pBundleDiv ?? Number(existing.variants[0]?.price_bundle_divisas ?? 0),
                price_mayor_bcv:      pMayorBcv  ?? Number(existing.variants[0]?.price_mayor_bcv ?? 0),
                price_mayor_divisas:  pMayorDiv  ?? Number(existing.variants[0]?.price_mayor_divisas ?? 0),
              },
            });

            if (stockTotal > 0) {
              await tx.inventoryMovement.create({
                data: {
                  variant_id: newVariant.id,
                  type: "entrada",
                  channel: "total",
                  qty_before: 0,
                  qty_change: stockTotal,
                  qty_after: stockTotal,
                  reason: "Nueva talla agregada",
                  created_by: auth.session.id,
                },
              });
            }
          }
        }
      }

      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "UPDATE",
          entity_type: "Product",
          entity_id: params.id,
          data_before: dataBefore,
          data_after: { name: name || existing.name, type: type || existing.type, color: color ?? null },
          ip_address: ip,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/products/[id]:", err);
    return NextResponse.json({ error: "Error al actualizar el producto" }, { status: 500 });
  }
}
