import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MONEDA_CLASSES, formatFechaCorta, formatNumeroOrdenCorto } from "./cierre-format";
import type { CierreTiendaDetailJSON } from "@/types";

type Props = { cierre: CierreTiendaDetailJSON };

export function CierreDetalleView({ cierre }: Props) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            Órdenes incluidas · {formatFechaCorta(cierre.fecha_inicio)} – {formatFechaCorta(cierre.fecha_fin)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Orden</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Piezas</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Método de pago</TableHead>
                <TableHead>Referencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cierre.detalles.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs font-semibold">{formatNumeroOrdenCorto(d.numero_orden)}</TableCell>
                  <TableCell className="text-sm">{d.cliente_nombre}</TableCell>
                  <TableCell className="text-right text-sm">{d.cantidad_piezas}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">${d.monto.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge className={`border-0 text-xs ${MONEDA_CLASSES[d.moneda] ?? "bg-gray-100 text-gray-700"}`}>
                      {d.moneda}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{d.metodo_pago}</TableCell>
                  <TableCell className="font-mono text-xs text-gray-600">{d.referencia_pago}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Total de piezas: <span className="font-semibold text-gray-900">{cierre.total_piezas}</span>
            {" · "}
            {cierre.detalles.length} orden{cierre.detalles.length !== 1 ? "es" : ""}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cierre.resumen_totales.map((r) => (
              <div key={`${r.moneda}-${r.metodoPago}`} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge className={`border-0 text-xs ${MONEDA_CLASSES[r.moneda] ?? "bg-gray-100 text-gray-700"}`}>
                    {r.moneda}
                  </Badge>
                  <span className="text-xs text-gray-600">{r.metodoPago}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">${r.monto.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
