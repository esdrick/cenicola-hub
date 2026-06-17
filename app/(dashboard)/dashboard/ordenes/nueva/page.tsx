import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { buttonVariants } from "@/components/ui/button";
import { NewOrderForm } from "@/components/shared/ordenes/NewOrderForm";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function NuevaOrdenPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/ordenes"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-2")}
        >
          <ChevronLeft size={14} className="mr-1" />Órdenes
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nueva orden</h1>
      </div>
      <NewOrderForm isAdmin={session.role === "admin"} />
    </div>
  );
}
