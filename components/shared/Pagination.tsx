"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type BaseProps = {
  page: number;
  totalPages: number;
  total: number;
  noun: string;
  nounPlural?: string;
  isPending?: boolean;
  className?: string;
};

type HrefMode = BaseProps & {
  prevHref: string | null;
  nextHref: string | null;
  onPrev?: never;
  onNext?: never;
};

type CallbackMode = BaseProps & {
  prevHref?: never;
  nextHref?: never;
  onPrev: () => void;
  onNext: () => void;
  onPageChange?: (page: number) => void;
};

type PaginationProps = HrefMode | CallbackMode;

const iconBtn =
  "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors";
const activeBtn = `${iconBtn} text-gray-500 hover:bg-gray-100 hover:text-gray-800`;
const disabledBtn = `${iconBtn} text-gray-300 pointer-events-none`;

export function Pagination({
  page,
  totalPages,
  total,
  noun,
  nounPlural,
  isPending = false,
  className,
  ...nav
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const label = total === 1 ? noun : (nounPlural ?? `${noun}s`);
  const canPrev = page > 1 && !isPending;
  const canNext = page < totalPages && !isPending;
  const onPageChange = "onPageChange" in nav ? nav.onPageChange : undefined;

  function jumpTo(raw: string) {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(Math.max(1, n), totalPages);
    if (clamped !== page) onPageChange?.(clamped);
  }

  const PrevBtn =
    "prevHref" in nav ? (
      nav.prevHref && canPrev ? (
        <Link href={nav.prevHref} className={activeBtn}>
          <ChevronLeft size={15} />
        </Link>
      ) : (
        <span className={disabledBtn}>
          <ChevronLeft size={15} />
        </span>
      )
    ) : (
      <button
        onClick={nav.onPrev}
        disabled={!canPrev}
        className={canPrev ? activeBtn : disabledBtn}
      >
        <ChevronLeft size={15} />
      </button>
    );

  const NextBtn =
    "nextHref" in nav ? (
      nav.nextHref && canNext ? (
        <Link href={nav.nextHref} className={activeBtn}>
          <ChevronRight size={15} />
        </Link>
      ) : (
        <span className={disabledBtn}>
          <ChevronRight size={15} />
        </span>
      )
    ) : (
      <button
        onClick={nav.onNext}
        disabled={!canNext}
        className={canNext ? activeBtn : disabledBtn}
      >
        <ChevronRight size={15} />
      </button>
    );

  return (
    <div
      className={cn(
        "flex items-center justify-between text-sm text-gray-500",
        className
      )}
    >
      <span>
        {total} {label}
      </span>
      <div className="flex items-center gap-1">
        {PrevBtn}
        {onPageChange ? (
          <span className="flex items-center gap-1 text-xs tabular-nums">
            <input
              key={page}
              type="number"
              inputMode="numeric"
              min={1}
              max={totalPages}
              defaultValue={page}
              disabled={isPending}
              onKeyDown={(e) => {
                if (e.key === "Enter") { jumpTo(e.currentTarget.value); e.currentTarget.blur(); }
              }}
              onBlur={(e) => jumpTo(e.currentTarget.value)}
              className="w-11 rounded border border-gray-200 bg-white py-0.5 text-center focus:border-gray-400 focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span>/ {totalPages}</span>
          </span>
        ) : (
          <span className="min-w-[3.5rem] text-center text-xs tabular-nums">
            {page} / {totalPages}
          </span>
        )}
        {NextBtn}
      </div>
    </div>
  );
}
