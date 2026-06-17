import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, withRole, getClientIp } from "@/lib/api-auth";
import { generateSku } from "@/lib/sku";

// GET /api/products?q=&tipo=&color=&page=1
export async function GET(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const tipo = sp.get("tipo")?.trim() ?? "";
  const color = sp.get("color")?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const pageSize = 24;

  const where = {
    is_active: true,
    ...(q && { name: { contains: q, mode: "insensitive" as const } }),
    ...(tipo && { type: { contains: tipo, mode: "insensitive" as const } }),
    ...(color && { color: { contains: color, mode: "insensitive" as const } }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        variants: { where: { is_active: true }, orderBy: { size: "asc" } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  const data = products.map((p) => ({
    ...p,
    created_at: p.created_at.toISOString(),
    updated_at: p.updated_at.toISOString(),
    hasLowStock: p.variants.some((v) => v.stock_total < 3),
    variants: p.variants.map((v) => ({
      ...v,
      price_usd: Number(v.price_usd),
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

  const { name, type, color, description, price_usd, photos, variants } = body;

  if (!name?.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  if (!type?.trim()) return NextResponse.json({ error: "El tipo es requerido" }, { status: 400 });
  if (!price_usd || Number(price_usd) <= 0)
    return NextResponse.json({ error: "El precio debe ser mayor a 0" }, { status: 400 });
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
  const price = parseFloat(Number(price_usd).toFixed(2));

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: name.trim(),
          type: type.trim(),
          color: color?.trim() || null,
          description: description?.trim() || null,
          photos: photos.filter(Boolean),
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
            price_usd: price,
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
    });

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (err) {
    console.error("POST /api/products:", err);
    return NextResponse.json({ error: "Error al crear el producto" }, { status: 500 });
  }
}
