import type { PricingMethod, PaymentType, Prisma } from "../app/generated/prisma";

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

export function paymentTypeToPricingMethod(paymentType: PaymentType): "bcv" | "divisas" {
  const divisasMethods: PaymentType[] = ["zelle", "usdt", "efectivo_usd"];
  return divisasMethods.includes(paymentType) ? "divisas" : "bcv";
}

export function isCashPayment(paymentType: PaymentType): boolean {
  return paymentType === "efectivo_bs" || paymentType === "efectivo_usd";
}

