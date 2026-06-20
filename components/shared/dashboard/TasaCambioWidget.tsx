import Link from "next/link";
import { TrendingUp, AlertTriangle, ExternalLink } from "lucide-react";
import { getTasa } from "@/lib/tasa-cambio";

const SOURCE_LABELS: Record<string, string> = {
  dolarflow_bcv: "BCV · DolarFlow",
  manual: "Ingresada manualmente",
};

function fmtBs(n: number) {
  return new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function RateCard({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string | null;
  unit: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      {value != null ? (
        <>
          <span className="text-xl font-bold text-gray-900 tabular-nums">{value}</span>
          <span className="text-xs text-gray-400">{unit}</span>
        </>
      ) : (
        <span className="text-sm text-gray-300">—</span>
      )}
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

export async function TasaCambioWidget({ userId }: { userId: string }) {
  const tasa = await getTasa(userId);

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-emerald-50 p-1.5">
            <TrendingUp size={16} className="text-emerald-600" />
          </div>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Tasas BCV · DolarFlow
          </span>
        </div>
        <div className="flex items-center gap-3">
          {tasa?.stale && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              <AlertTriangle size={11} />
              Desactualizada · {tasa ? fmtDate(tasa.date) : ""}
            </span>
          )}
          {tasa && !tasa.stale && (
            <span className="text-xs text-gray-400">{fmtDate(tasa.date)}</span>
          )}
          <Link
            href="/dashboard/tasas"
            className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors"
          >
            Historial <ExternalLink size={11} />
          </Link>
        </div>
      </div>

      {tasa ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
          <RateCard
            label="USD oficial"
            value={`Bs. ${fmtBs(tasa.rate)}`}
            unit="por $1"
          />
          <RateCard
            label="EUR"
            value={tasa.eur_rate != null ? `Bs. ${fmtBs(tasa.eur_rate)}` : null}
            unit="por €1"
          />
          <RateCard
            label="USD paralelo"
            value={tasa.paralelo_rate != null ? `Bs. ${fmtBs(tasa.paralelo_rate)}` : null}
            unit="por $1"
          />
          <RateCard
            label="Bitcoin"
            value={tasa.btc_usd != null ? `$${fmtUsd(tasa.btc_usd)}` : null}
            unit="por 1 BTC"
          />
        </div>
      ) : (
        <p className="text-sm text-gray-400 mt-1">Sin tasa registrada</p>
      )}

      {tasa && !tasa.stale && (
        <p className="mt-3 text-xs text-gray-300">
          {SOURCE_LABELS[tasa.source] ?? tasa.source}
        </p>
      )}
    </div>
  );
}
