import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/shared/productos/ProductForm";
import { ChevronLeft } from "lucide-react";
import type { ProductJSON } from "@/types";

async function getProduct(id: string): Promise<ProductJSON | null> {
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
      price_usd: Number(v.price_usd),
      updated_at: v.updated_at.toISOString(),
    })),
  };
}

export default async function EditarProductoPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin" && session.role !== "inventario") {
    redirect(`/dashboard/productos/${params.id}`);
  }

  const product = await getProduct(params.id);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/dashboard/productos/${params.id}`}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ChevronLeft size={15} />
          Volver al producto
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Editar producto</h1>
        <p className="mt-1 text-sm text-gray-500">{product.name}</p>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <ProductForm initialData={product} productId={product.id} />
      </div>
    </div>
  );
}
