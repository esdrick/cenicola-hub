"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BackToOrdersButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => { router.refresh(); router.push("/dashboard/ordenes"); }}
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-2")}
    >
      <ChevronLeft size={14} className="mr-1" />Órdenes
    </button>
  );
}
