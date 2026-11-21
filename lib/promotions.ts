import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

export * from "./promotions-client";
import {
  normalizePromoType,
  isPromoDiscountsActive,
  isPromoScheduleExpired,
  type PromoThemePreset,
  type PromoSettingsInput,
  type CategoryWithPricing,
  type ActivePromoContext,
} from "./promotions-client";

export function validatePromoSettings(
  input: PromoSettingsInput,
  categoryNamesMap: Map<string, string>
): { ok: true; sanitized: PromoSettingsInput } | { ok: false; error: string } {
  if (!input.campaignName || !input.campaignName.trim()) {
    return { ok: false, error: "El nombre de la campaña es requerido." };
  }

  const validPresets: PromoThemePreset[] = [
    "black_friday",
    "navidad",
    "san_valentin",
    "dia_madre",
    "generico",
  ];
  if (!validPresets.includes(input.themePreset)) {
    return { ok: false, error: "El tema visual seleccionado no es válido." };
  }

  if (!input.badgeText || !input.badgeText.trim()) {
    return { ok: false, error: "El texto de la etiqueta de producto es requerido." };
  }

  if (input.bannerActive && (!input.bannerTitle || !input.bannerTitle.trim())) {
    return { ok: false, error: "El banner está activo, pero no tiene título." };
  }

  // Validación de fechas
  let startsAtDate: Date | null = null;
  let endsAtDate: Date | null = null;

  if (input.startsAt) {
    startsAtDate = new Date(input.startsAt);
    if (isNaN(startsAtDate.getTime())) {
      return { ok: false, error: "La fecha de inicio no es válida." };
    }
  }

  if (input.endsAt) {
    endsAtDate = new Date(input.endsAt);
    if (isNaN(endsAtDate.getTime())) {
      return { ok: false, error: "La fecha de fin no es válida." };
    }
  }

  if (startsAtDate && endsAtDate) {
    if (endsAtDate.getTime() <= startsAtDate.getTime()) {
      return { ok: false, error: "La fecha de fin debe ser posterior a la fecha de inicio." };
    }
  }

  if ((input.discountsActive || input.bannerActive) && endsAtDate) {
    if (endsAtDate.getTime() <= Date.now()) {
      return {
        ok: false,
        error:
          "La fecha de fin ya pasó: bórrala o cámbiala para volver a activar.",
      };
    }
  }

  // Validación de grupos
  if (!Array.isArray(input.groups)) {
    return { ok: false, error: "La lista de grupos no es válida." };
  }

  const seenCategories = new Map<string, string>(); // normalizedType (trim().toLowerCase()) -> groupName
  const sanitizedGroups: PromoSettingsInput["groups"] = [];

  for (let i = 0; i < input.groups.length; i++) {
    const group = input.groups[i];
    const groupNum = i + 1;
    const groupLabel = group.name?.trim() || `Grupo ${groupNum}`;

    if (!group.name || !group.name.trim()) {
      return { ok: false, error: `El grupo #${groupNum} debe tener un nombre.` };
    }

    const trimmedCategoryIds: string[] = [];
    const seenInThisGroup = new Set<string>();

    if (Array.isArray(group.categoryIds)) {
      for (const rawCatId of group.categoryIds) {
        const trimmed = typeof rawCatId === "string" ? rawCatId.trim() : "";
        if (!trimmed) continue;
        const normalizedKey = normalizePromoType(trimmed);

        if (seenInThisGroup.has(normalizedKey)) continue;

        if (seenCategories.has(normalizedKey)) {
          const existingGroup = seenCategories.get(normalizedKey);
          const catName = categoryNamesMap.get(normalizedKey) || trimmed;
          return {
            ok: false,
            error: `La categoría "${catName}" ya está asignada al grupo "${existingGroup}". Una categoría solo puede pertenecer a un grupo.`,
          };
        }

        seenInThisGroup.add(normalizedKey);
        seenCategories.set(normalizedKey, groupLabel);
        trimmedCategoryIds.push(trimmed);
      }
    }

    if (trimmedCategoryIds.length === 0) {
      return {
        ok: false,
        error: `El grupo "${groupLabel}" necesita al menos una categoría seleccionada.`,
      };
    }

    // Precios: numéricos o null
    const parsePrice = (val: unknown): number | null => {
      if (val === null || val === undefined || val === "") return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    const p3D = parsePrice(group.price3Divisa);
    const p6D = parsePrice(group.price6Divisa);
    const p3B = parsePrice(group.price3Bcv);
    const p6B = parsePrice(group.price6Bcv);

    // Al menos un precio
    const hasAtLeastOnePrice = [p3D, p6D, p3B, p6B].some((p) => p !== null);
    if (!hasAtLeastOnePrice) {
      return {
        ok: false,
        error: `El grupo "${groupLabel}" debe tener al menos un precio configurado (3+ o 6+ piezas en Divisa o BCV).`,
      };
    }

    // Ningún precio puede ser <= 0
    for (const [name, val] of [
      ["Divisa 3+", p3D],
      ["Divisa 6+", p6D],
      ["BCV 3+", p3B],
      ["BCV 6+", p6B],
    ] as const) {
      if (val !== null && val <= 0) {
        return {
          ok: false,
          error: `En el grupo "${groupLabel}", el precio de ${name} debe ser mayor a 0.`,
        };
      }
    }

    // price6 <= price3 cuando ambos existen para cada método de pago
    if (p3D !== null && p6D !== null && p6D > p3D) {
      return {
        ok: false,
        error: `En el grupo "${groupLabel}", el precio para 6+ piezas en Divisa (${p6D}) no puede ser mayor que el precio para 3+ piezas (${p3D}).`,
      };
    }

    if (p3B !== null && p6B !== null && p6B > p3B) {
      return {
        ok: false,
        error: `En el grupo "${groupLabel}", el precio para 6+ piezas en BCV (${p6B}) no puede ser mayor que el precio para 3+ piezas (${p3B}).`,
      };
    }

    sanitizedGroups.push({
      ...group,
      id: group.id || undefined,
      name: group.name.trim(),
      sortOrder: typeof group.sortOrder === "number" ? group.sortOrder : i,
      categoryIds: trimmedCategoryIds,
      price3Divisa: p3D,
      price6Divisa: p6D,
      price3Bcv: p3B,
      price6Bcv: p6B,
    });
  }

  return {
    ok: true,
    sanitized: {
      ...input,
      campaignName: input.campaignName.trim(),
      badgeText: input.badgeText.trim(),
      bannerTitle: input.bannerTitle.trim(),
      bannerSubtitle: input.bannerSubtitle?.trim() || null,
      bannerCtaText: input.bannerCtaText?.trim() || null,
      applyToWeb: input.applyToWeb !== undefined ? Boolean(input.applyToWeb) : true,
      applyToOnline: input.applyToOnline !== undefined ? Boolean(input.applyToOnline) : true,
      applyToStore: Boolean(input.applyToStore),
      startsAt: startsAtDate ? startsAtDate.toISOString() : null,
      endsAt: endsAtDate ? endsAtDate.toISOString() : null,
      groups: sanitizedGroups,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VISTA PREVIA CON TOKEN FIRMADO (HMAC)
// ─────────────────────────────────────────────────────────────────────────────

export function generatePromoPreviewToken(): { token: string; previewUrl: string } {
  const secret = process.env.PROMO_PREVIEW_SECRET || "cenicola_promo_preview_secret_key_2026";
  const storeUrl = (process.env.STORE_URL || "https://cenicolas.com").replace(/\/+$/, "");

  const payload = {
    exp: Math.floor(Date.now() / 1000) + 2 * 60 * 60, // 2 horas de validez
    iat: Math.floor(Date.now() / 1000),
    purpose: "promo-preview",
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payloadBase64).digest("base64url");
  const token = `${payloadBase64}.${signature}`;

  const previewUrl = `${storeUrl}/api/promo-preview?token=${encodeURIComponent(token)}`;

  return { token, previewUrl };
}

// ─────────────────────────────────────────────────────────────────────────────
// REVALIDACIÓN DE LA TIENDA WEB TRAS GUARDAR
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyStorePromoRevalidate(): Promise<{
  success: boolean;
  message: string;
}> {
  const storeUrl = process.env.STORE_URL?.replace(/\/+$/, "");
  const revalidateSecret = process.env.STORE_REVALIDATE_SECRET;

  if (!storeUrl) {
    return {
      success: false,
      message: "Guardado. La tienda se actualizará en un minuto como máximo (STORE_URL no configurado).",
    };
  }

  const endpoint = `${storeUrl}/api/revalidate-promo`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(revalidateSecret ? { "x-revalidate-secret": revalidateSecret } : {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      return {
        success: true,
        message: "Guardado y sincronizado con la tienda web de inmediato.",
      };
    } else {
      console.warn(`[Promo Revalidate] Status ${res.status} from ${endpoint}`);
      return {
        success: false,
        message: "Guardado. La tienda se actualizará en un minuto como máximo.",
      };
    }
  } catch (error) {
    console.warn("[Promo Revalidate] Falló el aviso a la tienda web:", error);
    return {
      success: false,
      message: "Guardado. La tienda se actualizará en un minuto como máximo.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OBTENCIÓN DE CATEGORÍAS DISPONIBLES Y RANGOS DE PRECIO DE REFERENCIA
// ─────────────────────────────────────────────────────────────────────────────

export async function getAvailableCategoriesWithPricing(): Promise<CategoryWithPricing[]> {
  // Consultamos productos activos con sus variantes activas
  const products = await prisma.product.findMany({
    where: { is_active: true },
    select: {
      type: true,
      variants: {
        where: { is_active: true },
        select: {
          price_divisas: true,
          price_bcv: true,
        },
      },
    },
  });

  // Agrupamos por trim().toLowerCase() para unificar tipos que solo difieren en mayúsculas o espacios
  const catMap = new Map<
    string,
    {
      id: string;
      name: string;
      productCount: number;
      minDiv: number | null;
      maxDiv: number | null;
      minBcv: number | null;
      maxBcv: number | null;
    }
  >();

  for (const p of products) {
    const rawType = p.type?.trim();
    if (!rawType) continue;

    const normalizedKey = normalizePromoType(rawType);
    let entry = catMap.get(normalizedKey);
    if (!entry) {
      // Formatear nombre legible y usarlo como identificador limpio (ya sin espacios sobrantes)
      const displayName = rawType
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");

      entry = {
        id: displayName,
        name: displayName,
        productCount: 0,
        minDiv: null,
        maxDiv: null,
        minBcv: null,
        maxBcv: null,
      };
      catMap.set(normalizedKey, entry);
    }

    entry.productCount += 1;

    for (const v of p.variants) {
      const pDiv = Number(v.price_divisas);
      const pBcv = Number(v.price_bcv);

      if (pDiv > 0) {
        entry.minDiv = entry.minDiv === null ? pDiv : Math.min(entry.minDiv, pDiv);
        entry.maxDiv = entry.maxDiv === null ? pDiv : Math.max(entry.maxDiv, pDiv);
      }
      if (pBcv > 0) {
        entry.minBcv = entry.minBcv === null ? pBcv : Math.min(entry.minBcv, pBcv);
        entry.maxBcv = entry.maxBcv === null ? pBcv : Math.max(entry.maxBcv, pBcv);
      }
    }
  }

  return Array.from(catMap.values())
    .map((data) => ({
      id: data.id,
      name: data.name,
      productCount: data.productCount,
      minPriceDivisas: data.minDiv,
      maxPriceDivisas: data.maxDiv,
      minPriceBcv: data.minBcv,
      maxPriceBcv: data.maxBcv,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
}

// ─────────────────────────────────────────────────────────────────────────────
// DESACTIVACIÓN AUTOMÁTICA AL FINALIZAR EL TIEMPO PROGRAMADO
// ─────────────────────────────────────────────────────────────────────────────

const MAX_TIMEOUT_MS = 2_147_483_647; // Límite máximo de setTimeout en Node.js (~24.8 días)

type PromoExpireTimerState = {
  timer: ReturnType<typeof setTimeout> | null;
  scheduledForMs: number | null;
};

const globalForPromoTimer = globalThis as unknown as {
  __promoExpireTimerState?: PromoExpireTimerState;
};

function getPromoTimerState(): PromoExpireTimerState {
  if (!globalForPromoTimer.__promoExpireTimerState) {
    globalForPromoTimer.__promoExpireTimerState = {
      timer: null,
      scheduledForMs: null,
    };
  }
  return globalForPromoTimer.__promoExpireTimerState;
}

export function clearPromoAutoExpireTimer(): void {
  const state = getPromoTimerState();
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.scheduledForMs = null;
}

/**
 * Programa un temporizador en el servidor para desactivar automáticamente los
 * interruptores (descuentos y banner) y revalidar la tienda web en el momento
 * exacto en que vence `endsAt`. Si no hay `endsAt` o ambos interruptores están
 * apagados, limpia cualquier temporizador pendiente (control manual).
 */
export function schedulePromoAutoExpire(
  endsAt: Date | string | null,
  hasActiveSwitch: boolean
): void {
  if (!endsAt || !hasActiveSwitch) {
    clearPromoAutoExpireTimer();
    return;
  }

  const targetMs = new Date(endsAt).getTime();
  if (isNaN(targetMs)) {
    clearPromoAutoExpireTimer();
    return;
  }

  const state = getPromoTimerState();
  // Si ya hay un temporizador exacto para esta fecha, no duplicarlo
  if (state.timer && state.scheduledForMs === targetMs) {
    return;
  }

  clearPromoAutoExpireTimer();

  const delayMs = targetMs - Date.now();
  if (delayMs <= 0) {
    void getPromoSettingsWithAutoExpire().catch((err) => {
      console.warn("[Promo AutoExpire] Error al desactivar promo vencida:", err);
    });
    return;
  }

  const waitMs = Math.min(delayMs + 250, MAX_TIMEOUT_MS);
  state.scheduledForMs = targetMs;
  state.timer = setTimeout(() => {
    state.timer = null;
    state.scheduledForMs = null;

    if (Date.now() < targetMs) {
      // Caso extremo: la fecha estaba a más de 24.8 días, reprogramar
      schedulePromoAutoExpire(new Date(targetMs), true);
      return;
    }

    void getPromoSettingsWithAutoExpire().catch((err) => {
      console.warn("[Promo AutoExpire] Error al ejecutar desactivación automática:", err);
    });
  }, waitMs);

  // Evitar que el temporizador bloquee el apagado limpio del proceso Node
  if (typeof state.timer.unref === "function") {
    state.timer.unref();
  }
}

/**
 * Obtiene la configuración de promociones desde la base de datos.
 * Si tiene `endsAt` configurado y ya venció con algún interruptor encendido,
 * desactiva ambos interruptores (`discountsActive` y `bannerActive`) en BD
 * y notifica a la tienda web para que se quite de inmediato.
 */
export async function getPromoSettingsWithAutoExpire() {
  const settings = await prisma.promoSettings.findUnique({
    where: { id: "default" },
    include: {
      groups: {
        orderBy: { sortOrder: "asc" },
        include: {
          categories: true,
        },
      },
    },
  });

  if (!settings) {
    clearPromoAutoExpireTimer();
    return null;
  }

  const now = new Date();
  if (isPromoScheduleExpired(settings, now)) {
    clearPromoAutoExpireTimer();

    const updated = await prisma.promoSettings.updateMany({
      where: {
        id: "default",
        endsAt: { lte: now },
        OR: [{ discountsActive: true }, { bannerActive: true }],
      },
      data: {
        discountsActive: false,
        bannerActive: false,
      },
    });

    if (updated.count > 0) {
      void notifyStorePromoRevalidate().catch((err) => {
        console.warn("[Promo AutoExpire] Error notificando revalidación a la tienda web:", err);
      });
    }

    return {
      ...settings,
      discountsActive: false,
      bannerActive: false,
    };
  }

  if (settings.endsAt && (settings.discountsActive || settings.bannerActive)) {
    schedulePromoAutoExpire(settings.endsAt, true);
  } else {
    clearPromoAutoExpireTimer();
  }

  return settings;
}

// ─────────────────────────────────────────────────────────────────────────────
// OBTENCIÓN DE PROMOCIÓN ACTIVA PARA UN CANAL DEL HUB ("online" | "tienda")
// ─────────────────────────────────────────────────────────────────────────────

export async function getActivePromoForChannel(
  channel: "online" | "tienda"
): Promise<ActivePromoContext | null> {
  try {
    const settings = await getPromoSettingsWithAutoExpire();

    if (!settings) return null;
    if (!isPromoDiscountsActive(settings)) return null;

    const appliesToChannel =
      channel === "online" ? settings.applyToOnline : settings.applyToStore;
    if (!appliesToChannel) return null;

    return {
      campaignName: settings.campaignName,
      applyToWeb: settings.applyToWeb,
      applyToOnline: settings.applyToOnline,
      applyToStore: settings.applyToStore,
      groups: settings.groups.map((g) => ({
        name: g.name,
        price3Divisa: g.price3Divisa !== null ? Number(g.price3Divisa) : null,
        price6Divisa: g.price6Divisa !== null ? Number(g.price6Divisa) : null,
        price3Bcv: g.price3Bcv !== null ? Number(g.price3Bcv) : null,
        price6Bcv: g.price6Bcv !== null ? Number(g.price6Bcv) : null,
        categoryIds: g.categories.map((c) => c.categoryId),
      })),
    };
  } catch {
    // Si la tabla promo_settings aún no existe (migración pendiente), no rompe las ventas
    return null;
  }
}
