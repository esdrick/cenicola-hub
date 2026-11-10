"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CatalogPill } from "@/lib/settings";

type Props = {
  open: boolean;
  onClose: () => void;
};

const BASE_SET = new Set(["mujer", "hombre", "niños"]);

export function CatalogPillsDialog({ open, onClose }: Props) {
  const router = useRouter();
  const [pills, setPills] = useState<CatalogPill[]>([]);
  const [systemCategories, setSystemCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const systemCategorySet = useMemo(
    () => new Set(systemCategories.map((c) => c.toLowerCase())),
    [systemCategories]
  );

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    setSuccessMsg("");
    setNewFilterName("");

    fetch("/api/settings/catalog-pills")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error al cargar los filtros");
        return data;
      })
      .then((data) => {
        if (!active) return;
        setPills(Array.isArray(data.pills) ? data.pills : []);
        setSystemCategories(
          Array.isArray(data.systemCategories) ? data.systemCategories : []
        );
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Error al cargar los filtros"
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  if (!open) return null;

  function isSystemCategory(name: string): boolean {
    const key = name.trim().toLowerCase();
    return BASE_SET.has(key) || systemCategorySet.has(key);
  }

  function getCategoryOrigin(name: string): "base" | "product" | "custom" {
    const key = name.trim().toLowerCase();
    if (BASE_SET.has(key)) return "base";
    if (systemCategorySet.has(key)) return "product";
    return "custom";
  }

  function handleToggleVisible(index: number, visible: boolean) {
    setError("");
    setSuccessMsg("");
    setPills((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, visible } : item))
    );
  }

  function handleToggleAll(visible: boolean) {
    setError("");
    setSuccessMsg("");
    setPills((prev) => prev.map((item) => ({ ...item, visible })));
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= pills.length) return;
    setError("");
    setSuccessMsg("");
    setPills((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    setError("");
    setSuccessMsg("");
    setPills((prev) => {
      const next = [...prev];
      const [moved] = next.splice(draggedIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleAddCustomFilter() {
    const trimmed = newFilterName.trim();
    if (!trimmed) {
      setError("Escribe un nombre para el filtro personalizado");
      return;
    }

    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    const exists = pills.some(
      (p) => p.name.trim().toLowerCase() === formatted.toLowerCase()
    );

    if (exists) {
      setError(`El filtro "${formatted}" ya existe en la lista`);
      return;
    }

    setError("");
    setSuccessMsg("");
    setPills((prev) => [...prev, { name: formatted, visible: true }]);
    setNewFilterName("");
  }

  function handleRemoveCustomFilter(index: number) {
    const target = pills[index];
    if (!target || isSystemCategory(target.name)) return;
    setError("");
    setSuccessMsg("");
    setPills((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/settings/catalog-pills", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pills }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al guardar los filtros");
      }

      if (Array.isArray(data.pills)) {
        setPills(data.pills);
      }

      setSuccessMsg("Configuración de filtros guardada correctamente");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const visiblePills = pills.filter((p) => p.visible);
  const allVisible = pills.length > 0 && visiblePills.length === pills.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={saving ? undefined : onClose}
      />

      {/* Modal con altura fija/máxima y overflow-hidden para que el scroll interno funcione en iOS/móvil */}
      <div
        style={{ height: "85dvh", maxHeight: "680px" }}
        className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-xl border bg-white shadow-xl"
      >
        {/* Header fijo */}
        <div className="flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">
              Píldoras de Filtros — Catálogo Web
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Ordena y elige qué categorías aparecen junto a{" "}
              <span className="font-medium text-gray-700">&ldquo;Ver Todo&rdquo;</span>.
              Las ocultas quedan dentro del botón{" "}
              <span className="font-medium text-gray-700">&ldquo;Filtros&rdquo;</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-12 text-gray-400">
            <Loader2 size={24} className="animate-spin text-gray-600" />
            <p className="mt-2 text-sm">Cargando filtros del catálogo...</p>
          </div>
        ) : (
          <>
            {/* Controles superiores fijos (Vista previa + Agregar filtro) */}
            <div className="shrink-0 space-y-2.5 border-b bg-gray-50/40 px-4 py-3 sm:px-6">
              {/* Live Preview Bar */}
              <div className="rounded-lg border bg-white p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
                    Vista previa ({visiblePills.length} visibles)
                  </span>
                  {pills.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleToggleAll(!allVisible)}
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {allVisible ? "Ocultar todos" : "Mostrar todos"}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <span className="shrink-0 rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-medium text-white">
                    Ver Todo
                  </span>
                  {visiblePills.length === 0 ? (
                    <span className="text-xs italic text-gray-400">
                      Ninguna píldora visible en la barra principal
                    </span>
                  ) : (
                    visiblePills.map((p) => (
                      <span
                        key={p.name}
                        className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                      >
                        {p.name}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Add Custom Filter */}
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Nuevo filtro (ej. Conjuntos, Oversize)..."
                  value={newFilterName}
                  onChange={(e) => {
                    setNewFilterName(e.target.value);
                    if (error) setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomFilter();
                    }
                  }}
                  className="h-8 flex-1 bg-white text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCustomFilter}
                  className="h-8 shrink-0 bg-white"
                >
                  <Plus size={14} className="mr-1" />
                  Agregar
                </Button>
              </div>
            </div>

            {/* Lista desplazable (min-h-0 flex-1 overflow-y-auto garantiza scroll en iOS y Android) */}
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6">
              {pills.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-gray-400">
                  No hay filtros configurados
                </div>
              ) : (
                pills.map((pill, idx) => {
                  const origin = getCategoryOrigin(pill.name);
                  const isDragging = draggedIndex === idx;
                  const isDragOver =
                    dragOverIndex === idx && draggedIndex !== idx;

                  return (
                    <div
                      key={pill.name.toLowerCase()}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 transition-colors sm:px-3",
                        pill.visible
                          ? "border-gray-200 bg-white"
                          : "border-gray-100 bg-gray-50/70 text-gray-400",
                        isDragging && "opacity-50",
                        isDragOver &&
                          "border-gray-900 bg-gray-50 ring-1 ring-gray-900"
                      )}
                    >
                      {/* Left: Drag Handle (desktop) + Index + Name + Badge */}
                      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
                        <span
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragEnd={handleDragEnd}
                          className="hidden cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing sm:inline-flex"
                          title="Arrastrar para reordenar"
                        >
                          <GripVertical size={15} />
                        </span>

                        <span className="w-5 shrink-0 text-center text-xs font-medium text-gray-400">
                          {idx + 1}
                        </span>

                        <span
                          className={cn(
                            "truncate text-sm font-medium",
                            pill.visible ? "text-gray-900" : "text-gray-500"
                          )}
                        >
                          {pill.name}
                        </span>

                        {origin === "base" && (
                          <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                            Base
                          </span>
                        )}
                        {origin === "product" && (
                          <span className="shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                            Producto
                          </span>
                        )}
                        {origin === "custom" && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            <Sparkles size={10} />
                            <span className="hidden xs:inline">Personalizado</span>
                          </span>
                        )}
                      </div>

                      {/* Right: Move Up/Down + Delete (if custom) + Visibility Switch */}
                      <div className="flex shrink-0 items-center gap-1.5">
                        <div className="flex items-center rounded-md border border-gray-200 bg-white">
                          <button
                            type="button"
                            onClick={() => handleMove(idx, -1)}
                            disabled={idx === 0}
                            title="Subir"
                            className="p-1.5 text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30 sm:p-1"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <div className="h-4 w-px bg-gray-200" />
                          <button
                            type="button"
                            onClick={() => handleMove(idx, 1)}
                            disabled={idx === pills.length - 1}
                            title="Bajar"
                            className="p-1.5 text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30 sm:p-1"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>

                        {origin === "custom" && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomFilter(idx)}
                            title="Eliminar filtro personalizado"
                            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}

                        <div
                          className="flex items-center gap-1 pl-0.5"
                          title={
                            pill.visible
                              ? "Visible en la barra principal"
                              : "Oculto en la barra (solo en cajón Filtros)"
                          }
                        >
                          {pill.visible ? (
                            <Eye size={13} className="hidden text-gray-600 sm:inline" />
                          ) : (
                            <EyeOff size={13} className="hidden text-gray-400 sm:inline" />
                          )}
                          <Switch
                            checked={pill.visible}
                            onCheckedChange={(checked) =>
                              handleToggleVisible(idx, checked)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Mensajes + Footer fijos abajo */}
        <div className="shrink-0 border-t bg-gray-50/80 px-4 py-3 sm:px-6">
          {error && (
            <div className="mb-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
              {successMsg}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500">
              {pills.length} total · {visiblePills.length} en barra
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={saving}
              >
                Cerrar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving || loading}
              >
                {saving && <Loader2 size={13} className="mr-1.5 animate-spin" />}
                Guardar cambios
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
