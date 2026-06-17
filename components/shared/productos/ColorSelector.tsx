"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type Sibling = { id: string; color: string | null };

type Props = {
  currentId: string;
  siblings: Sibling[];
};

export function ColorSelector({ currentId, siblings }: Props) {
  if (siblings.length <= 1) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        Color
      </p>
      <div className="flex flex-wrap gap-2">
        {siblings.map((s) => {
          const isCurrent = s.id === currentId;
          return (
            <Link
              key={s.id}
              href={`/dashboard/productos/${s.id}`}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                isCurrent
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
              )}
            >
              {s.color ?? "Sin color"}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
