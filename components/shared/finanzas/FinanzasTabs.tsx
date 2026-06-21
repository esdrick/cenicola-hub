"use client";

import Link from "next/link";
import { BarChart2, History } from "lucide-react";

type Props = {
  active: "resumen" | "historial";
};

export function FinanzasTabs({ active }: Props) {
  const tabClass = (isActive: boolean) =>
    `flex items-center gap-2 rounded-md px-5 py-2 text-[15px] font-medium transition-colors ${
      isActive ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
    }`;

  return (
    <div className="flex w-fit gap-1 rounded-lg border bg-gray-50 p-1">
      <Link href="/dashboard/finanzas" className={tabClass(active === "resumen")}>
        <BarChart2 size={16} />
        Resumen
      </Link>
      <Link href="/dashboard/finanzas?tab=historial" className={tabClass(active === "historial")}>
        <History size={16} />
        Historial financiero
      </Link>
    </div>
  );
}
