"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, ImageIcon, ImageOff, Loader2, Pencil, Upload, X, Check } from "lucide-react";
import { shortOrderNumber } from "@/lib/order-utils";
import { optimizeImage, validateImageFile } from "@/lib/image-optimizer";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { EmbalajeOrdenJSON, UserRole } from "@/types";

const VALID_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

interface EnviadasTableProps {
  initialOrders: EmbalajeOrdenJSON[];
  role: UserRole;
}

export function EnviadasTable({ initialOrders, role }: EnviadasTableProps) {
  const router = useRouter();
  const isEmbalador = role === "embalador" || role === "vendedora_online";
  const canEditPhotos = role === "admin" || role === "inventario";
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState(initialOrders);
  const [selectedOrder, setSelectedOrder] = useState<EmbalajeOrdenJSON | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [packagePhotoError, setPackagePhotoError] = useState(false);
  const [receiptPhotoError, setReceiptPhotoError] = useState(false);
  const [guidePhotoError, setGuidePhotoError] = useState(false);

  // Edit photos state
  const [isEditingPhotos, setIsEditingPhotos] = useState(false);
  const [editFoto1, setEditFoto1] = useState<File | null>(null);
  const [editFoto1Preview, setEditFoto1Preview] = useState<string | null>(null);
  const [editFoto2, setEditFoto2] = useState<File | null>(null);
  const [editFoto2Preview, setEditFoto2Preview] = useState<string | null>(null);
  const [editRemoveFoto2, setEditRemoveFoto2] = useState(false);
  const [editFoto3, setEditFoto3] = useState<File | null>(null);
  const [editFoto3Preview, setEditFoto3Preview] = useState<string | null>(null);
  const [editRemoveFoto3, setEditRemoveFoto3] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editFoto1InputRef = useRef<HTMLInputElement>(null);
  const editFoto2InputRef = useRef<HTMLInputElement>(null);
  const editFoto3InputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (editFoto1Preview) URL.revokeObjectURL(editFoto1Preview);
      if (editFoto2Preview) URL.revokeObjectURL(editFoto2Preview);
      if (editFoto3Preview) URL.revokeObjectURL(editFoto3Preview);
    };
  }, [editFoto1Preview, editFoto2Preview, editFoto3Preview]);

  function resetEditState() {
    if (editFoto1Preview) URL.revokeObjectURL(editFoto1Preview);
    if (editFoto2Preview) URL.revokeObjectURL(editFoto2Preview);
    if (editFoto3Preview) URL.revokeObjectURL(editFoto3Preview);
    setIsEditingPhotos(false);
    setEditFoto1(null);
    setEditFoto1Preview(null);
    setEditFoto2(null);
    setEditFoto2Preview(null);
    setEditRemoveFoto2(false);
    setEditFoto3(null);
    setEditFoto3Preview(null);
    setEditRemoveFoto3(false);
    setEditError(null);
  }

  async function handleEditFoto1Change(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const typeError = validateImageFile(file, { validTypes: VALID_IMAGE_TYPES });
    if (typeError) { setEditError(typeError); return; }
    if (editFoto1Preview) URL.revokeObjectURL(editFoto1Preview);
    setEditError(null);
    try {
      const optimized = await optimizeImage(file);
      setEditFoto1(optimized);
      setEditFoto1Preview(URL.createObjectURL(optimized));
    } catch {
      setEditError("No se pudo comprimir la imagen. Intenta con otro archivo.");
    }
  }

  async function handleEditFoto2Change(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const typeError = validateImageFile(file, { validTypes: VALID_IMAGE_TYPES });
    if (typeError) { setEditError(typeError); return; }
    if (editFoto2Preview) URL.revokeObjectURL(editFoto2Preview);
    setEditError(null);
    setEditRemoveFoto2(false);
    try {
      const optimized = await optimizeImage(file);
      setEditFoto2(optimized);
      setEditFoto2Preview(URL.createObjectURL(optimized));
    } catch {
      setEditError("No se pudo comprimir la imagen. Intenta con otro archivo.");
    }
  }

  async function handleEditFoto3Change(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const typeError = validateImageFile(file, { validTypes: VALID_IMAGE_TYPES });
    if (typeError) { setEditError(typeError); return; }
    if (editFoto3Preview) URL.revokeObjectURL(editFoto3Preview);
    setEditError(null);
    setEditRemoveFoto3(false);
    try {
      const optimized = await optimizeImage(file);
      setEditFoto3(optimized);
      setEditFoto3Preview(URL.createObjectURL(optimized));
    } catch {
      setEditError("No se pudo comprimir la imagen. Intenta con otro archivo.");
    }
  }

  async function handleSavePhotos() {
    if (!selectedOrder) return;
    if (!editFoto1 && !editFoto2 && !editRemoveFoto2 && !editFoto3 && !editRemoveFoto3) {
      setEditError("Selecciona al menos una foto nueva");
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      const fd = new FormData();
      if (editFoto1) fd.append("foto1", editFoto1);
      if (editFoto2) fd.append("foto2", editFoto2);
      if (editRemoveFoto2) fd.append("removeFoto2", "true");
      if (editFoto3) fd.append("foto3", editFoto3);
      if (editRemoveFoto3) fd.append("removeFoto3", "true");

      const res = await fetch(`/api/embalaje/${selectedOrder.id}/fotos`, {
        method: "PATCH",
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error al actualizar las fotos");
      }

      const data = await res.json();

      const updateShipment = (o: EmbalajeOrdenJSON) =>
        o.id === selectedOrder.id && o.shipment
          ? {
              ...o,
              shipment: {
                ...o.shipment,
                photo_package: data.photo_package,
                photo_receipt: data.photo_receipt,
                photo_guide: data.photo_guide,
                edited_at: data.edited_at,
                editor: data.editor,
              },
            }
          : o;

      setOrders((prev) => prev.map(updateShipment));
      setSelectedOrder((prev) => (prev ? updateShipment(prev) : prev));
      setPackagePhotoError(false);
      setReceiptPhotoError(false);
      setGuidePhotoError(false);
      resetEditState();
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setEditSubmitting(false);
    }
  }

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
                        onClick={(e) => { e.stopPropagation(); setPackagePhotoError(false); setReceiptPhotoError(false); setGuidePhotoError(false); setSelectedOrder(o); }}
                        className="relative text-blue-600 hover:text-blue-800"
                        title={o.shipment.edited_at ? "Fotos editadas" : undefined}
                      >
                        <ImageIcon size={18} />
                        {o.shipment.edited_at && (
                          <Pencil size={10} className="absolute -top-1 -right-1.5 text-amber-600 bg-white rounded-full p-[1px]" />
                        )}
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
      <Dialog
        open={!!selectedOrder}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(null);
            resetEditState();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Fotos del envío — {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder?.shipment?.edited_at && (
            <div className="flex items-center gap-1.5 -mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 w-fit">
              <Pencil size={12} />
              <span>
                Editado por {selectedOrder.shipment.editor?.name ?? "—"} el{" "}
                {new Date(selectedOrder.shipment.edited_at).toLocaleString("es-VE")}
              </span>
            </div>
          )}

          {selectedOrder?.shipment && !isEditingPhotos && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
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
              {selectedOrder.shipment.photo_guide && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Foto de la guía</p>
                  <div className="relative aspect-square w-full rounded-md overflow-hidden border bg-gray-100 flex items-center justify-center">
                    {!guidePhotoError ? (
                      <Image
                        src={selectedOrder.shipment.photo_guide}
                        alt="Foto de la guía"
                        fill
                        className="object-cover"
                        onError={() => setGuidePhotoError(true)}
                      />
                    ) : (
                      <ImageOff size={32} className="text-gray-400" />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedOrder?.shipment && isEditingPhotos && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Foto 1 */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Foto del paquete</p>
                  <input
                    ref={editFoto1InputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleEditFoto1Change}
                  />
                  <button
                    type="button"
                    className="group relative aspect-square w-full rounded-md overflow-hidden border bg-gray-100 flex items-center justify-center"
                    onClick={() => editFoto1InputRef.current?.click()}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={editFoto1Preview ?? selectedOrder.shipment.photo_package}
                      alt="Foto del paquete"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition-colors">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs flex items-center gap-1">
                        <Upload size={14} /> Reemplazar
                      </span>
                    </div>
                  </button>
                  {editFoto1Preview && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <Check size={12} /> Nueva foto seleccionada
                    </p>
                  )}
                </div>

                {/* Foto 2 */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Foto del recibo</p>
                  <input
                    ref={editFoto2InputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleEditFoto2Change}
                  />
                  {editRemoveFoto2 || (!selectedOrder.shipment.photo_receipt && !editFoto2Preview) ? (
                    <div
                      className="aspect-square w-full rounded-md border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-gray-300"
                      onClick={() => editFoto2InputRef.current?.click()}
                    >
                      <Upload size={20} className="text-gray-400" />
                      <span className="text-xs text-gray-400">Agregar foto</span>
                    </div>
                  ) : (
                    <div className="relative group aspect-square w-full rounded-md overflow-hidden border bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={editFoto2Preview ?? selectedOrder.shipment.photo_receipt ?? undefined}
                        alt="Foto del recibo"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100"
                        onClick={() => editFoto2InputRef.current?.click()}
                      >
                        <span className="text-white text-xs flex items-center gap-1">
                          <Upload size={14} /> Reemplazar
                        </span>
                      </button>
                      <button
                        type="button"
                        className="absolute top-1.5 right-1.5 rounded-full bg-white/90 p-1 text-gray-500 hover:text-red-500 shadow-sm"
                        onClick={() => {
                          if (editFoto2Preview) URL.revokeObjectURL(editFoto2Preview);
                          setEditFoto2(null);
                          setEditFoto2Preview(null);
                          setEditRemoveFoto2(true);
                          if (editFoto2InputRef.current) editFoto2InputRef.current.value = "";
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  {editFoto2Preview && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <Check size={12} /> Nueva foto seleccionada
                    </p>
                  )}
                </div>

                {/* Foto 3 */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Foto de la guía</p>
                  <input
                    ref={editFoto3InputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleEditFoto3Change}
                  />
                  {editRemoveFoto3 || (!selectedOrder.shipment.photo_guide && !editFoto3Preview) ? (
                    <div
                      className="aspect-square w-full rounded-md border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-gray-300"
                      onClick={() => editFoto3InputRef.current?.click()}
                    >
                      <Upload size={20} className="text-gray-400" />
                      <span className="text-xs text-gray-400">Agregar foto</span>
                    </div>
                  ) : (
                    <div className="relative group aspect-square w-full rounded-md overflow-hidden border bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={editFoto3Preview ?? selectedOrder.shipment.photo_guide ?? undefined}
                        alt="Foto de la guía"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100"
                        onClick={() => editFoto3InputRef.current?.click()}
                      >
                        <span className="text-white text-xs flex items-center gap-1">
                          <Upload size={14} /> Reemplazar
                        </span>
                      </button>
                      <button
                        type="button"
                        className="absolute top-1.5 right-1.5 rounded-full bg-white/90 p-1 text-gray-500 hover:text-red-500 shadow-sm"
                        onClick={() => {
                          if (editFoto3Preview) URL.revokeObjectURL(editFoto3Preview);
                          setEditFoto3(null);
                          setEditFoto3Preview(null);
                          setEditRemoveFoto3(true);
                          if (editFoto3InputRef.current) editFoto3InputRef.current.value = "";
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  {editFoto3Preview && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <Check size={12} /> Nueva foto seleccionada
                    </p>
                  )}
                </div>
              </div>

              {editError && (
                <Alert variant="destructive">
                  <AlertDescription>{editError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {!selectedOrder?.shipment && (
            <p className="text-gray-500 text-sm">No hay fotos disponibles.</p>
          )}

          <DialogFooter>
            {isEditingPhotos ? (
              <>
                <Button variant="outline" onClick={resetEditState} disabled={editSubmitting}>
                  Cancelar
                </Button>
                <Button onClick={handleSavePhotos} disabled={editSubmitting}>
                  {editSubmitting ? (
                    <>
                      <Loader2 size={14} className="mr-1 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar cambios"
                  )}
                </Button>
              </>
            ) : (
              <>
                {canEditPhotos && selectedOrder?.shipment && (
                  <Button variant="outline" onClick={() => setIsEditingPhotos(true)}>
                    <Pencil size={14} className="mr-1" />
                    Editar fotos
                  </Button>
                )}
                <Button className="w-full sm:w-auto" onClick={() => setSelectedOrder(null)}>
                  Cerrar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
