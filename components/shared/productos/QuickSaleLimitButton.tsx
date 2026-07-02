"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import { QuickSaleLimitDialog } from "@/components/shared/productos/QuickSaleLimitDialog";

type Props = {
  current: number;
};

export function QuickSaleLimitButton({ current }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Settings2 size={14} className="sm:mr-1.5" />
        <span className="hidden sm:inline">Límite Venta Rápida</span>
      </Button>
      <QuickSaleLimitDialog open={open} onClose={() => setOpen(false)} current={current} />
    </>
  );
}
