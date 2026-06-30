import { prisma } from "./prisma";

export const SETTING_DEFAULTS = {
  low_stock_threshold: 3,
  bundle_threshold: 3,
  mayor_threshold: 6,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting(key: SettingKey): Promise<number> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row) return SETTING_DEFAULTS[key];
  const parsed = parseInt(row.value, 10);
  return isNaN(parsed) ? SETTING_DEFAULTS[key] : parsed;
}
