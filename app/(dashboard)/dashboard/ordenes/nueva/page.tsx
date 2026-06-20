import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CartBuilder } from "@/components/shared/carritos/CartBuilder";
import { BackToOrdersButton } from "@/components/shared/ordenes/BackToOrdersButton";

export const dynamic = "force-dynamic";

export default async function NuevaOrdenPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const allowed = ["admin", "vendedora_online", "vendedora_tienda"];
  if (!allowed.includes(session.role)) redirect("/dashboard/ordenes");

  const isAdmin = session.role === "admin";
  const defaultChannel: "online" | "tienda" | undefined =
    session.role === "vendedora_tienda" ? "tienda" :
    session.role === "vendedora_online" ? "online" :
    undefined;

  return (
    <div className="space-y-6">
      <div>
        <BackToOrdersButton />
        <h1 className="text-2xl font-bold text-gray-900">Nueva orden</h1>
      </div>
      <CartBuilder cart={null} defaultChannel={defaultChannel} isAdmin={isAdmin} />
    </div>
  );
}
