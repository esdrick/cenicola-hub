import { formatVenezuelaDateTime } from "@/lib/date-utils";

// ─────────────────────────────────────────────────────────────────────────────
// REGLA ÚNICA DE ACTIVACIÓN
// (Documéntala en un comentario; la tienda web cenicola-store-web usará exactamente la misma):
//
// descuentosVigentes    = discountsActive && (startsAt == null || ahora >= startsAt) && (endsAt == null || ahora < endsAt)
// descuentosVigentesWeb = descuentosVigentes && applyToWeb
// bannerVigente         = bannerActive && (endsAt == null || ahora < endsAt)
// ─────────────────────────────────────────────────────────────────────────────

export function isPromoDiscountsActive(
  settings: {
    discountsActive: boolean;
    startsAt: Date | string | null;
    endsAt: Date | string | null;
  },
  now: Date = new Date()
): boolean {
  if (!settings.discountsActive) return false;

  const nowMs = now.getTime();

  if (settings.startsAt) {
    const startsAtMs = new Date(settings.startsAt).getTime();
    if (nowMs < startsAtMs) return false;
  }

  if (settings.endsAt) {
    const endsAtMs = new Date(settings.endsAt).getTime();
    if (nowMs >= endsAtMs) return false;
  }

  return true;
}

export function isPromoBannerActive(
  settings: {
    bannerActive: boolean;
    endsAt: Date | string | null;
  },
  now: Date = new Date()
): boolean {
  if (!settings.bannerActive) return false;

  if (settings.endsAt) {
    const endsAtMs = new Date(settings.endsAt).getTime();
    if (now.getTime() >= endsAtMs) return false;
  }

  return true;
}

export function isPromoScheduleExpired(
  settings: {
    discountsActive: boolean;
    bannerActive: boolean;
    endsAt: Date | string | null;
  },
  now: Date = new Date()
): boolean {
  if (!settings.endsAt) return false;
  if (!settings.discountsActive && !settings.bannerActive) return false;
  return now.getTime() >= new Date(settings.endsAt).getTime();
}

export type PromoStatusState = "activa" | "programada" | "banner_solo" | "apagada";

export type PromoStatusBadge = {
  status: PromoStatusState;
  label: string;
  description?: string;
  badgeClass: string;
};

