"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Sparkles,
  ExternalLink,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  Check,
  AlertCircle,
  CheckCircle2,
  Info,
  Layers,
  Megaphone,
  DollarSign,
  Loader2,
  Eye,
  X,
} from "lucide-react";
import {
  THEME_PRESETS,
  PromoThemePreset,
  getPromoStatusBadge,
  isPromoDiscountsActive,
  normalizePromoType,
  matchesPromoGroupTypes,
  type CategoryWithPricing,
  type PromoSettingsInput,
} from "@/lib/promotions-client";
import { formatVenezuelaDateTime } from "@/lib/date-utils";

// ─── Utilidades de zona horaria (America/Caracas UTC-4) ────────────────────────

function utcToCaracasInputValue(utcIsoString: string | null): string {
  if (!utcIsoString) return "";
  const d = new Date(utcIsoString);
  if (isNaN(d.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function caracasInputValueToUtcIso(localInputVal: string): string | null {
  if (!localInputVal || !localInputVal.trim()) return null;
  const d = new Date(`${localInputVal}:00-04:00`);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

type ToastNotice = {
  type: "success" | "error" | "info";
  title: string;
  message: string;
};

type GroupFormState = {
  id?: string;
  name: string;
  categoryIds: string[];
  price3Divisa: string;
  price6Divisa: string;
  price3Bcv: string;
  price6Bcv: string;
};

export type SerializedPromoGroup = {
  id?: string;
  name: string;
  sortOrder?: number;
  price3Divisa?: number | null;
  price6Divisa?: number | null;
  price3Bcv?: number | null;
  price6Bcv?: number | null;
  categories: { id: string; groupId: string; categoryId: string }[];
};

export type SerializedPromoSettings = {
  id?: string;
  campaignName: string;
  themePreset: string;
  badgeText: string;
  bannerActive: boolean;
  bannerTitle: string;
  bannerSubtitle?: string | null;
  bannerCtaText?: string | null;
  discountsActive: boolean;
  applyToWeb?: boolean;
  applyToOnline?: boolean;
  applyToStore?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  updatedAt?: string;
  updatedBy?: string | null;
  groups: SerializedPromoGroup[];
};

type Props = {
  initialSettings: SerializedPromoSettings | null;
  categories: CategoryWithPricing[];
  currentUserName: string;
};

export function PromocionesClient({
  initialSettings,
  categories,
  currentUserName,
}: Props) {
  // ─── Estados principales ───────────────────────────────────────────────────
  const [campaignName, setCampaignName] = useState<string>(
    initialSettings?.campaignName ?? "Black Friday 2026"
  );
  const [themePreset, setThemePreset] = useState<PromoThemePreset>(
    (initialSettings?.themePreset as PromoThemePreset) ?? "black_friday"
  );
  const [badgeText, setBadgeText] = useState<string>(
    initialSettings?.badgeText ?? "Black Friday"
  );
  const [bannerActive, setBannerActive] = useState<boolean>(
    initialSettings?.bannerActive ?? false
  );
  const [bannerTitle, setBannerTitle] = useState<string>(
    initialSettings?.bannerTitle ?? "¡Gran Temporada de Ofertas!"
  );
  const [bannerSubtitle, setBannerSubtitle] = useState<string>(
    initialSettings?.bannerSubtitle ?? "Aprovecha descuentos en piezas seleccionadas."
  );
  const [bannerCtaText, setBannerCtaText] = useState<string>(
    initialSettings?.bannerCtaText ?? "Ver ofertas"
  );
  const [discountsActive, setDiscountsActive] = useState<boolean>(
    initialSettings?.discountsActive ?? false
  );
  const [applyToWeb, setApplyToWeb] = useState<boolean>(
    initialSettings?.applyToWeb ?? true
  );
  const [applyToOnline, setApplyToOnline] = useState<boolean>(
    initialSettings?.applyToOnline ?? true
  );
  const [applyToStore, setApplyToStore] = useState<boolean>(
    initialSettings?.applyToStore ?? false
  );
  const [startsAtLocal, setStartsAtLocal] = useState<string>(
    utcToCaracasInputValue(initialSettings?.startsAt ?? null)
  );
  const [endsAtLocal, setEndsAtLocal] = useState<string>(
    utcToCaracasInputValue(initialSettings?.endsAt ?? null)
  );

  const [groups, setGroups] = useState<GroupFormState[]>(() => {
    if (initialSettings?.groups && Array.isArray(initialSettings.groups)) {
      return initialSettings.groups.map((g: SerializedPromoGroup) => ({
        id: g.id,
        name: g.name ?? "",
        categoryIds: g.categories ? g.categories.map((c) => c.categoryId) : [],
        price3Divisa: g.price3Divisa !== null && g.price3Divisa !== undefined ? String(g.price3Divisa) : "",
        price6Divisa: g.price6Divisa !== null && g.price6Divisa !== undefined ? String(g.price6Divisa) : "",
        price3Bcv: g.price3Bcv !== null && g.price3Bcv !== undefined ? String(g.price3Bcv) : "",
        price6Bcv: g.price6Bcv !== null && g.price6Bcv !== undefined ? String(g.price6Bcv) : "",
      }));
    }
    return [];
  });

  const [lastSaved, setLastSaved] = useState<{
    updatedAt: string | null;
    updatedBy: string | null;
  }>({
    updatedAt: initialSettings?.updatedAt ?? null,
    updatedBy: initialSettings?.updatedBy ?? null,
  });

  const [savedSchedule, setSavedSchedule] = useState<{
    discountsActive: boolean;
    bannerActive: boolean;
    startsAt: string | null;
    endsAt: string | null;
  }>({
    discountsActive: initialSettings?.discountsActive ?? false,
    bannerActive: initialSettings?.bannerActive ?? false,
    startsAt: initialSettings?.startsAt ?? null,
    endsAt: initialSettings?.endsAt ?? null,
  });

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const baselineSnapshotRef = useRef<string>("");

  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Registro de estado guardado inicial para comparar isDirty
  const [baselineSnapshot, setBaselineSnapshot] = useState<string>("");

  useEffect(() => {
    baselineSnapshotRef.current = baselineSnapshot;
  }, [baselineSnapshot]);

  useEffect(() => {
    const currentSnapshot = JSON.stringify({
      campaignName,
      themePreset,
      badgeText,
      bannerActive,
      bannerTitle,
      bannerSubtitle,
      bannerCtaText,
      discountsActive,
      applyToWeb,
      applyToOnline,
      applyToStore,
      startsAtLocal,
      endsAtLocal,
      groups,
    });
    if (!baselineSnapshot) {
      setBaselineSnapshot(currentSnapshot);
    } else {
      setIsDirty(currentSnapshot !== baselineSnapshot);
    }
  }, [
    campaignName,
    themePreset,
    badgeText,
    bannerActive,
    bannerTitle,
    bannerSubtitle,
    bannerCtaText,
    discountsActive,
    applyToWeb,
    applyToOnline,
    applyToStore,
    startsAtLocal,
    endsAtLocal,
    groups,
    baselineSnapshot,
  ]);

  // Limpiar toast tras 6 segundos
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Actualizar reloj local cuando llega la fecha de inicio programada
  useEffect(() => {
    const startsAtUtc = caracasInputValueToUtcIso(startsAtLocal);
    if (!startsAtUtc) return;
    const targetMs = new Date(startsAtUtc).getTime();
    if (isNaN(targetMs)) return;
    const delayMs = targetMs - Date.now();
    if (delayMs <= 0 || delayMs > 2_147_483_647) return;

    const timer = setTimeout(() => {
      setNowMs(Date.now());
    }, delayMs + 500);
    return () => clearTimeout(timer);
  }, [startsAtLocal]);

  // Desactivación automática en vivo cuando se cumple la fecha/hora de fin guardada
  useEffect(() => {
    if (
      !savedSchedule.endsAt ||
      (!savedSchedule.discountsActive && !savedSchedule.bannerActive)
    ) {
      return;
    }

    const targetMs = new Date(savedSchedule.endsAt).getTime();
    if (isNaN(targetMs)) return;

    let cancelled = false;
    const MAX_CLIENT_TIMEOUT_MS = 2_147_483_647;
    const delayMs = Math.max(0, targetMs - Date.now() + 1000);

    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (Date.now() < targetMs) {
        setNowMs(Date.now());
        return;
      }

      try {
        // Llamar al servidor para persistir el apagado en BD y revalidar la tienda web
        await fetch("/api/promociones", { cache: "no-store" });
      } catch {
        // Si falla la red momentáneamente, igual reflejamos el vencimiento localmente
      }

      if (cancelled) return;

      setDiscountsActive(false);
      setBannerActive(false);
      setSavedSchedule((prev) => ({
        ...prev,
        discountsActive: false,
        bannerActive: false,
      }));
      setNowMs(Date.now());

      if (baselineSnapshotRef.current) {
        try {
          const parsed = JSON.parse(baselineSnapshotRef.current);
          parsed.discountsActive = false;
          parsed.bannerActive = false;
          setBaselineSnapshot(JSON.stringify(parsed));
        } catch {
          // Ignorar si no se pudo parsear el snapshot previo
        }
      }

      setToast({
        type: "info",
        title: "Tiempo programado finalizado",
        message:
          "Los interruptores de descuentos y banner se desactivaron automáticamente y se quitaron de la tienda web.",
      });
    }, Math.min(delayMs, MAX_CLIENT_TIMEOUT_MS));

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    savedSchedule.endsAt,
    savedSchedule.discountsActive,
    savedSchedule.bannerActive,
    nowMs,
  ]);

  // ─── Mapa de categorías asignadas a otros grupos ───────────────────────────
  // Para deshabilitar en el selector: normalizedType -> groupIndex
  const categoryToGroupMap = useMemo(() => {
    const map = new Map<string, { groupIndex: number; groupName: string }>();
    groups.forEach((g, idx) => {
      g.categoryIds.forEach((catId) => {
        const key = normalizePromoType(catId);
        if (!key) return;
        map.set(key, {
          groupIndex: idx,
          groupName: g.name.trim() || `Grupo ${idx + 1}`,
        });
      });
    });
    return map;
  }, [groups]);

  // ─── Cálculo de estado actual según la regla de activación ─────────────────
  const statusBadge = useMemo(() => {
    const startsAtUtc = caracasInputValueToUtcIso(startsAtLocal);
    const endsAtUtc = caracasInputValueToUtcIso(endsAtLocal);
    return getPromoStatusBadge(
      {
        bannerActive,
        discountsActive,
        applyToWeb,
        applyToOnline,
        applyToStore,
        startsAt: startsAtUtc,
        endsAt: endsAtUtc,
      },
      new Date(nowMs)
    );
  }, [
    bannerActive,
    discountsActive,
    applyToWeb,
    applyToOnline,
    applyToStore,
    startsAtLocal,
    endsAtLocal,
    nowMs,
  ]);

  const isEndsAtExpired = useMemo(() => {
    const endsAtUtc = caracasInputValueToUtcIso(endsAtLocal);
    if (!endsAtUtc) return false;
    return new Date(endsAtUtc).getTime() <= nowMs;
  }, [endsAtLocal, nowMs]);

  // Tema actual seleccionado
  const currentTheme = THEME_PRESETS[themePreset] || THEME_PRESETS.generico;

  // ─── Manejo de Grupos ──────────────────────────────────────────────────────
  function addGroup() {
    setGroups((prev) => [
      ...prev,
      {
        name: `Grupo ${prev.length + 1}`,
        categoryIds: [],
        price3Divisa: "",
        price6Divisa: "",
        price3Bcv: "",
        price6Bcv: "",
      },
    ]);
  }

  function removeGroup(index: number) {
    setGroups((prev) => prev.filter((_, i) => i !== index));
  }

  function moveGroup(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= groups.length) return;
    setGroups((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
  }

  function updateGroup(
    index: number,
    field: keyof GroupFormState,
    value: string | string[]
  ) {
    setGroups((prev) =>
      prev.map((g, i) => (i === index ? { ...g, [field]: value } : g))
    );
  }

  function toggleCategoryInGroup(groupIndex: number, catId: string) {
    const trimmed = catId.trim();
    const targetKey = normalizePromoType(trimmed);
    if (!targetKey) return;

    setGroups((prev) =>
      prev.map((g, i) => {
        if (i !== groupIndex) return g;
        const exists = g.categoryIds.some(
          (id) => normalizePromoType(id) === targetKey
        );
        const next = exists
          ? g.categoryIds.filter((id) => normalizePromoType(id) !== targetKey)
          : [...g.categoryIds, trimmed];
        return { ...g, categoryIds: next };
      })
    );
  }

  // ─── Guardado y Confirmación ───────────────────────────────────────────────
  function handleSaveClick() {
    // Si la configuración va a ACTIVAR los descuentos ahora mismo, pedimos confirmación
    const startsAtUtc = caracasInputValueToUtcIso(startsAtLocal);
    const endsAtUtc = caracasInputValueToUtcIso(endsAtLocal);
    const willBeActiveNow = isPromoDiscountsActive({
      discountsActive,
      startsAt: startsAtUtc,
      endsAt: endsAtUtc,
    });

    // Estado guardado previo
    const wasActivePreviously = isPromoDiscountsActive({
      discountsActive: savedSchedule.discountsActive,
      startsAt: savedSchedule.startsAt,
      endsAt: savedSchedule.endsAt,
    });

    if (willBeActiveNow && !wasActivePreviously) {
      setShowConfirmModal(true);
    } else {
      executeSave();
    }
  }

  async function executeSave() {
    setShowConfirmModal(false);
    setSaving(true);
    setToast(null);

    const startsAtUtc = caracasInputValueToUtcIso(startsAtLocal);
    const endsAtUtc = caracasInputValueToUtcIso(endsAtLocal);

    const payload: PromoSettingsInput = {
      campaignName,
      themePreset,
      badgeText,
      bannerActive,
      bannerTitle,
      bannerSubtitle: bannerSubtitle || null,
      bannerCtaText: bannerCtaText || null,
      discountsActive,
      applyToWeb,
      applyToOnline,
      applyToStore,
      startsAt: startsAtUtc,
      endsAt: endsAtUtc,
      groups: groups.map((g, idx) => ({
        id: g.id,
        name: g.name,
        sortOrder: idx,
        categoryIds: g.categoryIds,
        price3Divisa: g.price3Divisa || null,
        price6Divisa: g.price6Divisa || null,
        price3Bcv: g.price3Bcv || null,
        price6Bcv: g.price6Bcv || null,
      })),
    };

    try {
      const res = await fetch("/api/promociones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setToast({
          type: "error",
          title: "Error de validación",
          message: data.error || "No se pudo guardar la configuración.",
        });
        return;
      }

      // Éxito: actualizamos estado base
      const newSnapshot = JSON.stringify({
        campaignName,
        themePreset,
        badgeText,
        bannerActive,
        bannerTitle,
        bannerSubtitle,
        bannerCtaText,
        discountsActive,
        applyToWeb,
        applyToOnline,
        applyToStore,
        startsAtLocal,
        endsAtLocal,
        groups,
      });
      setBaselineSnapshot(newSnapshot);
      setIsDirty(false);
      setSavedSchedule({
        discountsActive,
        bannerActive,
        startsAt: startsAtUtc,
        endsAt: endsAtUtc,
      });
      setNowMs(Date.now());
      setLastSaved({
        updatedAt: new Date().toISOString(),
        updatedBy: currentUserName,
      });

      const revalidateMsg =
        data.revalidateNotice?.message || "Guardado exitosamente.";

      setToast({
        type: "success",
        title: "¡Configuración guardada!",
        message: revalidateMsg,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al comunicarse con el servidor.";
      setToast({
        type: "error",
        title: "Error de conexión",
        message,
      });
    } finally {
      setSaving(false);
    }
  }

  // ─── Vista previa en la tienda web ─────────────────────────────────────────
  async function handlePreviewClick() {
    if (isDirty) {
      setToast({
        type: "info",
        title: "Cambios pendientes",
        message: "Guarda primero para previsualizar los cambios en la tienda.",
      });
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await fetch("/api/promociones/preview", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data.previewUrl) {
        throw new Error(data.error || "No se pudo generar la vista previa.");
      }

      window.open(data.previewUrl, "_blank", "noopener,noreferrer");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al generar la URL de vista previa.";
      setToast({
        type: "error",
        title: "Error de vista previa",
        message,
      });
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* ─── TOAST FLOTANTE ──────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex max-w-md items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-2xl transition-all animate-in slide-in-from-bottom-5">
          {toast.type === "success" && (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          )}
          {toast.type === "error" && (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          )}
          {toast.type === "info" && (
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          )}
          <div className="flex-1 text-sm">
            <h4 className="font-semibold text-gray-900">{toast.title}</h4>
            <p className="mt-0.5 text-gray-600">{toast.message}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="rounded p-1 text-gray-400 hover:text-gray-600"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ─── MODAL DE CONFIRMACIÓN DE ACTIVACIÓN ─────────────────────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="rounded-full bg-amber-100 p-2.5">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                ¿Activar descuentos ahora?
              </h3>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Los clientes verán los precios promocionales de inmediato en la tienda web. ¿Deseas continuar y guardar los cambios?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Sí, activar y guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── A) CABECERA DE ESTADO Y ACCIONES PRINCIPALES ─────────────────── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-gray-900">
              Promociones Web
            </h1>
            <span
              suppressHydrationWarning
              className={`inline-flex items-center rounded-full px-3.5 py-1 text-xs font-black tracking-wide uppercase ${statusBadge.badgeClass}`}
            >
              {statusBadge.label}
            </span>
          </div>
          <p suppressHydrationWarning className="text-sm text-gray-500">
            {statusBadge.description}
          </p>
          {lastSaved.updatedAt && (
            <p suppressHydrationWarning className="text-xs text-gray-400">
              Último guardado:{" "}
              {formatVenezuelaDateTime(lastSaved.updatedAt).replace(/[\u00a0\u202f]/g, " ")}{" "}
              {lastSaved.updatedBy ? `por ${lastSaved.updatedBy}` : ""}
            </p>
          )}
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handlePreviewClick}
            disabled={previewLoading}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all ${
              isDirty
                ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
            }`}
            title={
              isDirty
                ? "Guarda primero para previsualizar los cambios"
                : "Abre la tienda web con el token de vista previa de 2 horas"
            }
          >
            {previewLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            Vista previa en la tienda
          </button>

          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-black transition-all disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar cambios
          </button>
        </div>
      </div>

      {isDirty && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>Tienes modificaciones sin guardar en la promoción.</span>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            No guardado
          </span>
        </div>
      )}

      {/* ─── GRID DE CONFIGURACIÓN ───────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ─── B) TARJETA "CAMPAÑA" ─────────────────────────────────────── */}
        <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
            <Sparkles className="h-5 w-5 text-gray-700" />
            <h2 className="text-base font-bold text-gray-900">
              Campaña y Preset Visual
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                Nombre de la Campaña *
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ej. Black Friday 2026, Especial San Valentín"
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <p className="mt-1 text-xs text-gray-400">
                Nombre identificativo para reportes y auditoría del Hub.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                Tema Visual
              </label>
              <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {Object.values(THEME_PRESETS).map((preset) => {
                  const isSelected = themePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setThemePreset(preset.id)}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? "border-gray-900 bg-gray-50/80 shadow-sm ring-1 ring-gray-900"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/40"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-sm font-bold text-gray-900">
                          {preset.name}
                        </span>
                        {/* Muestra de color (swatch) */}
                        <div className="flex items-center gap-1">
                          {preset.swatchColors.map((hex, sIdx) => (
                            <span
                              key={sIdx}
                              className="h-3.5 w-3.5 rounded-full border border-black/10 shadow-inner"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="mt-1 text-[11px] text-gray-500 line-clamp-2">
                        {preset.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                Texto de la Etiqueta de Producto *
              </label>
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  type="text"
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value)}
                  placeholder="Ej. Black Friday, 30% OFF, Oferta"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
                <div className="shrink-0">
                  <span
                    className={`inline-block rounded-md px-2.5 py-1 text-xs shadow-sm ${currentTheme.badgePreviewClass}`}
                  >
                    {badgeText || "Etiqueta"}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Esta etiqueta aparecerá sobre las fotos de los productos en promoción.
              </p>
            </div>
          </div>
        </div>

        {/* ─── D) TARJETA "DESCUENTOS" ───────────────────────────────────── */}
        <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
            <DollarSign className="h-5 w-5 text-gray-700" />
            <h2 className="text-base font-bold text-gray-900">
              Vigencia y Activación de Descuentos
            </h2>
          </div>

          <div className="space-y-5">
            {/* Switch descuentosActive */}
            <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4 border border-gray-100">
              <div className="space-y-0.5 pr-4">
                <span className="text-sm font-bold text-gray-900">
                  Interruptor General de Descuentos
                </span>
                <p className="text-xs text-gray-500">
                  Si está apagado, ningún descuento promocional aplicará, aunque las fechas coincidan.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={discountsActive}
                  onChange={(e) => setDiscountsActive(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
              </label>
            </div>

            {/* Canales donde aplica */}
            <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <span className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                Canales donde aplica el descuento
              </span>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-xs text-gray-700">
                  <div>
                    <span className="font-semibold text-gray-800">
                      Tienda Web
                    </span>
                    <p className="text-[11px] text-gray-500">
                      Aplica los precios promocionales en el catálogo y checkout de la tienda web.
                    </p>
                  </div>
                  <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={applyToWeb}
                      onChange={(e) => setApplyToWeb(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs text-gray-700">
                  <div>
                    <span className="font-semibold text-gray-800">
                      Hub — Ventas Online / WhatsApp
                    </span>
                    <p className="text-[11px] text-gray-500">
                      Aplica al registrar pedidos de WhatsApp y carritos del canal online.
                    </p>
                  </div>
                  <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={applyToOnline}
                      onChange={(e) => setApplyToOnline(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs text-gray-700">
                  <div>
                    <span className="font-semibold text-gray-800">
                      Hub — Tienda Física
                    </span>
                    <p className="text-[11px] text-gray-500">
                      Aplica también en ventas presenciales (vendedora tienda).
                    </p>
                  </div>
                  <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={applyToStore}
                      onChange={(e) => setApplyToStore(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                  Fecha y Hora de Inicio (Caracas)
                </label>
                <input
                  type="datetime-local"
                  value={startsAtLocal}
                  onChange={(e) => setStartsAtLocal(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
                {startsAtLocal && (
                  <button
                    type="button"
                    onClick={() => setStartsAtLocal("")}
                    className="mt-1 text-xs text-red-500 hover:underline"
                  >
                    Limpiar inicio
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                  Fecha y Hora de Fin (Caracas)
                </label>
                <input
                  type="datetime-local"
                  value={endsAtLocal}
                  onChange={(e) => setEndsAtLocal(e.target.value)}
                  className={`mt-1.5 w-full rounded-lg border px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-1 ${
                    isEndsAtExpired
                      ? "border-amber-400 bg-amber-50/40 focus:border-amber-500 focus:ring-amber-500"
                      : "border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                  }`}
                />
                {endsAtLocal && (
                  <button
                    type="button"
                    onClick={() => setEndsAtLocal("")}
                    className="mt-1 text-xs text-red-500 hover:underline"
                  >
                    Limpiar fin
                  </button>
                )}
              </div>
            </div>

            {isEndsAtExpired && (
              <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="font-semibold">
                    La fecha de fin ya pasó: bórrala o cámbiala para volver a activar
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEndsAtLocal("")}
                  className="shrink-0 self-start rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 sm:self-auto"
                >
                  Borrar fecha de fin
                </button>
              </div>
            )}

            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs text-blue-800">
              <div className="flex items-start gap-2">
                <Info size={16} className="mt-0.5 shrink-0 text-blue-600" />
                <div>
                  <p className="font-semibold">
                    Regla de fechas opcionales:
                  </p>
                  <p className="mt-0.5">
                    Si dejas las fechas vacías, los interruptores mandan de forma manual hasta que los apagues. Si defines fecha y hora de fin, al cumplirse se desactivarán automáticamente los descuentos y el banner en la tienda web (hora de Venezuela, UTC-4).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── C) TARJETA "BANNER WEB" Y PREVISUALIZACIÓN EN VIVO ────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-gray-700" />
            <h2 className="text-base font-bold text-gray-900">
              Banner Informativo Web
            </h2>
          </div>
          {/* Switch bannerActive */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              {bannerActive ? "Banner Activo" : "Banner Oculto"}
            </span>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={bannerActive}
                onChange={(e) => setBannerActive(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
            </label>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              Título del Banner {bannerActive && "*"}
            </label>
            <input
              type="text"
              value={bannerTitle}
              onChange={(e) => setBannerTitle(e.target.value)}
              placeholder="Ej. ¡Semana Black Friday Cenicola!"
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              Subtítulo (Opcional)
            </label>
            <input
              type="text"
              value={bannerSubtitle}
              onChange={(e) => setBannerSubtitle(e.target.value)}
              placeholder="Ej. Precios al mayor a partir de 3 piezas."
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              Texto del Botón (CTA)
            </label>
            <input
              type="text"
              value={bannerCtaText}
              onChange={(e) => setBannerCtaText(e.target.value)}
              placeholder="Ej. Ver ofertas, Comprar ahora"
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
        </div>

        {/* Previsualización en vivo del banner */}
        <div className="mt-6 border-t border-gray-100 pt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
              <Eye size={14} />
              Previsualización en vivo en la tienda web
            </span>
            <span className="text-xs text-gray-400">
              Estilo: {currentTheme.name}
            </span>
          </div>

          <div
            className={`relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 ${currentTheme.bannerContainerClass}`}
          >
            <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <span
                    className={`inline-block rounded-md px-2 py-0.5 text-[11px] ${currentTheme.badgePreviewClass}`}
                  >
                    {badgeText || "OFERTA"}
                  </span>
                  <h3
                    className={`text-lg sm:text-xl md:text-2xl ${currentTheme.bannerTitleClass}`}
                  >
                    {bannerTitle || "Título del banner de promoción"}
                  </h3>
                </div>
                {bannerSubtitle && (
                  <p
                    className={`text-sm md:text-base ${currentTheme.bannerSubtitleClass}`}
                  >
                    {bannerSubtitle}
                  </p>
                )}
              </div>

              {bannerCtaText && (
                <button
                  type="button"
                  className={`shrink-0 rounded-xl px-5 py-2.5 text-sm transition-all ${currentTheme.bannerButtonClass}`}
                >
                  {bannerCtaText}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── E) TARJETA "GRUPOS DE DESCUENTO" ────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-gray-700" />
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Grupos de Descuento por Categoría
              </h2>
              <p className="text-xs text-gray-500">
                Configura tarifas especiales por volumen (3+ y 6+ piezas) para cada grupo de categorías.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={addGroup}
            className="flex items-center gap-1.5 self-start rounded-lg bg-gray-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-black transition-all sm:self-auto"
          >
            <Plus size={15} />
            Añadir grupo
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="my-8 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
            <div className="rounded-full bg-gray-100 p-3 text-gray-400">
              <Layers size={28} />
            </div>
            <h3 className="mt-3 text-sm font-bold text-gray-900">
              No hay grupos de descuento creados
            </h3>
            <p className="mt-1 max-w-sm text-xs text-gray-500">
              Añade al menos un grupo con sus categorías asociadas y sus precios promocionales para activar los descuentos en la tienda.
            </p>
            <button
              type="button"
              onClick={addGroup}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-black transition-all"
            >
              <Plus size={14} />
              Crear primer grupo
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {groups.map((group, groupIdx) => {
              // Precios de referencia de las categorías seleccionadas en este grupo
              const groupCats = categories.filter((c) =>
                matchesPromoGroupTypes(c.id, group.categoryIds)
              );

              const divMins = groupCats
                .map((c) => c.minPriceDivisas)
                .filter((v): v is number => v !== null);
              const divMaxs = groupCats
                .map((c) => c.maxPriceDivisas)
                .filter((v): v is number => v !== null);
              const minDivRef = divMins.length > 0 ? Math.min(...divMins) : null;
              const maxDivRef = divMaxs.length > 0 ? Math.max(...divMaxs) : null;

              const bcvMins = groupCats
                .map((c) => c.minPriceBcv)
                .filter((v): v is number => v !== null);
              const bcvMaxs = groupCats
                .map((c) => c.maxPriceBcv)
                .filter((v): v is number => v !== null);
              const minBcvRef = bcvMins.length > 0 ? Math.min(...bcvMins) : null;
              const maxBcvRef = bcvMaxs.length > 0 ? Math.max(...bcvMaxs) : null;

              const formatRef = (min: number | null, max: number | null) => {
                if (min === null || max === null) return "Sin ref.";
                if (min === max) return `$${min.toFixed(2)}`;
                return `$${min.toFixed(2)} - $${max.toFixed(2)}`;
              };

              return (
                <div
                  key={groupIdx}
                  className="rounded-2xl border border-gray-200 bg-gray-50/50 p-5 shadow-sm transition-all hover:border-gray-300"
                >
                  {/* Cabecera del grupo con reordenación y eliminar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                        {groupIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={group.name}
                        onChange={(e) =>
                          updateGroup(groupIdx, "name", e.target.value)
                        }
                        placeholder="Nombre del grupo (ej. Grupo 1 - Franelas)"
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-bold text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => moveGroup(groupIdx, -1)}
                        disabled={groupIdx === 0}
                        className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                        title="Subir grupo"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveGroup(groupIdx, 1)}
                        disabled={groupIdx === groups.length - 1}
                        className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                        title="Bajar grupo"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGroup(groupIdx)}
                        className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                        title="Eliminar grupo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-6 lg:grid-cols-12">
                    {/* Selector múltiple de categorías con buscador */}
                    <div className="space-y-2 lg:col-span-5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                        Categorías Asociadas ({group.categoryIds.length})
                      </label>
                      <CategorySelector
                        allCategories={categories}
                        selectedCategoryIds={group.categoryIds}
                        currentGroupIndex={groupIdx}
                        categoryToGroupMap={categoryToGroupMap}
                        onToggleCategory={(catId) =>
                          toggleCategoryInGroup(groupIdx, catId)
                        }
                      />
                      <p className="text-[11px] leading-snug text-gray-500">
                        La promo se aplica según el campo Tipo de cada producto. Si creas productos nuevos, usa exactamente el mismo tipo.
                      </p>
                    </div>

                    {/* Tabla 2x2 de precios */}
                    <div className="space-y-2 lg:col-span-7">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                          Tabla de Precios Promocionales
                        </label>
                        <span className="text-[11px] text-gray-400">
                          Precios unitarios en USD
                        </span>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-gray-200 bg-gray-100/75 text-gray-700">
                            <tr>
                              <th className="py-2.5 px-3 font-bold">Escala</th>
                              <th className="py-2.5 px-3 font-bold">
                                Divisa (USD)
                              </th>
                              <th className="py-2.5 px-3 font-bold">
                                BCV (Bs / Tasa oficial)
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {/* Fila 3+ piezas */}
                            <tr>
                              <td className="py-2 px-3 font-bold text-gray-900">
                                3+ piezas
                              </td>
                              <td className="py-2 px-3">
                                <div className="space-y-0.5">
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-1.5 text-gray-400">
                                      $
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      value={group.price3Divisa}
                                      onChange={(e) =>
                                        updateGroup(
                                          groupIdx,
                                          "price3Divisa",
                                          e.target.value
                                        )
                                      }
                                      placeholder="0.00"
                                      className="w-full rounded-md border border-gray-300 py-1 pl-6 pr-2 text-xs font-medium text-gray-900 focus:border-gray-900 focus:outline-none"
                                    />
                                  </div>
                                  <span className="block text-[10px] text-gray-400">
                                    Ref: {formatRef(minDivRef, maxDivRef)}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <div className="space-y-0.5">
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-1.5 text-gray-400">
                                      $
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      value={group.price3Bcv}
                                      onChange={(e) =>
                                        updateGroup(
                                          groupIdx,
                                          "price3Bcv",
                                          e.target.value
                                        )
                                      }
                                      placeholder="0.00"
                                      className="w-full rounded-md border border-gray-300 py-1 pl-6 pr-2 text-xs font-medium text-gray-900 focus:border-gray-900 focus:outline-none"
                                    />
                                  </div>
                                  <span className="block text-[10px] text-gray-400">
                                    Ref: {formatRef(minBcvRef, maxBcvRef)}
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {/* Fila 6+ piezas */}
                            <tr>
                              <td className="py-2 px-3 font-bold text-gray-900">
                                6+ piezas
                              </td>
                              <td className="py-2 px-3">
                                <div className="space-y-0.5">
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-1.5 text-gray-400">
                                      $
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      value={group.price6Divisa}
                                      onChange={(e) =>
                                        updateGroup(
                                          groupIdx,
                                          "price6Divisa",
                                          e.target.value
                                        )
                                      }
                                      placeholder="0.00"
                                      className="w-full rounded-md border border-gray-300 py-1 pl-6 pr-2 text-xs font-medium text-gray-900 focus:border-gray-900 focus:outline-none"
                                    />
                                  </div>
                                  <span className="block text-[10px] text-gray-400">
                                    Ref: {formatRef(minDivRef, maxDivRef)}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <div className="space-y-0.5">
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-1.5 text-gray-400">
                                      $
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      value={group.price6Bcv}
                                      onChange={(e) =>
                                        updateGroup(
                                          groupIdx,
                                          "price6Bcv",
                                          e.target.value
                                        )
                                      }
                                      placeholder="0.00"
                                      className="w-full rounded-md border border-gray-300 py-1 pl-6 pr-2 text-xs font-medium text-gray-900 focus:border-gray-900 focus:outline-none"
                                    />
                                  </div>
                                  <span className="block text-[10px] text-gray-400">
                                    Ref: {formatRef(minBcvRef, maxBcvRef)}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[10px] text-gray-400">
                        * Regla de validación: el precio de 6+ piezas debe ser menor o igual que el de 3+ piezas.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── BARRA FLOTANTE DE ACCIÓN ─────────────────────────────────────── */}
      <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-2xl border border-gray-200 bg-white/95 px-6 py-4 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div
            className={`h-3 w-3 rounded-full ${
              isDirty ? "bg-amber-500 animate-ping" : "bg-emerald-500"
            }`}
          />
          <span className="text-xs font-medium text-gray-600 sm:text-sm">
            {isDirty
              ? "Modificaciones pendientes de guardar"
              : "Configuración guardada y al día"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePreviewClick}
            disabled={previewLoading}
            className="hidden rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 sm:flex sm:items-center sm:gap-2"
          >
            {previewLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ExternalLink size={14} />
            )}
            Vista previa
          </button>

          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-black transition-all disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Save size={16} />
            )}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE SELECTOR MÚLTIPLE DE CATEGORÍAS CON BUSCADOR ─────────────────

function CategorySelector({
  allCategories,
  selectedCategoryIds,
  currentGroupIndex,
  categoryToGroupMap,
  onToggleCategory,
}: {
  allCategories: CategoryWithPricing[];
  selectedCategoryIds: string[];
  currentGroupIndex: number;
  categoryToGroupMap: Map<string, { groupIndex: number; groupName: string }>;
  onToggleCategory: (catId: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCategories;
    return allCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }, [allCategories, search]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      {/* Buscador */}
      <div className="relative mb-2.5">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar categorías..."
          className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-xs text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Chips de categorías seleccionadas */}
      {selectedCategoryIds.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5 border-b border-gray-100 pb-2">
          {selectedCategoryIds.map((catId) => {
            const cat = allCategories.find(
              (c) => normalizePromoType(c.id) === normalizePromoType(catId)
            );
            return (
              <span
                key={catId}
                className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-2 py-0.5 text-[11px] font-semibold text-white"
              >
                {cat?.name || catId.trim()}
                <button
                  type="button"
                  onClick={() => onToggleCategory(catId)}
                  className="rounded hover:text-red-300"
                >
                  <X size={11} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Lista scrolleable de categorías */}
      <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
        {filteredCategories.length === 0 ? (
          <p className="py-2 text-center text-xs text-gray-400">
            No se encontraron categorías.
          </p>
        ) : (
          filteredCategories.map((cat) => {
            const isSelected = matchesPromoGroupTypes(cat.id, selectedCategoryIds);
            const assigned = categoryToGroupMap.get(normalizePromoType(cat.id));
            const isAssignedToOther =
              assigned && assigned.groupIndex !== currentGroupIndex;

            return (
              <button
                key={cat.id}
                type="button"
                disabled={Boolean(isAssignedToOther)}
                onClick={() => onToggleCategory(cat.id)}
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                  isSelected
                    ? "bg-gray-100 font-bold text-gray-900"
                    : isAssignedToOther
                    ? "cursor-not-allowed bg-gray-50 text-gray-400"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-300 bg-white"
                    }`}
                  >
                    {isSelected && <Check size={11} />}
                  </div>
                  <span>{cat.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">
                    {cat.productCount}{" "}
                    {cat.productCount === 1 ? "producto activo" : "productos activos"}
                  </span>
                  {isAssignedToOther && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      en {assigned?.groupName}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
