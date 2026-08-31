import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key") || request.headers.get("X-API-Key");
  const expectedApiKey = process.env.BOT_API_KEY;

  if (!expectedApiKey || apiKey !== expectedApiKey) {
    return NextResponse.json(
      { status: "error", error: "Unauthorized" },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }

  try {
    const products = await prisma.product.findMany({
      where: {
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        description: true,
        photos: true,
        quick_sale: true,
        updated_at: true,
        variants: {
          where: {
            is_active: true,
          },
          select: {
            id: true,
            size: true,
            sku: true,
            stock_total: true,
            stock_online: true,
            stock_store: true,
            price_bcv: true,
            price_divisas: true,
            price_bundle_bcv: true,
            price_bundle_divisas: true,
            price_mayor_bcv: true,
            price_mayor_divisas: true,
            updated_at: true,
          },
          orderBy: {
            size: "asc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    let totalStock = 0;

    const data = products.map((product) => {
      const formattedVariants = product.variants.map((v) => {
        totalStock += v.stock_total;

        return {
          id: v.id,
          size: v.size,
          sku: v.sku,
          stock_total: v.stock_total,
          stock_online: v.stock_online,
          stock_store: v.stock_store,
          price_bcv: Number(v.price_bcv),
          price_divisas: Number(v.price_divisas),
          price_bundle_bcv: Number(v.price_bundle_bcv),
          price_bundle_divisas: Number(v.price_bundle_divisas),
          price_mayor_bcv: Number(v.price_mayor_bcv),
          price_mayor_divisas: Number(v.price_mayor_divisas),
          updated_at: v.updated_at.toISOString(),
        };
      });

      return {
        id: product.id,
        name: product.name,
        type: product.type,
        color: product.color,
        description: product.description,
        photos: product.photos,
        quick_sale: product.quick_sale,
        updated_at: product.updated_at.toISOString(),
        variants: formattedVariants,
      };
    });

    return NextResponse.json(
      {
        status: "success",
        timestamp: new Date().toISOString(),
        total_products: data.length,
        total_stock: totalStock,
        data,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/v1/bot/inventory error:", error);
    return NextResponse.json(
      { status: "error", error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
