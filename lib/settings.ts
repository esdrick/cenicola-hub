import { prisma } from "./prisma";

export const SETTING_DEFAULTS = {
  low_stock_threshold: 3,
  bundle_threshold: 3,
  mayor_threshold: 6,
  quick_sale_limit: 4,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting(key: SettingKey): Promise<number> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row) return SETTING_DEFAULTS[key];
  const parsed = parseInt(row.value, 10);
  return isNaN(parsed) ? SETTING_DEFAULTS[key] : parsed;
}

export async function getCustomColors(): Promise<string[]> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: "custom_colors" },
  });
  if (!row || !row.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string" && c.trim().length > 0) : [];
  } catch {
    return [];
  }
}

export async function saveCustomColor(color: string | null | undefined, userId?: string): Promise<void> {
  if (!color) return;
  const trimmed = color.trim();
  if (!trimmed) return;

  const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  const existing = await getCustomColors();
  const set = new Set(existing.map((c) => c.toLowerCase()));

  if (!set.has(formatted.toLowerCase())) {
    const updated = [...existing, formatted];
    await prisma.systemSetting.upsert({
      where: { key: "custom_colors" },
      update: { value: JSON.stringify(updated), ...(userId && { updated_by: userId }) },
      create: { key: "custom_colors", value: JSON.stringify([formatted]), ...(userId && { updated_by: userId }) },
    });
  }
}

// ─── Píldoras de filtros del catálogo web (store_catalog_pills) ──────────────

export type CatalogPill = {
  name: string;
  visible: boolean;
};

export const STORE_CATALOG_PILLS_KEY = "store_catalog_pills";
export const BASE_CATALOG_CATEGORIES = ["Mujer", "Hombre", "Niños"] as const;

export async function getCatalogPillsConfig(): Promise<{
  pills: CatalogPill[];
  systemCategories: string[];
  hasSavedConfig: boolean;
}> {
  const [setting, productTypeRows] = await Promise.all([
    prisma.systemSetting.findUnique({
      where: { key: STORE_CATALOG_PILLS_KEY },
    }),
    prisma.product.groupBy({
      by: ["type"],
      where: { is_active: true },
      orderBy: { type: "asc" },
    }),
  ]);

  // 1. Construir lista de categorías del sistema (base + tipos de productos activos)
  const systemCategories: string[] = [];
  const systemSeen = new Set<string>();

  for (const base of BASE_CATALOG_CATEGORIES) {
    const key = base.toLowerCase();
    if (!systemSeen.has(key)) {
      systemSeen.add(key);
      systemCategories.push(base);
    }
  }

  for (const row of productTypeRows) {
    const trimmed = row.type?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!systemSeen.has(key)) {
      systemSeen.add(key);
      systemCategories.push(trimmed);
    }
  }

  // 2. Leer configuración guardada en system_settings (si existe)
  const savedPills: CatalogPill[] = [];
  const seen = new Set<string>();
  let hasSavedConfig = false;

  if (setting && setting.value) {
    try {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) {
        hasSavedConfig = true;
        for (const item of parsed) {
          if (
            item &&
            typeof item === "object" &&
            typeof item.name === "string" &&
            typeof item.visible === "boolean"
          ) {
            const trimmedName = item.name.trim();
            if (!trimmedName) continue;
            const key = trimmedName.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              savedPills.push({ name: trimmedName, visible: item.visible });
            }
          }
        }
      }
    } catch {
      hasSavedConfig = false;
    }
  }

  // 3. Combinar: primero los guardados en su orden/estado, y al final los nuevos
  const pills: CatalogPill[] = [...savedPills];

  for (const category of systemCategories) {
    const key = category.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      pills.push({
        name: category,
        visible: !hasSavedConfig, // true si no había config previa, false si ya existía
      });
    }
  }

  return {
    pills,
    systemCategories,
    hasSavedConfig,
  };
}

export function validateCatalogPills(
  input: unknown
): { ok: true; pills: CatalogPill[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) {
    return { ok: false, error: "Se esperaba una lista de filtros" };
  }

  const normalized: CatalogPill[] = [];
  const seen = new Set<string>();

  for (const item of input) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Formato de filtro inválido" };
    }

    const rawName = (item as Record<string, unknown>).name;
    const rawVisible = (item as Record<string, unknown>).visible;

    const name = typeof rawName === "string" ? rawName.trim() : "";
    if (!name) {
      return { ok: false, error: "Los nombres de los filtros no pueden estar vacíos" };
    }

    if (typeof rawVisible !== "boolean") {
      return { ok: false, error: `El estado visible de "${name}" debe ser booleano` };
    }

    const key = name.toLowerCase();
    if (seen.has(key)) {
      return { ok: false, error: `El filtro "${name}" está duplicado` };
    }

    seen.add(key);
    normalized.push({ name, visible: rawVisible });
  }

  return { ok: true, pills: normalized };
}

