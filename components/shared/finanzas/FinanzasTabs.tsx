"use client";

import Link from "next/link";
import { BarChart2, Package, History } from "lucide-react";

type Props = {
  active: "resumen" | "productos" | "historial";
};

export function FinanzasTabs({ active }: Props) {
  const tabClass = (isActive: boolean) =>
    `flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-1.5 rounded-md px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
      isActive ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
    }`;

  return (
    <div className="flex w-full sm:w-fit gap-1 rounded-lg border bg-gray-50 p-1 overflow-x-auto max-w-full no-scrollbar">
      <Link href="/dashboard/finanzas" className={tabClass(active === "resumen")}>
        <BarChart2 size={15} />
        Resumen
      </Link>
      <Link href="/dashboard/finanzas?tab=productos" className={tabClass(active === "productos")}>
        <Package size={15} />
        Análisis de productos
      </Link>
      <Link href="/dashboard/finanzas?tab=historial" className={tabClass(active === "historial")}>
        <History size={15} />
        Historial financiero
      </Link>
    </div>
  );
}
