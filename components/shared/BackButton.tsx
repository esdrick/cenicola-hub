"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

type Props = {
  fallbackHref?: string;
  label?: string;
  className?: string;
};

export function BackButton({
  fallbackHref = "/dashboard/productos",
  label = "Productos",
  className = "flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800",
}: Props) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <a href={fallbackHref} onClick={handleClick} className={className}>
      <ChevronLeft size={15} />
      {label}
    </a>
  );
}
