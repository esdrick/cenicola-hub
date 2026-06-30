import { prisma } from "@/lib/prisma";
import type { ProductJSON } from "@/types";

export async function getProduct(id: string): Promise<ProductJSON | null> {
  const p = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: { orderBy: { size: "asc" } },
      creator: { select: { id: true, name: true } },
    },
  });
  if (!p) return null;
  return {
    ...p,
    created_at: p.created_at.toISOString(),
    updated_at: p.updated_at.toISOString(),
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
  };
}
