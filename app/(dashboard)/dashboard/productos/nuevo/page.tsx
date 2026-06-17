import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { ProductForm } from "@/components/shared/productos/ProductForm";
import { ChevronLeft } from "lucide-react";

export const metadata = { title: "Nuevo producto — Cenicola Hub" };

export default async function NuevoProductoPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin" && session.role !== "inventario") {
    redirect("/dashboard/productos");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/productos"
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ChevronLeft size={15} />
          Volver a productos
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo producto</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cada color es un producto independiente con su propia foto
        </p>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <ProductForm />
      </div>
    </div>
  );
}
