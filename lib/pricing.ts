import type { PricingMethod, PaymentType, Prisma } from "../app/generated/prisma";
import {
  resolvePromoPriceForProduct,
  type ActivePromoContext,
} from "./promotions-client";

type Decimal = Prisma.Decimal;

type VariantPrices = {
  price_bcv: Decimal;
  price_divisas: Decimal;
  price_bundle_bcv: Decimal;
  price_bundle_divisas: Decimal;
  price_mayor_bcv: Decimal;
  price_mayor_divisas: Decimal;
};

function pick(specific: Decimal, ...fallbacks: Decimal[]): Decimal {
  if (Number(specific) > 0) return specific;
  for (const f of fallbacks) {
    if (Number(f) > 0) return f;
  }
  return specific;
}

export function resolveUnitPrice(
  variant: VariantPrices,
  method: PricingMethod,
  totalItems: number,
  mayorThreshold: number,
  bundleThreshold: number,
): Decimal {
  const bcv     = variant.price_bcv;
  const divisas = pick(variant.price_divisas, bcv);

  if (method === "bcv") {
    if (totalItems >= mayorThreshold)  return pick(variant.price_mayor_bcv,  bcv);
    if (totalItems >= bundleThreshold) return pick(variant.price_bundle_bcv, bcv);
    return bcv;
  } else {
    if (totalItems >= mayorThreshold)  return pick(variant.price_mayor_divisas,  divisas, bcv);
    if (totalItems >= bundleThreshold) return pick(variant.price_bundle_divisas, divisas, bcv);
    return divisas;
  }
}

/**
 * Splits one order/cart line across the two currency buckets. `totalItems` is still the
 * quantity-tier signal for the WHOLE order/cart (unaffected by how this one line's quantity
 * is split) — mayor/paquete pricing keeps depending on total volume, not on which currency
 * pays for which unit.
 */
export function resolveSplitSubtotal(
  variant: VariantPrices,
  quantityBcv: number,
  quantityDivisas: number,
  totalItems: number,
  mayorThreshold: number,
  bundleThreshold: number,
): { subtotalBcv: number; subtotalDivisas: number } {
  const subtotalBcv = quantityBcv > 0
    ? Number(resolveUnitPrice(variant, "bcv", totalItems, mayorThreshold, bundleThreshold)) * quantityBcv
    : 0;
  const subtotalDivisas = quantityDivisas > 0
    ? Number(resolveUnitPrice(variant, "divisas", totalItems, mayorThreshold, bundleThreshold)) * quantityDivisas
    : 0;
  return {
    subtotalBcv: parseFloat(subtotalBcv.toFixed(2)),
    subtotalDivisas: parseFloat(subtotalDivisas.toFixed(2)),
  };
}

export type SplitSubtotalWithPromo = {
  subtotalBcv: number;
  subtotalDivisas: number;
  originalUnitPrice: number | null;
  promoCampaignName: string | null;
  promoGroupName: string | null;
  promoTier: number | null;
};

/**
 * Igual que `resolveSplitSubtotal`, pero aplica precios promocionales si hay una promoción
 * vigente para el canal y el `productType` pertenece a un grupo promocional.
 */
export function resolveSplitSubtotalWithPromo(
  variant: VariantPrices,
  productType: string | null | undefined,
  quantityBcv: number,
  quantityDivisas: number,
  totalItems: number,
  mayorThreshold: number,
  bundleThreshold: number,
  promo: ActivePromoContext | null | undefined,
): SplitSubtotalWithPromo {
  const normalBcv = Number(resolveUnitPrice(variant, "bcv", totalItems, mayorThreshold, bundleThreshold));
  const normalDivisas = Number(resolveUnitPrice(variant, "divisas", totalItems, mayorThreshold, bundleThreshold));

  const rawPromoBcv = quantityBcv > 0
    ? resolvePromoPriceForProduct(promo, productType, "bcv", totalItems, mayorThreshold, bundleThreshold)
    : null;
  const rawPromoDivisas = quantityDivisas > 0
    ? resolvePromoPriceForProduct(promo, productType, "divisas", totalItems, mayorThreshold, bundleThreshold)
    : null;

  // Solo aplicar el precio promocional si es estrictamente menor que el precio normal (paquete o mayor)
  const promoBcv = rawPromoBcv && rawPromoBcv.promoPrice < normalBcv ? rawPromoBcv : null;
  const promoDivisas = rawPromoDivisas && rawPromoDivisas.promoPrice < normalDivisas ? rawPromoDivisas : null;

  const effectiveBcv = promoBcv ? promoBcv.promoPrice : normalBcv;
  const effectiveDivisas = promoDivisas ? promoDivisas.promoPrice : normalDivisas;

  const subtotalBcv = quantityBcv > 0 ? effectiveBcv * quantityBcv : 0;
  const subtotalDivisas = quantityDivisas > 0 ? effectiveDivisas * quantityDivisas : 0;

  const appliedPromo = promoBcv ?? promoDivisas;
  const lineQty = quantityBcv + quantityDivisas;

  if (appliedPromo && lineQty > 0) {
    const originalSubtotal =
      (quantityBcv > 0 ? normalBcv * quantityBcv : 0) +
      (quantityDivisas > 0 ? normalDivisas * quantityDivisas : 0);
    return {
      subtotalBcv: parseFloat(subtotalBcv.toFixed(2)),
      subtotalDivisas: parseFloat(subtotalDivisas.toFixed(2)),
      originalUnitPrice: parseFloat((originalSubtotal / lineQty).toFixed(2)),
      promoCampaignName: appliedPromo.promoCampaignName,
      promoGroupName: appliedPromo.promoGroupName,
      promoTier: appliedPromo.promoTier,
    };
  }

  return {
    subtotalBcv: parseFloat(subtotalBcv.toFixed(2)),
    subtotalDivisas: parseFloat(subtotalDivisas.toFixed(2)),
    originalUnitPrice: null,
    promoCampaignName: null,
    promoGroupName: null,
    promoTier: null,
  };
}

export function paymentTypeToPricingMethod(paymentType: PaymentType): "bcv" | "divisas" {
  const divisasMethods: PaymentType[] = ["zelle", "usdt", "efectivo_usd"];
  return divisasMethods.includes(paymentType) ? "divisas" : "bcv";
}

export function isCashPayment(paymentType: PaymentType): boolean {
  return paymentType === "efectivo_bs" || paymentType === "efectivo_usd";
}

/**
 * Computes order/cart totals from line items.
 * Applies Math.ceil to each currency bucket (BCV and Divisas) so both the split buckets
 * and the grand total are clean integer amounts in USD.
 */
export function calculateOrderTotals(
  items: { subtotal_bcv_usd: number; subtotal_divisas_usd: number }[]
): {
  total_bcv_usd: number;
  total_divisas_usd: number;
  total_usd: number;
} {
  const rawBcv = items.reduce((s, i) => s + (Number(i.subtotal_bcv_usd) || 0), 0);
  const rawDivisas = items.reduce((s, i) => s + (Number(i.subtotal_divisas_usd) || 0), 0);

  const total_bcv_usd = Math.ceil(parseFloat(rawBcv.toFixed(2)));
  const total_divisas_usd = Math.ceil(parseFloat(rawDivisas.toFixed(2)));
  const total_usd = total_bcv_usd + total_divisas_usd;

  return {
    total_bcv_usd,
    total_divisas_usd,
    total_usd,
  };
}


