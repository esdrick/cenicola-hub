"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ImageIcon, ImageOff, Loader2 } from "lucide-react";
import { shortOrderNumber } from "@/lib/order-utils";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { EmbalajeOrdenJSON, UserRole } from "@/types";

interface EnviadasTableProps {
  initialOrders: EmbalajeOrdenJSON[];
  role: UserRole;
}

export function EnviadasTable({ initialOrders, role }: EnviadasTableProps) {
  const router = useRouter();
  const isEmbalador = role === "embalador";
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState(initialOrders);
  const [selectedOrder, setSelectedOrder] = useState<EmbalajeOrdenJSON | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [packagePhotoError, setPackagePhotoError] = useState(false);
  const [receiptPhotoError, setReceiptPhotoError] = useState(false);

  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.order_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_lastname.toLowerCase().includes(q)
    );
  });

  async function handleCompletar(e: React.MouseEvent, orderId: string) {
    e.stopPropagation();
    setCompletingId(orderId);
    try {
      const res = await fetch(`/api/embalaje/${orderId}/completar`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Error al completar la orden");
        return;
      }
      // Optimistic: remove row from local state
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      router.refresh();
    } catch {
      alert("Error de red al completar la orden");
    } finally {
      setCompletingId(null);
    }
  }

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
              {!isEmbalador && <TableHead>Embalado por</TableHead>}
              <TableHead>Empresa envío</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Fotos</TableHead>
              <TableHead>Fecha envío</TableHead>
              {!isEmbalador && <TableHead className="text-right">Acción</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isEmbalador ? 7 : 9} className="text-center py-8 text-gray-500">
                  {isEmbalador ? "No tienes órdenes enviadas aún" : "No hay órdenes en el historial"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedOrder(o)}
                >
                  <TableCell>
                    <span className="font-mono text-sm font-medium">{shortOrderNumber(o.order_number)}</span>
                  </TableCell>
                  <TableCell>
                    {o.status === "completada" ? (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                        Completada
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        Enviada
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {o.customer_name} {o.customer_lastname}
                  </TableCell>
                  {!isEmbalador && (
                    <TableCell className="text-sm text-gray-600">
                      {o.shipment?.packer?.name ?? "—"}
                    </TableCell>
                  )}
                  <TableCell>{o.shipping_company ?? "—"}</TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">
                      {o.shipment?.tracking_number ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {o.shipment?.photo_package ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); setPackagePhotoError(false); setReceiptPhotoError(false); setSelectedOrder(o); }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ImageIcon size={18} />
                      </button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(o.updated_at).toLocaleDateString("es-VE")}
                  </TableCell>
                  {!isEmbalador && (
                    <TableCell className="text-right">
                      {o.status === "enviada" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={completingId === o.id}
                          onClick={(e) => handleCompletar(e, o.id)}
                        >
                          {completingId === o.id ? (
                            <>
                              <Loader2 size={14} className="mr-1 animate-spin" />
                              Procesando...
                            </>
                          ) : (
                            "Marcar como completada"
                          )}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Photos dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Fotos del envío — {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder?.shipment && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Foto del paquete</p>
                <div className="relative aspect-square w-full rounded-md overflow-hidden border bg-gray-100 flex items-center justify-center">
                  {!packagePhotoError ? (
                    <Image
                      src={selectedOrder.shipment.photo_package}
                      alt="Foto del paquete"
                      fill
                      className="object-cover"
                      onError={() => setPackagePhotoError(true)}
                    />
                  ) : (
                    <ImageOff size={32} className="text-gray-400" />
                  )}
                </div>
              </div>
              {selectedOrder.shipment.photo_receipt && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Foto del recibo</p>
                  <div className="relative aspect-square w-full rounded-md overflow-hidden border bg-gray-100 flex items-center justify-center">
                    {!receiptPhotoError ? (
                      <Image
                        src={selectedOrder.shipment.photo_receipt}
                        alt="Foto del recibo"
                        fill
                        className="object-cover"
                        onError={() => setReceiptPhotoError(true)}
                      />
                    ) : (
                      <ImageOff size={32} className="text-gray-400" />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {!selectedOrder?.shipment && (
            <p className="text-gray-500 text-sm">No hay fotos disponibles.</p>
          )}
          <DialogFooter>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setSelectedOrder(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
