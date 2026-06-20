"use client";

import Link from "next/link";
import { Clock, CheckCircle2 } from "lucide-react";

type Props = {
  active: "pendientes" | "verificados";
  pendingCount: number;
};

export function PagosTabs({ active, pendingCount }: Props) {
  function tabHref(tab: string) {
    const params = new URLSearchParams();
    params.set("tab", tab);
    return `/dashboard/pagos?${params.toString()}`;
  }

  const tabClass = (isActive: boolean) =>
    `flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
      isActive ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
    }`;

  return (
    <div className="flex w-fit gap-1 rounded-lg border bg-gray-50 p-1">
      <Link href={tabHref("pendientes")} className={tabClass(active === "pendientes")}>
        <Clock size={14} />
        Pendientes
        {pendingCount > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active === "pendientes" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"}`}>
            {pendingCount}
          </span>
        )}
      </Link>
      <Link href={tabHref("verificados")} className={tabClass(active === "verificados")}>
        <CheckCircle2 size={14} />
        Confirmados
      </Link>
    </div>
  );
}
