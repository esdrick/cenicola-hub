import { prisma } from "@/lib/prisma";

const ENDPOINTS = {
  usd: "https://dolarflow.com/api/oficial",
  eur: "https://dolarflow.com/api/euro",
  paralelo: "https://dolarflow.com/api/paralelo",
  btc: "https://dolarflow.com/api/btc",
} as const;

export type TasaResult = {
  id: string;
  rate: number;
  eur_rate: number | null;
  paralelo_rate: number | null;
  btc_usd: number | null;
  date: string;
  source: string;
  stale: boolean;
};

async function fetchRate(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "CenicolaHub/1.0", Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.promedio ?? data?.price ?? data?.valor ?? data?.value;
    const parsed = parseFloat(String(raw));
    return isNaN(parsed) || parsed <= 0 ? null : parsed;
  } catch {
    return null;
  }
}

function todayUTC(): Date {
  const d = new Date();
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

const SELECT = {
  id: true,
  rate_date: true,
  usd_to_ves: true,
  eur_to_ves: true,
  paralelo_to_ves: true,
  btc_usd: true,
  source: true,
} as const;

function toResult(r: {
  id: string;
  rate_date: Date;
  usd_to_ves: { toNumber(): number };
  eur_to_ves: { toNumber(): number } | null;
  paralelo_to_ves: { toNumber(): number } | null;
  btc_usd: { toNumber(): number } | null;
  source: string;
}, stale: boolean): TasaResult {
  return {
    id: r.id,
    rate: r.usd_to_ves.toNumber(),
    eur_rate: r.eur_to_ves?.toNumber() ?? null,
    paralelo_rate: r.paralelo_to_ves?.toNumber() ?? null,
    btc_usd: r.btc_usd?.toNumber() ?? null,
    date: r.rate_date.toISOString().slice(0, 10),
    source: r.source,
    stale,
  };
}

export async function getTasa(createdBy?: string): Promise<TasaResult | null> {
  const today = todayUTC();

  // Layer 1: today's record exists
  const todayRecord = await prisma.exchangeRate.findFirst({ where: { rate_date: today }, select: SELECT });

  if (todayRecord) {
    const missingAny =
      todayRecord.eur_to_ves == null ||
      todayRecord.paralelo_to_ves == null ||
      todayRecord.btc_usd == null;

    if (missingAny && createdBy) {
      const [eur, paralelo, btc] = await Promise.all([
        todayRecord.eur_to_ves == null ? fetchRate(ENDPOINTS.eur) : Promise.resolve(null),
        todayRecord.paralelo_to_ves == null ? fetchRate(ENDPOINTS.paralelo) : Promise.resolve(null),
        todayRecord.btc_usd == null ? fetchRate(ENDPOINTS.btc) : Promise.resolve(null),
      ]);
      const patch: Record<string, number> = {};
      if (eur != null) patch.eur_to_ves = eur;
      if (paralelo != null) patch.paralelo_to_ves = paralelo;
      if (btc != null) patch.btc_usd = btc;
      if (Object.keys(patch).length > 0) {
        await prisma.exchangeRate.update({ where: { id: todayRecord.id }, data: patch });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (eur != null) (todayRecord as any).eur_to_ves = { toNumber: () => eur };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (paralelo != null) (todayRecord as any).paralelo_to_ves = { toNumber: () => paralelo };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (btc != null) (todayRecord as any).btc_usd = { toNumber: () => btc };
      }
    }
    return toResult(todayRecord, false);
  }

  // Layer 2: fetch all and persist
  if (createdBy) {
    const [usd, eur, paralelo, btc] = await Promise.all([
      fetchRate(ENDPOINTS.usd),
      fetchRate(ENDPOINTS.eur),
      fetchRate(ENDPOINTS.paralelo),
      fetchRate(ENDPOINTS.btc),
    ]);
    if (usd !== null) {
      try {
        const record = await prisma.exchangeRate.upsert({
          where: { rate_date: today },
          update: {},
          create: {
            rate_date: today,
            usd_to_ves: usd,
            eur_to_ves: eur,
            paralelo_to_ves: paralelo,
            btc_usd: btc,
            source: "dolarflow_bcv",
            created_by: createdBy,
          },
          select: SELECT,
        });
        return toResult(record, false);
      } catch {
        const existing = await prisma.exchangeRate.findFirst({ where: { rate_date: today }, select: SELECT });
        if (existing) return toResult(existing, false);
      }
    }
  }

  // Layer 3: stale fallback
  const latest = await prisma.exchangeRate.findFirst({ orderBy: { rate_date: "desc" }, select: SELECT });
  return latest ? toResult(latest, true) : null;
}

export async function getHistorialTasas(limit = 30) {
  const records = await prisma.exchangeRate.findMany({
    orderBy: { rate_date: "desc" },
    take: limit,
    select: {
      id: true,
      rate_date: true,
      usd_to_ves: true,
      eur_to_ves: true,
      paralelo_to_ves: true,
      btc_usd: true,
      source: true,
      created_at: true,
    },
  });
  return records.map((r) => ({
    id: r.id,
    date: r.rate_date.toISOString().slice(0, 10),
    rate: r.usd_to_ves.toNumber(),
    eur_rate: r.eur_to_ves?.toNumber() ?? null,
    paralelo_rate: r.paralelo_to_ves?.toNumber() ?? null,
    btc_usd: r.btc_usd?.toNumber() ?? null,
    source: r.source,
    created_at: r.created_at.toISOString(),
  }));
}
