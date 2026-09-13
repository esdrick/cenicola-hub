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
  AlertCircle, Search, Pencil, Trash2, Check, X, Loader2, Plus,
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
  email: string;
  address: string;
  phone: string;
};

type CreateState = {
  doc_type: DocType;
  doc_number: string;
  name: string;
  lastname: string;
  email: string;
  address: string;
  phone: string;
};

const PHONE_RE = /^0\d{9,10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createState, setCreateState] = useState<CreateState>({
    doc_type: "V",
    doc_number: "",
    name: "",
    lastname: "",
    email: "",
    address: "",
    phone: "",
  });

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
      email: c.email ?? "",
      address: c.address ?? "",
      phone: c.phone ?? "",
    });
    setError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.name.trim() || !editing.lastname.trim() || !editing.doc_number.trim()) {
      setError("Nombre, apellido y número de documento son requeridos");
      return;
    }
    if (editing.phone.trim() && !PHONE_RE.test(editing.phone.trim())) {
      setError("Número de teléfono inválido");
      return;
    }
    if (editing.email.trim() && !EMAIL_RE.test(editing.email.trim())) {
      setError("Correo electrónico inválido");
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
          email: editing.email.trim() || null,
          address: editing.address || null,
          phone: editing.phone || null,
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

  async function saveCreate() {
    if (!createState.name.trim() || !createState.lastname.trim() || !createState.doc_number.trim()) {
      setError("Nombre, apellido y número de documento son requeridos");
      return;
    }
    if (createState.phone.trim() && !PHONE_RE.test(createState.phone.trim())) {
      setError("Número de teléfono inválido");
      return;
    }
    if (createState.email.trim() && !EMAIL_RE.test(createState.email.trim())) {
      setError("Correo electrónico inválido");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const r = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_type: createState.doc_type,
          doc_number: createState.doc_number.trim(),
          name: createState.name.trim(),
          lastname: createState.lastname.trim(),
          email: createState.email.trim() || null,
          address: createState.address.trim() || null,
          phone: createState.phone.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Error al crear cliente"); return; }
      setShowCreate(false);
      setCreateState({ doc_type: "V", doc_number: "", name: "", lastname: "", email: "", address: "", phone: "" });
      load(q, page);
    } catch {
      setError("Error de conexión");
    } finally {
      setCreating(false);
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
      {/* Top Bar: Search + Add Customer */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o documento…" className="pl-8" />
        </div>
        <Button size="sm" onClick={() => { setShowCreate((p) => !p); setError(null); }} className="gap-1.5">
          <Plus size={14} />
          {showCreate ? "Cancelar" : "Nuevo Cliente"}
        </Button>
      </div>

      {/* Formulario Nuevo Cliente */}
      {showCreate && (
        <div className="rounded-xl border bg-white p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Registrar Nuevo Cliente en Hub</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Documento *</label>
              <div className="flex gap-1">
                <Select value={createState.doc_type}
                  onValueChange={(v) => setCreateState((p) => ({ ...p, doc_type: v as DocType }))}>
                  <SelectTrigger className="h-9 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(DOC_TYPE_LABELS) as [DocType, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input className="h-9 text-xs flex-1" placeholder="12345678"
                  value={createState.doc_number}
                  onChange={(e) => setCreateState((p) => ({ ...p, doc_number: e.target.value.replace(/\D/g, "") }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Nombre *</label>
              <Input className="h-9 text-xs" placeholder="Nombre" value={createState.name}
                onChange={(e) => setCreateState((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Apellido *</label>
              <Input className="h-9 text-xs" placeholder="Apellido" value={createState.lastname}
                onChange={(e) => setCreateState((p) => ({ ...p, lastname: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Teléfono (Opcional)</label>
              <Input className="h-9 text-xs" placeholder="04121234567" value={createState.phone}
                onChange={(e) => setCreateState((p) => ({ ...p, phone: e.target.value.replace(/\D/g, "").slice(0, 11) }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Correo (Opcional)</label>
              <Input className="h-9 text-xs" placeholder="correo@ejemplo.com" type="email" value={createState.email}
                onChange={(e) => setCreateState((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Dirección (Opcional)</label>
              <Input className="h-9 text-xs" placeholder="Dirección del cliente" value={createState.address}
                onChange={(e) => setCreateState((p) => ({ ...p, address: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button size="sm" onClick={saveCreate} disabled={creating}>
              {creating ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
              Guardar Cliente
            </Button>
          </div>
        </div>
      )}

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
              <TableHead>Correo</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-center">Órdenes</TableHead>
              <TableHead />
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
            {!loading && customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-gray-400">
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
                        <Input className="h-8 text-xs" value={editing.email}
                          onChange={(e) => setEditing((p) => p ? { ...p, email: e.target.value } : p)}
                          placeholder="correo@ejemplo.com" type="email"
                        />
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 text-xs" value={editing.address}
                          onChange={(e) => setEditing((p) => p ? { ...p, address: e.target.value } : p)}
                          placeholder="Dirección" />
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 text-xs" value={editing.phone}
                          onChange={(e) => setEditing((p) => p ? { ...p, phone: e.target.value.replace(/\D/g, "").slice(0, 11) } : p)}
                          placeholder="04121234567" inputMode="numeric" />
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
                        <span>{c.name} {c.lastname}</span>
                      </TableCell>
                      <TableCell className="text-xs text-gray-600 max-w-[180px] truncate">
                        {c.email ?? <span className="italic text-gray-400">Sin correo</span>}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 max-w-[200px] truncate">
                        {c.address ?? <span className="italic">Sin dirección</span>}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {c.phone ?? <span className="italic">Sin teléfono</span>}
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
