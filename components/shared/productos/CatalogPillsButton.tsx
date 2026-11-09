"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";
import { CatalogPillsDialog } from "@/components/shared/productos/CatalogPillsDialog";

export function CatalogPillsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <SlidersHorizontal size={14} className="sm:mr-1.5" />
        <span className="hidden sm:inline">Filtros Web</span>
      </Button>
      <CatalogPillsDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
