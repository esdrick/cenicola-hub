export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  getAvailableCategoriesWithPricing,
  getPromoSettingsWithAutoExpire,
} from "@/lib/promotions";
import { PromocionesClient } from "@/components/shared/promociones/PromocionesClient";

export default async function PromocionesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const [rawSettings, categories] = await Promise.all([
    getPromoSettingsWithAutoExpire(),
    getAvailableCategoriesWithPricing(),
  ]);

  // Serialización segura de tipos Prisma (Decimal, Date) para el Client Component
  const initialSettings = rawSettings
    ? {
        ...rawSettings,
        startsAt: rawSettings.startsAt?.toISOString() ?? null,
        endsAt: rawSettings.endsAt?.toISOString() ?? null,
        updatedAt: rawSettings.updatedAt.toISOString(),
        groups: rawSettings.groups.map((g) => ({
          ...g,
          createdAt: g.createdAt.toISOString(),
          updatedAt: g.updatedAt.toISOString(),
          price3Divisa: g.price3Divisa ? Number(g.price3Divisa) : null,
          price6Divisa: g.price6Divisa ? Number(g.price6Divisa) : null,
          price3Bcv: g.price3Bcv ? Number(g.price3Bcv) : null,
          price6Bcv: g.price6Bcv ? Number(g.price6Bcv) : null,
          categories: g.categories.map((c) => ({
            id: c.id,
            groupId: c.groupId,
            categoryId: c.categoryId,
          })),
        })),
      }
    : null;

  return (
    <PromocionesClient
      initialSettings={initialSettings}
      categories={categories}
      currentUserName={session.name}
    />
  );
}
