import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, withRole, getClientIp } from "@/lib/api-auth";
import { generateSku } from "@/lib/sku";
import { getSetting } from "@/lib/settings";
import { normalizeText } from "@/lib/text";

// GET /api/products?q=&tipo=&color=&page=1
export async function GET(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const tipo = sp.get("tipo")?.trim() ?? "";
  const color = sp.get("color")?.trim() ?? "";
  // vendedora_tienda is restricted to quick-sale products regardless of the query param
  const quickSale = sp.get("quick_sale") === "true" || auth.session.role === "vendedora_tienda";
  const channelParam = sp.get("channel");
  const channel = channelParam === "tienda" || channelParam === "online" ? channelParam : null;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const pageSize = 24;

  const where = {
    is_active: true,
    ...(tipo && { type: { contains: tipo, mode: "insensitive" as const } }),
    ...(color && { color: { contains: color, mode: "insensitive" as const } }),
    ...(quickSale && { quick_sale: true }),
  };

  // Name search is matched accent/case-insensitively in JS since Postgres
  // `contains`/`insensitive` only folds case, not diacritics (no `unaccent` extension).
  const allMatching = await prisma.product.findMany({
    where,
    include: {
      variants: { where: { is_active: true }, orderBy: { size: "asc" } },
      creator: { select: { id: true, name: true } },
    },
    orderBy: { created_at: "desc" },
  });

  const filtered = q
    ? allMatching.filter((p) => normalizeText(p.name).includes(normalizeText(q)))
    : allMatching;

  // Surface quick-sale products with stock in the selected channel first, so store
  // staff aren't stuck scrolling past out-of-stock items to find what they usually sell.
  if (channel) {
    const hasChannelStock = (p: (typeof filtered)[number]) =>
      p.quick_sale && p.variants.some((v) => (channel === "tienda" ? v.stock_store : v.stock_online) > 0);
    filtered.sort((a, b) => Number(!hasChannelStock(a)) - Number(!hasChannelStock(b)));
  }

  const total = filtered.length;
  const products = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  const data = products.map((p) => ({
    ...p,
    created_at: p.created_at.toISOString(),
    updated_at: p.updated_at.toISOString(),
    hasLowStock: p.variants.some((v) => v.stock_total < 3),
    variants: p.variants.map((v) => ({
      ...v,
      price_bcv: Number(v.price_bcv),
      price_divisas: Number(v.price_divisas),
      price_bundle_bcv: Number(v.price_bundle_bcv),
      price_bundle_divisas: Number(v.price_bundle_divisas),
      price_mayor_bcv: Number(v.price_mayor_bcv),
      price_mayor_divisas: Number(v.price_mayor_divisas),
      updated_at: v.updated_at.toISOString(),
    })),
  }));

  return NextResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

// POST /api/products
export async function POST(request: NextRequest) {
  const auth = await withRole(["admin", "inventario"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { name, type, color, description, price_bcv, price_divisas, price_bundle_bcv, price_bundle_divisas, price_mayor_bcv, price_mayor_divisas, photos, variants, quick_sale } = body;

  if (!name?.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  if (!type?.trim()) return NextResponse.json({ error: "El tipo es requerido" }, { status: 400 });
  if (!price_bcv || Number(price_bcv) <= 0)
    return NextResponse.json({ error: "El precio BCV debe ser mayor a 0" }, { status: 400 });
  if (!Array.isArray(photos) || photos.length === 0)
    return NextResponse.json({ error: "Agrega al menos una foto" }, { status: 400 });
  if (!Array.isArray(variants) || variants.length === 0)
    return NextResponse.json({ error: "Agrega al menos una talla" }, { status: 400 });

  // Guard: reject duplicate name+color combinations
  const normalizedColor = color?.trim() || null;
  const duplicate = await prisma.product.findFirst({
    where: {
      name: { equals: name.trim(), mode: "insensitive" },
      color: normalizedColor ? { equals: normalizedColor, mode: "insensitive" } : null,
      is_active: true,
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "Ya existe un producto con ese nombre y color", existingId: duplicate.id },
      { status: 409 }
    );
  }

  const ip = getClientIp(request);
  const pBcv       = parseFloat(Number(price_bcv).toFixed(2));
  const pDivisas   = parseFloat(Number(price_divisas || 0).toFixed(2));
  const pBundleBcv = parseFloat(Number(price_bundle_bcv || 0).toFixed(2));
  const pBundleDiv = parseFloat(Number(price_bundle_divisas || 0).toFixed(2));
  const pMayorBcv  = parseFloat(Number(price_mayor_bcv || 0).toFixed(2));
  const pMayorDiv  = parseFloat(Number(price_mayor_divisas || 0).toFixed(2));

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-check duplicate inside serializable transaction to prevent TOCTOU race
      // (the pre-transaction check above handles the common case; this catches concurrent races)
      const concurrentDup = await tx.product.findFirst({
        where: {
          name: { equals: name.trim(), mode: "insensitive" },
          color: normalizedColor ? { equals: normalizedColor, mode: "insensitive" } : null,
          is_active: true,
        },
        select: { id: true },
      });
      if (concurrentDup) throw new Error(`DUP:${concurrentDup.id}`);

      if (quick_sale === true) {
        const [count, limit] = await Promise.all([
          tx.product.count({ where: { quick_sale: true } }),
          getSetting("quick_sale_limit"),
        ]);
        if (count >= limit) throw new Error("QUICK_SALE_LIMIT");
      }

      const product = await tx.product.create({
        data: {
          name: name.trim(),
          type: type.trim(),
          color: normalizedColor,
          description: description?.trim() || null,
          photos: photos.filter(Boolean),
          quick_sale: quick_sale === true,
          created_by: auth.session.id,
        },
      });

      for (const v of variants) {
        const size = v.size?.trim();
        if (!size) continue;
        const stockOnline = Math.max(0, Math.floor(Number(v.stock_online) || 0));
        const stockStore = Math.max(0, Math.floor(Number(v.stock_store) || 0));
        const stockTotal = stockOnline + stockStore;

        const variant = await tx.productVariant.create({
          data: {
            product_id: product.id,
            size,
            sku: generateSku(product.name, size),
            stock_online: stockOnline,
            stock_store: stockStore,
            stock_total: stockTotal,
            price_bcv: pBcv,
            price_divisas: pDivisas,
            price_bundle_bcv: pBundleBcv,
            price_bundle_divisas: pBundleDiv,
            price_mayor_bcv: pMayorBcv,
            price_mayor_divisas: pMayorDiv,
          },
        });

        if (stockTotal > 0) {
          await tx.inventoryMovement.create({
            data: {
              variant_id: variant.id,
              type: "entrada",
              channel: "total",
              qty_before: 0,
              qty_change: stockTotal,
              qty_after: stockTotal,
              reason: "Stock inicial al crear producto",
              created_by: auth.session.id,
            },
          });
        }
      }

      if (quick_sale === true) {
        const activeCount = await tx.productVariant.count({ where: { product_id: product.id, is_active: true } });
        if (activeCount !== 1) throw new Error("QUICK_SALE_SINGLE_VARIANT");
      }

      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "CREATE",
          entity_type: "Product",
          entity_id: product.id,
          data_after: { name: product.name, type: product.type, color: product.color },
          ip_address: ip,
        },
      });

      return product;
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.startsWith("DUP:")) {
      const existingId = msg.replace("DUP:", "");
      return NextResponse.json(
        { error: "Ya existe un producto con ese nombre y color", existingId },
        { status: 409 }
      );
    }
    if (msg === "QUICK_SALE_LIMIT") {
      const limit = await getSetting("quick_sale_limit");
      return NextResponse.json({ error: `Ya existen ${limit} productos marcados para venta rápida (límite configurado)` }, { status: 409 });
    }
    if (msg === "QUICK_SALE_SINGLE_VARIANT") {
      return NextResponse.json({ error: "Los productos de venta rápida deben tener exactamente una talla activa" }, { status: 400 });
    }
    console.error("POST /api/products:", err);
    return NextResponse.json({ error: "Error al crear el producto" }, { status: 500 });
  }
}
