"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AjusteManualDialog } from "@/components/shared/inventario/AjusteManualDialog";
import { SlidersHorizontal } from "lucide-react";

type Props = { total: number; canAdjust: boolean };

export function InventarioHeader({ total, canAdjust }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {total} movimiento{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}
        </p>
      </div>

      {canAdjust && (
        <>
          <Button onClick={() => setOpen(true)}>
            <SlidersHorizontal size={15} className="mr-2" />
            Ajuste manual
          </Button>
          <AjusteManualDialog open={open} onClose={() => setOpen(false)} />
        </>
      )}
    </div>
  );
}
