"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AjusteManualDialog } from "@/components/shared/inventario/AjusteManualDialog";
import { StockThresholdDialog } from "@/components/shared/inventario/StockThresholdDialog";
import { SlidersHorizontal, Settings2 } from "lucide-react";

type Props = {
  subtitle: string;
  canAdjust: boolean;
  lowStockThreshold: number;
};

export function InventarioHeader({ subtitle, canAdjust, lowStockThreshold }: Props) {
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [thresholdOpen, setThresholdOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
      </div>

      {canAdjust && (
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setThresholdOpen(true)}>
            <Settings2 size={14} className="sm:mr-1.5" />
            <span className="hidden sm:inline">Stock bajo</span>
          </Button>

          <Button size="sm" onClick={() => setAjusteOpen(true)}>
            <SlidersHorizontal size={14} className="sm:mr-1.5" />
            <span className="hidden sm:inline">Ajuste manual</span>
          </Button>

          <AjusteManualDialog open={ajusteOpen} onClose={() => setAjusteOpen(false)} />
          <StockThresholdDialog
            open={thresholdOpen}
            onClose={() => setThresholdOpen(false)}
            current={lowStockThreshold}
          />
        </div>
      )}
    </div>
  );
}
