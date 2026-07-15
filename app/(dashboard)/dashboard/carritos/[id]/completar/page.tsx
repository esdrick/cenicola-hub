import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { ConvertCartForm } from "@/components/shared/carritos/ConvertCartForm";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CartJSON, CartItemJSON } from "@/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function CompletarCarritoPage({ params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const cart = await prisma.cart.findUnique({
    where: { id },
    include: {
      vendor: { select: { id: true, name: true } },
      items: {
        include: {
          variant: {
            include: {
              product: { select: { id: true, name: true, color: true, photos: true } },
            },
          },
        },
        orderBy: { created_at: "asc" },
      },
    },
  });

  if (!cart) notFound();

  const isVendor = session.role === "vendedora_online" || session.role === "vendedora_tienda";
  if (isVendor && cart.vendor_id !== session.id) redirect("/dashboard/ordenes");

  if (cart.status !== "active") redirect(`/dashboard/carritos/${id}`);
  if (cart.items.length === 0) redirect(`/dashboard/carritos/${id}`);

  const channel = cart.channel;

  const items: CartItemJSON[] = cart.items.map((item) => {
    const stock = channel === "online" ? item.variant.stock_online : item.variant.stock_store;
    return {
      id: item.id,
      cart_id: item.cart_id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price_usd: Number(item.unit_price_usd),
      quantity_bcv: item.quantity_bcv,
      quantity_divisas: item.quantity_divisas,
      subtotal_bcv_usd: Number(item.subtotal_bcv_usd),
      subtotal_divisas_usd: Number(item.subtotal_divisas_usd),
      created_at: item.created_at.toISOString(),
      stock_warning: stock < item.quantity,
      stock_available: stock,
      variant: {
        id: item.variant.id,
        size: item.variant.size,
        sku: item.variant.sku,
        stock_online: item.variant.stock_online,
        stock_store: item.variant.stock_store,
        product: {
          id: item.variant.product.id,
          name: item.variant.product.name,
          color: item.variant.product.color,
          photos: item.variant.product.photos,
        },
      },
    };
  });

  const total_bcv_usd = parseFloat(items.reduce((s, i) => s + i.subtotal_bcv_usd, 0).toFixed(2));
  const total_divisas_usd = parseFloat(items.reduce((s, i) => s + i.subtotal_divisas_usd, 0).toFixed(2));
  const total_usd = parseFloat((total_bcv_usd + total_divisas_usd).toFixed(2));

  const [mayorThreshold, bundleThreshold] = await Promise.all([
    getSetting("mayor_threshold"),
    getSetting("bundle_threshold"),
  ]);

  const cartJSON: CartJSON = {
    id: cart.id,
    vendor_id: cart.vendor_id,
    channel: cart.channel,
    note: cart.note,
    status: cart.status,
    pricing_method: cart.pricing_method,
    created_at: cart.created_at.toISOString(),
    updated_at: cart.updated_at.toISOString(),
    vendor: cart.vendor,
    items,
    total_usd,
    total_bcv_usd,
    total_divisas_usd,
    has_stock_issues: items.some((i) => i.stock_warning),
    mayor_threshold: mayorThreshold,
    bundle_threshold: bundleThreshold,
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/carritos/${id}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-2")}
        >
          <ChevronLeft size={14} className="mr-1" />Productos
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nueva orden</h1>
      </div>
      <ConvertCartForm cart={cartJSON} isAdmin={session.role === "admin"} />
    </div>
  );
}
