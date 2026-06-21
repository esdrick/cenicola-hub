"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle, Search, Pencil, Trash2, Check, X, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CustomerJSON } from "@/types";

type DocType = "V" | "P" | "J" | "E";

const DOC_TYPE_LABELS: Record<DocType, string> = {
  V: "V-",
  P: "P-",
  J: "J-",
  E: "E-",
};

type EditState = {
  id: string;
  doc_type: DocType;
  doc_number: string;
  name: string;
  lastname: string;
  address: string;
};

type Props = {
  initialData: CustomerJSON[];
  initialTotal: number;
};

const PAGE_SIZE = 25;

export function ClientesTable({ initialData, initialTotal }: Props) {
  const [customers, setCustomers] = useState<CustomerJSON[]>(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(Math.max(1, Math.ceil(initialTotal / PAGE_SIZE)));
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (search: string, pg: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/customers?q=${encodeURIComponent(search)}&page=${pg}`);
      const j = await r.json();
      setCustomers(j.data ?? []);
      setTotal(j.total ?? 0);
      setTotalPages(j.totalPages ?? 1);
    } catch {
      setError("Error al cargar clientes");
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

  function startEdit(c: CustomerJSON) {
    setEditing({
      id: c.id,
      doc_type: c.doc_type as DocType,
      doc_number: c.doc_number,
      name: c.name,
      lastname: c.lastname,
      address: c.address ?? "",
    });
    setError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.name.trim() || !editing.lastname.trim() || !editing.doc_number.trim()) {
      setError("Nombre, apellido y número de documento son requeridos");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/customers/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_type: editing.doc_type,
          doc_number: editing.doc_number,
          name: editing.name,
          lastname: editing.lastname,
          address: editing.address || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Error al guardar"); return; }
      setEditing(null);
      load(q, page);
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    setError(null);
    try {
      const r = await fetch(`/api/customers/${deleteId}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Error al eliminar"); return; }
      setDeleteId(null);
      load(q, page);
    } catch {
      setError("Error de conexión");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o documento…" className="pl-8" />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle size={14} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Confirm delete dialog */}
      {deleteId && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-red-700">¿Eliminar este cliente? Los pedidos existentes no se verán afectados.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
              Eliminar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeleteId(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Documento</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead className="text-center">Órdenes</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-gray-400">
                  <Loader2 size={18} className="animate-spin inline" />
                </TableCell>
              </TableRow>
            )}
            {!loading && customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-gray-400">
                  No hay clientes registrados
                </TableCell>
              </TableRow>
            )}
            {!loading && customers.map((c) => {
              const isEditing = editing?.id === c.id;
              return (
                <TableRow key={c.id} className={cn(isEditing && "bg-blue-50")}>
                  {isEditing ? (
                    <>
                      <TableCell>
                        <div className="flex gap-1">
                          <Select value={editing.doc_type}
                            onValueChange={(v) => setEditing((p) => p ? { ...p, doc_type: v as DocType } : p)}>
                            <SelectTrigger className="h-8 w-20 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.entries(DOC_TYPE_LABELS) as [DocType, string][]).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input className="h-8 w-28 text-xs"
                            value={editing.doc_number}
                            onChange={(e) => setEditing((p) => p ? { ...p, doc_number: e.target.value.replace(/\D/g, "") } : p)}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Input className="h-8 text-xs" value={editing.name}
                            onChange={(e) => setEditing((p) => p ? { ...p, name: e.target.value } : p)}
                            placeholder="Nombre" />
                          <Input className="h-8 text-xs" value={editing.lastname}
                            onChange={(e) => setEditing((p) => p ? { ...p, lastname: e.target.value } : p)}
                            placeholder="Apellido" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 text-xs" value={editing.address}
                          onChange={(e) => setEditing((p) => p ? { ...p, address: e.target.value } : p)}
                          placeholder="Dirección" />
                      </TableCell>
                      <TableCell className="text-center text-gray-500">
                        {c._count?.orders ?? 0}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" className="h-7 px-2 text-xs" onClick={saveEdit} disabled={saving}>
                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                            onClick={() => { setEditing(null); setError(null); }}>
                            <X size={12} />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-mono text-xs text-gray-700">
                        {c.doc_type}-{c.doc_number}
                      </TableCell>
                      <TableCell className="text-sm text-gray-900">
                        {c.name} {c.lastname}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 max-w-[200px] truncate">
                        {c.address ?? <span className="italic">Sin dirección</span>}
                      </TableCell>
                      <TableCell className="text-center text-sm text-gray-600">
                        {c._count?.orders ?? 0}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <button type="button" onClick={() => startEdit(c)}
                            className="text-gray-300 hover:text-blue-500 p-1">
                            <Pencil size={13} />
                          </button>
                          <button type="button" onClick={() => { setDeleteId(c.id); setError(null); }}
                            className="text-gray-300 hover:text-red-500 p-1">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total} cliente{total !== 1 ? "s" : ""}</span>
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
        <p className="text-sm text-gray-400">{total} cliente{total !== 1 ? "s" : ""}</p>
      )}
    </div>
  );
}
