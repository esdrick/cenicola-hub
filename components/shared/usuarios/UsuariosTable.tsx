"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Search, X, Loader2 } from "lucide-react";
import { Pagination } from "@/components/shared/Pagination";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/auth";
import type { UserJSON, UserRole } from "@/types";

type Props = {
  users: UserJSON[];
  total: number;
  page: number;
  totalPages: number;
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin:             "bg-red-100 text-red-700",
  inventario:        "bg-blue-100 text-blue-700",
  embalador:         "bg-purple-100 text-purple-700",
  vendedora_online:  "bg-emerald-100 text-emerald-700",
  vendedora_tienda:  "bg-orange-100 text-orange-700",
};

const ROL_DISPLAY: Record<string, string> = {
  "":                "Todos los roles",
  admin:             "Administrador",
  inventario:        "Inventario",
  embalador:         "Embalador",
  vendedora_online:  "Vendedora Online",
  vendedora_tienda:  "Vendedora Tienda",
};

const ESTADO_DISPLAY: Record<string, string> = {
  "":       "Todos",
  activo:   "Activos",
  inactivo: "Inactivos",
};

export function UsuariosTable({ users, total, page, totalPages }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [rol, setRol] = useState<string>(sp.get("rol") ?? "");
  const [estado, setEstado] = useState<string>(sp.get("estado") ?? "");

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams();
    const vals = { rol, estado, page: String(page), ...Object.fromEntries(
      Object.entries(overrides).map(([k, v]) => [k, String(v)])
    )};
    Object.entries(vals).forEach(([k, v]) => { if (v && v !== "0") params.set(k, v); });
    return `/dashboard/usuarios?${params.toString()}`;
  }

  function apply() {
    startTransition(() => router.push(buildUrl({ page: 1 })));
  }

  function clear() {
    setRol(""); setEstado("");
    startTransition(() => router.push("/dashboard/usuarios"));
  }

  const hasFilters = !!(sp.get("rol") || sp.get("estado"));

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <Select value={rol || "all"} onValueChange={(v) => { setRol(v === "all" ? "" : (v ?? "")); }}>
          <SelectTrigger className="w-44">
            <span data-slot="select-value" className="flex-1 text-left">
              {ROL_DISPLAY[rol] ?? "Todos los roles"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
            <SelectItem value="inventario">Inventario</SelectItem>
            <SelectItem value="embalador">Embalador</SelectItem>
            <SelectItem value="vendedora_online">Vendedora Online</SelectItem>
            <SelectItem value="vendedora_tienda">Vendedora Tienda</SelectItem>
          </SelectContent>
        </Select>

        <Select value={estado || "all"} onValueChange={(v) => { setEstado(v === "all" ? "" : (v ?? "")); }}>
          <SelectTrigger className="w-36">
            <span data-slot="select-value" className="flex-1 text-left">
              {ESTADO_DISPLAY[estado] ?? "Todos"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="activo">Activos</SelectItem>
            <SelectItem value="inactivo">Inactivos</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={apply} disabled={isPending} className="rounded-full px-4">
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <><Search size={13} className="mr-1" />Filtrar</>}
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clear} disabled={isPending}>
            <X size={14} className="mr-1" />Limpiar
          </Button>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="whitespace-nowrap">Fecha de creación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-gray-400">
                  No se encontraron usuarios
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => startTransition(() => router.push(`/dashboard/usuarios/${user.id}`))}
                >
                  <TableCell className="font-medium text-gray-900">{user.name}</TableCell>
                  <TableCell className="text-gray-600">{user.email}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      ROLE_COLORS[user.role]
                    )}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      user.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                    )}>
                      {user.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                    {new Date(user.created_at).toLocaleDateString("es-VE", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        noun="usuario"
        prevHref={page > 1 ? buildUrl({ page: page - 1 }) : null}
        nextHref={page < totalPages ? buildUrl({ page: page + 1 }) : null}
        isPending={isPending}
      />
    </div>
  );
}
