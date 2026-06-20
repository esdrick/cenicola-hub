export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getHistorialTasas } from "@/lib/tasa-cambio";
import { TrendingUp, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SOURCE_LABELS: Record<string, string> = {
  dolarflow_bcv: "BCV · DolarFlow",
  manual: "Manual",
};

function fmtBs(n: number) {
  return new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function Dash() {
  return <span className="text-gray-300">—</span>;
}

export default async function TasasPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const tasas = await getHistorialTasas(60);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft size={15} />
          Volver
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp size={22} className="text-emerald-600" />
          Historial de tasas
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Últimas 60 tasas registradas · DolarFlow
        </p>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        {tasas.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-400">
            No hay tasas registradas aún. La tasa se crea automáticamente la primera vez que
            cualquier usuario visita el dashboard.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-36">Fecha</TableHead>
                <TableHead className="text-right">USD oficial</TableHead>
                <TableHead className="text-right">EUR</TableHead>
                <TableHead className="text-right">USD paralelo</TableHead>
                <TableHead className="text-right">Bitcoin</TableHead>
                <TableHead className="text-right">Fuente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasas.map((t) => {
                const isToday = t.date === todayStr;
                return (
                  <TableRow key={t.id} className={isToday ? "bg-emerald-50/50" : ""}>
                    <TableCell className="font-medium">
                      <span className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          {fmtDate(t.date)}
                          {isToday && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              hoy
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-400 tabular-nums font-normal">
                          {new Date(t.created_at).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sm">
                      Bs. {fmtBs(t.rate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {t.eur_rate != null ? `Bs. ${fmtBs(t.eur_rate)}` : <Dash />}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {t.paralelo_rate != null ? `Bs. ${fmtBs(t.paralelo_rate)}` : <Dash />}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {t.btc_usd != null ? `$${fmtUsd(t.btc_usd)}` : <Dash />}
                    </TableCell>
                    <TableCell className="text-right">
                      {t.source === "dolarflow_bcv" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {SOURCE_LABELS[t.source]}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          <AlertTriangle size={10} />
                          {SOURCE_LABELS[t.source] ?? t.source}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
