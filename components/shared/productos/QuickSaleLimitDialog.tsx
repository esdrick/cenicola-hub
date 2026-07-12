"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  current: number;
};

export function QuickSaleLimitDialog({ open, onClose, current }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSave() {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 20) {
      setError("Ingresa un número entre 1 y 20");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quick_sale_limit: num }),
    });
    setSaving(false);
    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al guardar");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm rounded-xl border bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-gray-900">Límite de Venta Rápida</h2>
        <p className="mt-1 text-sm text-gray-500">
          Máximo de productos que se pueden marcar para la pantalla de Venta Rápida de tienda.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <Input
            type="number"
            min={1}
            max={20}
            value={value}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => { setValue(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-24 text-center"
            autoFocus
          />
          <span className="text-sm text-gray-500">productos</span>
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={13} className="animate-spin" />}
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
