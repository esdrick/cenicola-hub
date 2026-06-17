"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StockAdjustDialog } from "@/components/shared/productos/StockAdjustDialog";
import { SlidersHorizontal } from "lucide-react";

type Props = {
  variantId: string;
  productName: string;
  size: string;
  currentOnline: number;
  currentStore: number;
};

export function VariantActions({ variantId, productName, size, currentOnline, currentStore }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="h-7 px-2 text-xs">
        <SlidersHorizontal size={13} className="mr-1" />
        Ajustar
      </Button>
      <StockAdjustDialog
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => router.refresh()}
        variantId={variantId}
        productName={productName}
        size={size}
        currentOnline={currentOnline}
        currentStore={currentStore}
      />
    </>
  );
}
