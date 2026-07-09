"use client";

import { useState } from "react";
import { History, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatOrderAuditEntry, type OrderAuditLogEntry } from "@/lib/audit-format";

export function OrderHistorySection({ logs }: { logs: OrderAuditLogEntry[] }) {
  const [open, setOpen] = useState(false);

  if (logs.length === 0) return null;

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 sm:px-5 py-3 text-left hover:bg-gray-50"
      >
        <History size={14} className="text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-700">Historial de cambios</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">Solo admin</span>
        <span className="text-xs text-gray-400">({logs.length})</span>
        <ChevronDown
          size={15}
          className={cn("ml-auto flex-shrink-0 text-gray-400 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="divide-y border-t">
          {logs.map((log) => {
            const { title, details } = formatOrderAuditEntry(log);
            return (
              <div key={log.id} className="px-3 sm:px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                  <p className="text-sm font-medium text-gray-800">{title}</p>
                  <span className="text-xs text-gray-400 whitespace-nowrap" suppressHydrationWarning>
                    {log.created_at.toLocaleString("es-VE", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{log.user.name}</p>
                {details.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {details.map((d, i) => (
                      <li key={i} className="text-xs text-gray-600">{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
