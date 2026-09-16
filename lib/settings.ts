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