export function getPromoStatusBadge(
  settings: {
    bannerActive: boolean;
    discountsActive: boolean;
    applyToWeb?: boolean;
    applyToOnline?: boolean;
    applyToStore?: boolean;
    startsAt: Date | string | null;
    endsAt: Date | string | null;
  },
  now: Date = new Date()
): PromoStatusBadge {
  const discountsActive = isPromoDiscountsActive(settings, now);

  const activeChannels: string[] = [];
  if (settings.applyToWeb ?? true) activeChannels.push("Web");
  if (settings.applyToOnline ?? true) activeChannels.push("Online");
  if (settings.applyToStore ?? false) activeChannels.push("Tienda Física");

  if (discountsActive) {
    if (activeChannels.length > 0) {
      return {
        status: "activa",
        label: `ACTIVA: ${activeChannels.join(" + ")}`,
        description: `Los descuentos y precios promocionales están vigentes en: ${activeChannels.join(", ")}.`,
        badgeClass: "bg-emerald-600 text-white border-emerald-500 shadow-sm animate-pulse",
      };
    }
    return {
      status: "activa",
      label: "ACTIVA (SIN CANALES)",
      description:
        "El interruptor de descuentos está encendido, pero no hay ningún canal seleccionado.",
      badgeClass: "bg-amber-600 text-white border-amber-500 shadow-sm",
    };
  }

  if (settings.discountsActive && settings.startsAt) {
    const startsAtDate = new Date(settings.startsAt);
    if (now.getTime() < startsAtDate.getTime()) {
      const fechaCaracas = formatVenezuelaDateTime(startsAtDate);
      const canalesTexto =
        activeChannels.length > 0 ? ` (${activeChannels.join(" + ")})` : "";
      return {
        status: "programada",
        label: `PROGRAMADA${canalesTexto} — empieza el ${fechaCaracas}`,
        description: `Los precios promocionales se activarán automáticamente el ${fechaCaracas}.`,
        badgeClass: "bg-amber-500 text-white border-amber-400 shadow-sm",
      };
    }
  }

  if (isPromoBannerActive(settings, now)) {
    return {
      status: "banner_solo",
      label: "BANNER ACTIVO, DESCUENTOS APAGADOS",
      description: "El banner informativo está visible en la web, pero no aplican descuentos en el checkout.",
      badgeClass: "bg-blue-600 text-white border-blue-500 shadow-sm",
    };
  }

  return {
    status: "apagada",
    label: "APAGADA",
    description: "No hay promociones ni banners activos en la tienda web.",
    badgeClass: "bg-gray-200 text-gray-700 border-gray-300",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESETS TEMÁTICOS VISUALES
// ─────────────────────────────────────────────────────────────────────────────

export type PromoThemePreset =
  | "black_friday"
  | "navidad"
  | "san_valentin"
  | "dia_madre"
  | "generico";

export interface PromoThemeConfig {
  id: PromoThemePreset;
  name: string;
  description: string;
  swatchColors: [string, string, string];
  bannerContainerClass: string;
  bannerTitleClass: string;
  bannerSubtitleClass: string;
  bannerButtonClass: string;
  badgePreviewClass: string;
}

export const THEME_PRESETS: Record<PromoThemePreset, PromoThemeConfig> = {
  black_friday: {
    id: "black_friday",
    name: "Black Friday",
    description: "Fondo negro carbón con toques dorado / amarillo de alto impacto",
    swatchColors: ["#09090b", "#facc15", "#ffffff"],
    bannerContainerClass: "bg-neutral-950 text-white border-yellow-500/40 shadow-lg",
    bannerTitleClass: "text-yellow-400 font-black tracking-wide",
    bannerSubtitleClass: "text-neutral-300",
    bannerButtonClass: "bg-yellow-400 text-neutral-950 hover:bg-yellow-300 font-bold shadow-md",
    badgePreviewClass: "bg-yellow-400 text-neutral-950 font-bold",
  },
  navidad: {
    id: "navidad",
    name: "Navidad",
    description: "Rojo festivo con acentos verde pino y blanco nieve",
    swatchColors: ["#991b1b", "#166534", "#fef08a"],
    bannerContainerClass: "bg-gradient-to-r from-red-900 via-red-800 to-green-900 text-white border-red-500/40 shadow-lg",
    bannerTitleClass: "text-amber-200 font-black tracking-wide",
    bannerSubtitleClass: "text-red-100",
    bannerButtonClass: "bg-amber-300 text-red-950 hover:bg-amber-200 font-bold shadow-md",
    badgePreviewClass: "bg-red-700 text-white font-bold",
  },
  san_valentin: {
    id: "san_valentin",
    name: "San Valentín",
    description: "Rosa pasión y carmesí con acentos en blanco crema",
    swatchColors: ["#be123c", "#fb7185", "#fff1f2"],
    bannerContainerClass: "bg-gradient-to-r from-rose-700 via-pink-600 to-rose-800 text-white border-rose-400/40 shadow-lg",
    bannerTitleClass: "text-white font-black tracking-wide drop-shadow-sm",
    bannerSubtitleClass: "text-rose-100",
    bannerButtonClass: "bg-white text-rose-700 hover:bg-rose-50 font-bold shadow-md",
    badgePreviewClass: "bg-rose-600 text-white font-bold",
  },
  dia_madre: {
    id: "dia_madre",
    name: "Día de la Madre",
    description: "Violeta y magenta suave con toques florales elegantes",
    swatchColors: ["#86198f", "#e879f9", "#fae8ff"],
    bannerContainerClass: "bg-gradient-to-r from-fuchsia-900 via-purple-800 to-pink-700 text-white border-fuchsia-400/40 shadow-lg",
    bannerTitleClass: "text-fuchsia-100 font-black tracking-wide drop-shadow-sm",
    bannerSubtitleClass: "text-purple-200",
    bannerButtonClass: "bg-fuchsia-100 text-purple-950 hover:bg-white font-bold shadow-md",
    badgePreviewClass: "bg-fuchsia-700 text-white font-bold",
  },
  generico: {
    id: "generico",
    name: "Genérico",
    description: "Azul profundo con cian vibrante para cualquier ocasión o liquidación",
    swatchColors: ["#0f172a", "#3b82f6", "#f8fafc"],
    bannerContainerClass: "bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white border-blue-500/40 shadow-lg",
    bannerTitleClass: "text-blue-300 font-black tracking-wide",
    bannerSubtitleClass: "text-slate-200",
    bannerButtonClass: "bg-blue-500 text-white hover:bg-blue-400 font-bold shadow-md",
    badgePreviewClass: "bg-blue-600 text-white font-bold",
  },
};

export type PromoGroupInput = {
  id?: string;
  name: string;
  sortOrder?: number;
  categoryIds: string[];
  price3Divisa?: number | string | null;
  price6Divisa?: number | string | null;
  price3Bcv?: number | string | null;
  price6Bcv?: number | string | null;
};

export type PromoSettingsInput = {
  campaignName: string;
  themePreset: PromoThemePreset;
  badgeText: string;
  bannerActive: boolean;
  bannerTitle: string;
  bannerSubtitle?: string | null;
  bannerCtaText?: string | null;
  discountsActive: boolean;
  applyToWeb?: boolean;
  applyToOnline?: boolean;
  applyToStore?: boolean;
  startsAt?: string | null; // ISO string o YYYY-MM-DDTHH:mm
  endsAt?: string | null;   // ISO string o YYYY-MM-DDTHH:mm
  groups: PromoGroupInput[];
};

export type CategoryWithPricing = {
  id: string;
  name: string;
  productCount: number;
  minPriceDivisas: number | null;
  maxPriceDivisas: number | null;
  minPriceBcv: number | null;
  maxPriceBcv: number | null;
};

/**
 * Normaliza un tipo de producto para comparaciones insensibles a mayúsculas y espacios.
 */
export function normalizePromoType(type: string): string {
  return type.trim().toLowerCase();
}

/**
 * Compara un `product.type` con los tipos de un grupo promocional usando `trim().toLowerCase()` en ambos lados.
 */
export function matchesPromoGroupTypes(
  productType: string | null | undefined,
  groupTypes: string[]
): boolean {
  if (!productType) return false;
  const target = normalizePromoType(productType);
  if (!target) return false;
  return groupTypes.some((t) => normalizePromoType(t) === target);
}

export type ActivePromoGroup = {
  name: string;
  price3Divisa: number | null;
  price6Divisa: number | null;
  price3Bcv: number | null;
  price6Bcv: number | null;
  categoryIds: string[];
};

export type ActivePromoContext = {
  campaignName: string;
  applyToWeb: boolean;
  applyToOnline: boolean;
  applyToStore: boolean;
  groups: ActivePromoGroup[];
};

export type PromoPriceResolution = {
  promoPrice: number;
  promoCampaignName: string;
  promoGroupName: string;
  promoTier: 3 | 6;
};

/**
 * Resuelve el precio promocional de un artículo según su `product.type`, el método de pago
 * ("bcv" | "divisas") y el total de piezas del carrito/pedido (`totalItems`).
 * Respeta exactamente la misma escala global del Hub (bundleThreshold=3, mayorThreshold=6).
 */
export function resolvePromoPriceForProduct(
  promo: ActivePromoContext | null | undefined,
  productType: string | null | undefined,
  method: "bcv" | "divisas",
  totalItems: number,
  mayorThreshold: number,
  bundleThreshold: number
): PromoPriceResolution | null {
  if (!promo || !productType || totalItems < bundleThreshold) return null;

  const group = promo.groups.find((g) =>
    matchesPromoGroupTypes(productType, g.categoryIds)
  );
  if (!group) return null;

  const p6 = method === "bcv" ? group.price6Bcv : group.price6Divisa;
  const p3 = method === "bcv" ? group.price3Bcv : group.price3Divisa;

  if (totalItems >= mayorThreshold) {
    if (p6 !== null && p6 > 0) {
      return {
        promoPrice: p6,
        promoCampaignName: promo.campaignName,
        promoGroupName: group.name,
        promoTier: 6,
      };
    }
    if (p3 !== null && p3 > 0) {
      return {
        promoPrice: p3,
        promoCampaignName: promo.campaignName,
        promoGroupName: group.name,
        promoTier: 3,
      };
    }
    return null;
  }

  if (totalItems >= bundleThreshold && p3 !== null && p3 > 0) {
    return {
      promoPrice: p3,
      promoCampaignName: promo.campaignName,
      promoGroupName: group.name,
      promoTier: 3,
    };
  }

  return null;
}
