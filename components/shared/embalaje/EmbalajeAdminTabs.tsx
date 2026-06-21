"use client";

import Link from "next/link";
import { PackageCheck, History } from "lucide-react";

type Props = {
  active: "embalaje" | "historial";
  pendingCount: number;
};

export function EmbalajeAdminTabs({ active, pendingCount }: Props) {
  const tabClass = (isActive: boolean) =>
    `flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-2 rounded-md px-3 py-2 sm:px-5 text-sm sm:text-[15px] font-medium whitespace-nowrap transition-colors ${
      isActive ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
    }`;

  return (
    <div className="flex w-full sm:w-fit gap-1 rounded-lg border bg-gray-50 p-1">
      <Link href="/dashboard/embalaje" className={tabClass(active === "embalaje")}>
        <PackageCheck size={16} />
        En embalaje
        {pendingCount > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active === "embalaje" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"}`}>
            {pendingCount}
          </span>
        )}
      </Link>
      <Link href="/dashboard/embalaje?tab=historial" className={tabClass(active === "historial")}>
        <History size={16} />
        Historial de envíos
      </Link>
    </div>
  );
}
