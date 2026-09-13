"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Search, Loader2, Globe, CheckCircle2, XCircle } from "lucide-react";
import { formatVenezuelaDate } from "@/lib/date-utils";

export type WebAccountJSON = {
  id: string;
  email: string;
  name: string;
  lastname: string;
  phone: string | null;
  customer_id_doc?: string | null;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  _count?: { orders: number };
};

type Props = {
  initialData: WebAccountJSON[];
  initialTotal: number;
};

const PAGE_SIZE = 25;

export function WebAccountsTable({ initialData, initialTotal }: Props) {
  const [accounts, setAccounts] = useState<WebAccountJSON[]>(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(Math.max(1, Math.ceil(initialTotal / PAGE_SIZE)));
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (search: string, pg: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/web-customers?q=${encodeURIComponent(search)}&page=${pg}`);
      const j = await r.json();
      setAccounts(j.data ?? []);
      setTotal(j.total ?? 0);
      setTotalPages(j.totalPages ?? 1);
    } catch {
      setError("Error al cargar cuentas web");
    } finally {
      setLoading(false);
    }
  }, []);

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); load(q, 1); }, 300);
  }, [q, load]);

  useEffect(() => {
    if (isFirstRender.current) return;
    load(q, page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, cédula o correo…"
          className="pl-8"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle size={14} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Correo Electrónico</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-center">Estado Correo</TableHead>
              <TableHead className="text-center">Órdenes Web</TableHead>
              <TableHead className="text-right">Fecha Registro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-gray-400">
                  <Loader2 size={18} className="animate-spin inline" />
                </TableCell>
              </TableRow>
            )}
            {!loading && accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-gray-400">
                  No hay cuentas web registradas
                </TableCell>
              </TableRow>
            )}
            {!loading && accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-sm font-medium text-gray-900">
                  <div className="flex items-center gap-1.5">
                    <Globe size={14} className="text-blue-600 shrink-0" />
                    <span>{a.name || "Sin nombre"} {a.lastname || ""}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-gray-700 font-mono">
                  {a.customer_id_doc ? (
                    a.customer_id_doc
                  ) : (
                    <span className="italic text-gray-400 font-sans">Sin cédula</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-gray-700 font-mono">
                  {a.email}
                </TableCell>
                <TableCell className="text-xs text-gray-500">
                  {a.phone ?? <span className="italic text-gray-400">Sin teléfono</span>}
                </TableCell>
                <TableCell className="text-center text-xs">
                  {a.email_verified ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 size={11} /> Verificado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      <XCircle size={11} /> Pendiente
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center text-sm text-gray-600 font-semibold">
                  {a._count?.orders ?? 0}
                </TableCell>
                <TableCell className="text-right text-xs text-gray-400">
                  {formatVenezuelaDate(a.created_at, {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total} cuenta{total !== 1 ? "s" : ""} web</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span className="flex items-center px-2">
              {page} / {totalPages}
            </span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}
      {totalPages <= 1 && !loading && total > 0 && (
        <p className="text-sm text-gray-400">{total} cuenta{total !== 1 ? "s" : ""} web</p>
      )}
    </div>
  );
}
