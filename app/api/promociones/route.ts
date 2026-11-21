import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";
import {
  validatePromoSettings,
  notifyStorePromoRevalidate,
  getAvailableCategoriesWithPricing,
  getPromoStatusBadge,
  getPromoSettingsWithAutoExpire,
  schedulePromoAutoExpire,
  normalizePromoType,
  PromoSettingsInput,
} from "@/lib/promotions";

export async function GET() {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const [settings, categories] = await Promise.all([
      getPromoSettingsWithAutoExpire(),
      getAvailableCategoriesWithPricing(),
    ]);

    const statusBadge = settings
      ? getPromoStatusBadge(settings)
      : getPromoStatusBadge({
          bannerActive: false,
          discountsActive: false,
          startsAt: null,
          endsAt: null,
        });

    return NextResponse.json({
      settings: settings || {
        id: "default",
        campaignName: "Black Friday 2026",
        themePreset: "black_friday",
        badgeText: "Black Friday",
        bannerActive: false,
        bannerTitle: "¡Semana de Promoción Especial!",
        bannerSubtitle: "Aprovecha descuentos únicos en piezas seleccionadas.",
        bannerCtaText: "Ver ofertas",
        discountsActive: false,
        applyToWeb: true,
        applyToOnline: true,
        applyToStore: false,
        startsAt: null,
        endsAt: null,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
        groups: [],
      },
      categories,
      statusBadge,
    });
  } catch (error) {
    console.error("GET /api/promociones error:", error);
    return NextResponse.json(
      { error: "Error al cargar la configuración de promociones" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as PromoSettingsInput;

    // Obtenemos mapa de categorías para mensajes de error claros
    const categories = await getAvailableCategoriesWithPricing();
    const catMap = new Map(categories.map((c) => [normalizePromoType(c.id), c.name]));

    const validation = validatePromoSettings(body, catMap);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const sanitized = validation.sanitized;

    // Transacción atómica de Prisma
    await prisma.$transaction(async (tx) => {
      // 1. Guardar PromoSettings
      await tx.promoSettings.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          campaignName: sanitized.campaignName,
          themePreset: sanitized.themePreset,
          badgeText: sanitized.badgeText,
          bannerActive: sanitized.bannerActive,
          bannerTitle: sanitized.bannerTitle,
          bannerSubtitle: sanitized.bannerSubtitle,
          bannerCtaText: sanitized.bannerCtaText,
          discountsActive: sanitized.discountsActive,
          applyToWeb: sanitized.applyToWeb ?? true,
          applyToOnline: sanitized.applyToOnline ?? true,
          applyToStore: sanitized.applyToStore ?? false,
          startsAt: sanitized.startsAt ? new Date(sanitized.startsAt) : null,
          endsAt: sanitized.endsAt ? new Date(sanitized.endsAt) : null,
          updatedBy: auth.session.name,
        },
        update: {
          campaignName: sanitized.campaignName,
          themePreset: sanitized.themePreset,
          badgeText: sanitized.badgeText,
          bannerActive: sanitized.bannerActive,
          bannerTitle: sanitized.bannerTitle,
          bannerSubtitle: sanitized.bannerSubtitle,
          bannerCtaText: sanitized.bannerCtaText,
          discountsActive: sanitized.discountsActive,
          applyToWeb: sanitized.applyToWeb ?? true,
          applyToOnline: sanitized.applyToOnline ?? true,
          applyToStore: sanitized.applyToStore ?? false,
          startsAt: sanitized.startsAt ? new Date(sanitized.startsAt) : null,
          endsAt: sanitized.endsAt ? new Date(sanitized.endsAt) : null,
          updatedBy: auth.session.name,
        },
      });

      // 2. Eliminar grupos anteriores para reemplazar con el orden y contenido actual
      await tx.promoGroup.deleteMany({
        where: { settingsId: "default" },
      });

      // 3. Crear los grupos y sus categorías asociadas
      for (let i = 0; i < sanitized.groups.length; i++) {
        const g = sanitized.groups[i];
        await tx.promoGroup.create({
          data: {
            settingsId: "default",
            name: g.name,
            sortOrder: i,
            price3Divisa: g.price3Divisa !== null ? g.price3Divisa : null,
            price6Divisa: g.price6Divisa !== null ? g.price6Divisa : null,
            price3Bcv: g.price3Bcv !== null ? g.price3Bcv : null,
            price6Bcv: g.price6Bcv !== null ? g.price6Bcv : null,
            categories: {
              create: g.categoryIds.map((catId) => ({
                categoryId: catId,
              })),
            },
          },
        });
      }
    });

    // Programar (o limpiar) la desactivación automática en el servidor si hay fecha de fin
    schedulePromoAutoExpire(
      sanitized.endsAt ?? null,
      Boolean(sanitized.discountsActive || sanitized.bannerActive)
    );

    // Notificar a la tienda web de forma no bloqueante / tolerante a fallos
    const revalidateNotice = await notifyStorePromoRevalidate();

    return NextResponse.json({
      ok: true,
      revalidateNotice,
    });
  } catch (error) {
    console.error("PUT /api/promociones error:", error);
    return NextResponse.json(
      { error: "Error al guardar la configuración de promociones en la base de datos" },
      { status: 500 }
    );
  }
}
