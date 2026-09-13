"use client";

import Link from "next/link";
import { Users, Globe } from "lucide-react";

type Props = {
  active: "hub" | "web";
  hubCount?: number;
  webCount?: number;
};

export function ClientesTabs({ active, hubCount, webCount }: Props) {
  const tabClass = (isActive: boolean) =>
    `flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-2 rounded-md px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
      isActive ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
    }`;

  return (
    <div className="flex w-full sm:w-fit gap-1 rounded-lg border bg-gray-50 p-1 overflow-x-auto max-w-full no-scrollbar">
      <Link href="/dashboard/clientes" className={tabClass(active === "hub")}>
        <Users size={15} />
        <span>Clientes Hub</span>
        {hubCount !== undefined && (
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              active === "hub" ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700"
            }`}
          >
            {hubCount}
          </span>
        )}
      </Link>
      <Link href="/dashboard/clientes?tab=web" className={tabClass(active === "web")}>
        <Globe size={15} />
        <span>Cuentas Web</span>
        {webCount !== undefined && (
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              active === "web" ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700"
            }`}
          >
            {webCount}
          </span>
        )}
      </Link>
    </div>
  );
}
