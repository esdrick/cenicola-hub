"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2, X } from "lucide-react";
import { shortOrderNumber, getOrderChannelDisplay } from "@/lib/order-utils";
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
import { Pagination } from "@/components/shared/Pagination";
import { formatVenezuelaDate } from "@/lib/date-utils";
import type { EmbalajeOrdenJSON } from "@/types";

interface EmbalajeTableProps {
  initialOrders: EmbalajeOrdenJSON[];
  total: number;
  page: number;
  totalPages: number;
}

export function EmbalajeTable({ initialOrders, total, page, totalPages }: EmbalajeTableProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");

  useEffect(() => {
    setQ(sp.get("q") ?? "");
  }, [sp]);

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams(sp.toString());
    const vals: Record<string, string> = {
      q,
      page: String(page),
      ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])),
    };
    Object.entries(vals).forEach(([k, v]) => {
      if (v && v !== "0") params.set(k, v);
      else params.delete(k);
    });
    return `/dashboard/embalaje?${params.toString()}`;
  }

  function applySearch() {
    start(() => router.push(buildUrl({ q, page: 1 })));
  }

  function clearSearch() {
    setQ("");
    start(() => router.push(buildUrl({ q: "", page: 1 })));
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          <Input
            placeholder="Buscar por orden o cliente..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearch();
            }}
            className="pl-9 pr-9"
          />
          {q && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {isPending && <Loader2 size={16} className="animate-spin text-gray-400" />}
      </div>

      {/* Table */}
      <div className="rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Orden</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Vendedora</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No hay órdenes en embalaje
                </TableCell>
              </TableRow>
            ) : (
              initialOrders.map((o) => {
                const channelInfo = getOrderChannelDisplay({
                  channel: o.channel,
                  notes: o.notes,
                  order_number: o.order_number,
                  created_by: (o as { created_by?: string | null }).created_by,
                  creator: o.creator,
                });

                return (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/dashboard/embalaje/${o.id}`)}
                  >
                    <TableCell>
                      <span className="font-mono text-sm font-medium">{shortOrderNumber(o.order_number)}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${channelInfo.badgeClass}`}>
                        {channelInfo.label}
                      </span>
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
                    <TableCell className="text-sm font-medium text-gray-700">{channelInfo.vendedora}</TableCell>
                    <TableCell>
                      {formatVenezuelaDate(o.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        noun="orden"
        nounPlural="órdenes"
        isPending={isPending}
        onPrev={() => start(() => router.push(buildUrl({ page: page - 1 })))}
        onNext={() => start(() => router.push(buildUrl({ page: page + 1 })))}
        onPageChange={(p) => start(() => router.push(buildUrl({ page: p })))}
      />
    </div>
  );
}
