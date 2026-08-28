import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CartBuilder } from "@/components/shared/carritos/CartBuilder";
import { BackToOrdersButton } from "@/components/shared/ordenes/BackToOrdersButton";
import { ImportWhatsAppModal } from "@/components/shared/ordenes/ImportWhatsAppModal";

export const dynamic = "force-dynamic";

export default async function NuevaOrdenPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const allowed = ["admin", "inventario", "vendedora_online", "vendedora_tienda"];
  if (!allowed.includes(session.role)) redirect("/dashboard/ordenes");

  const isAdmin = session.role === "admin" || session.role === "inventario";
  const defaultChannel: "online" | "tienda" | undefined =
    session.role === "vendedora_tienda" ? "tienda" :
    session.role === "vendedora_online" ? "online" :
    undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <BackToOrdersButton />
          <h1 className="text-2xl font-bold text-gray-900">Nueva orden</h1>
        </div>
        {isAdmin && (
          <ImportWhatsAppModal className="w-full sm:w-auto justify-center text-xs sm:text-sm px-3 py-2" />
        )}
      </div>
      <CartBuilder
        cart={null}
        defaultChannel={defaultChannel}
        isAdmin={isAdmin}
        quickSale={session.role === "vendedora_tienda"}
      />
    </div>
  );
}
