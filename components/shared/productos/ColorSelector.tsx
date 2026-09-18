"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type Sibling = { id: string; color: string | null };

type Props = {
  currentId: string;
  currentColor?: string | null;
  siblings: Sibling[];
  fromParam?: string;
};

export function ColorSelector({ currentId, currentColor, siblings, fromParam }: Props) {
  const displayColor = siblings.find((s) => s.id === currentId)?.color ?? currentColor ?? "Sin color";

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Color
      </p>
      <div className="flex flex-wrap gap-2">
        {siblings.length > 1 ? (
          siblings.map((s) => {
            const isCurrent = s.id === currentId;
            const href = fromParam
              ? `/dashboard/productos/${s.id}?from=${encodeURIComponent(fromParam)}`
              : `/dashboard/productos/${s.id}`;
            return (
              <Link
                key={s.id}
                href={href}
                className={cn(
                  "rounded-md border px-3 py-1 text-sm font-medium transition-colors",
                  isCurrent
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                )}
              >
                {s.color ?? "Sin color"}
              </Link>
            );
          })
        ) : (
          <span className="rounded-md border border-gray-900 bg-gray-900 px-3 py-1 text-sm font-medium text-white">
            {displayColor}
          </span>
        )}
      </div>
    </div>
  );
}
