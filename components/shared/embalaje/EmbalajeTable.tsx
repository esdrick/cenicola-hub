"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { EmbalajeOrdenJSON } from "@/types";

interface EmbalajeTableProps {
  initialOrders: EmbalajeOrdenJSON[];
}

export function EmbalajeTable({ initialOrders }: EmbalajeTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = initialOrders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.order_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_lastname.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <Input
          placeholder="Buscar por orden o cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Orden</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Vendedora</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No hay órdenes en embalaje
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/dashboard/embalaje/${o.id}`)}
                >
                  <TableCell>
                    <span className="font-mono text-sm font-medium">{o.order_number}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                      En embalaje
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {o.customer_name} {o.customer_lastname}
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-500 text-sm truncate max-w-[240px] block">
                      {o.items_summary}
                    </span>
                  </TableCell>
                  <TableCell>{o.creator.name}</TableCell>
                  <TableCell>
                    {new Date(o.created_at).toLocaleDateString("es-VE")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
