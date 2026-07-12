"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TIPO_CIERRE_LABELS, formatFechaCorta, formatFechaHora } from "./cierre-format";
import type { CierreTiendaJSON } from "@/types";

type Props = { cierres: CierreTiendaJSON[] };

export function CierreHistorialTable({ cierres }: Props) {
  const router = useRouter();

  if (cierres.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        Todavía no se ha generado ningún cierre de tienda
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rango</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className="text-right">Piezas</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Generado por</TableHead>
          <TableHead>Fecha de creación</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cierres.map((c) => {
          const totalMonto = c.resumen_totales.reduce((s, r) => s + r.monto, 0);
          return (
            <TableRow
              key={c.id}
              className="cursor-pointer hover:bg-gray-50/50"
              onClick={() => router.push(`/dashboard/cierre-tienda/${c.id}`)}
            >
              <TableCell className="text-sm font-medium">
                {formatFechaCorta(c.fecha_inicio)} – {formatFechaCorta(c.fecha_fin)}
              </TableCell>
              <TableCell>
                <Badge className="border-0 bg-gray-100 text-xs text-gray-700">
                  {TIPO_CIERRE_LABELS[c.tipo] ?? c.tipo}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-sm">{c.total_piezas}</TableCell>
              <TableCell className="text-right text-sm font-semibold">${totalMonto.toFixed(2)}</TableCell>
              <TableCell className="text-sm text-gray-600">{c.generado_por.name}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-gray-500">
                {formatFechaHora(c.created_at)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
