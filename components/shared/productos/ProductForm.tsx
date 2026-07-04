"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Loader2, ImageOff, X, AlertCircle, Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { optimizeImage, validateImageFile } from "@/lib/image-optimizer";
import type { ProductJSON, VariantInput } from "@/types";

const PREDEFINED_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "UNIQUE"];

const KID_SIZES = ["4", "6", "8", "10", "12", "14", "16"];

export const PREDEFINED_COLORS = [
  "Rojo", "Azul", "Amarillo", "Verde", "Blanco", "Negro", "Gris", "Naranja",
  "Morado", "Rosa", "Marrón", "Turquesa", "Celeste", "Violeta", "Magenta",
  "Beige", "Oliva", "Marino", "Esmeralda", "Escarlata", "Carmín", "Burdeos",
  "Granate", "Lavanda", "Lila", "Salmón", "Coral", "Fucsia", "Índigo",
  "Mostaza", "Ámbar", "Oro", "Caqui", "Crema", "Marfil", "Aguamarina",
];

type Props = {
  initialData?: ProductJSON;
  productId?: string;
  quickSaleLimit?: number;
};

function initVariants(initialData?: ProductJSON): VariantInput[] {
  const predefined = PREDEFINED_SIZES.map((size) => {
    const existing = initialData?.variants.find((v) => v.size === size);
    if (existing) {
      return {
        id: existing.id, size,
        stock_online: existing.stock_online,
        stock_store: existing.stock_store,
        is_active: existing.is_active,
        isNew: false,
      };
    }
    return { size, stock_online: 0, stock_store: 0, is_active: false, isNew: true };
  });

  const custom = (initialData?.variants ?? [])
    .filter((v) => !PREDEFINED_SIZES.includes(v.size))
    .map((v) => ({
      id: v.id, size: v.size,
      stock_online: v.stock_online,
      stock_store: v.stock_store,
      is_active: v.is_active,
      isNew: false,
    }));

  return [...predefined, ...custom];
}

export function ProductForm({ initialData, productId, quickSaleLimit = 4 }: Props) {
  const router = useRouter();
  const isEdit = !!productId;

  const firstVariant = initialData?.variants.find((v) => v.is_active);

  const [name, setName] = useState(initialData?.name ?? "");
  const [type, setType] = useState(initialData?.type ?? "");
  const [color, setColor] = useState<string | null>(initialData?.color ?? null);
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [priceBcv, setPriceBcv] = useState<string>(firstVariant?.price_bcv ? String(firstVariant.price_bcv) : "");
  const [priceDivisas, setPriceDivisas] = useState<string>(firstVariant?.price_divisas ? String(firstVariant.price_divisas) : "");
  const [priceBundleBcv, setPriceBundleBcv] = useState<string>(firstVariant?.price_bundle_bcv ? String(firstVariant.price_bundle_bcv) : "");
  const [priceBundleDivisas, setPriceBundleDivisas] = useState<string>(firstVariant?.price_bundle_divisas ? String(firstVariant.price_bundle_divisas) : "");
  const [priceMayorBcv, setPriceMayorBcv] = useState<string>(firstVariant?.price_mayor_bcv ? String(firstVariant.price_mayor_bcv) : "");
  const [priceMayorDivisas, setPriceMayorDivisas] = useState<string>(firstVariant?.price_mayor_divisas ? String(firstVariant.price_mayor_divisas) : "");
  const [quickSale, setQuickSale] = useState(initialData?.quick_sale ?? false);
  const [photos, setPhotos] = useState<string[]>(initialData?.photos ?? []);
  const [photoInput, setPhotoInput] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [variants, setVariants] = useState<VariantInput[]>(() => initVariants(initialData));
  const [customSizeInput, setCustomSizeInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showKidSizes, setShowKidSizes] = useState(false);
  const [knownCustomSizes, setKnownCustomSizes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customSizeRef = useRef<HTMLInputElement>(null);

  // ── Duplicate check ──────────────────────────────────────────────────────────
  const [duplicate, setDuplicate] = useState<{ id: string; name: string; color: string | null } | null>(null);
  const dupDebounceRef = useRef<NodeJS.Timeout>();

  const checkDuplicate = useCallback((n: string, c: string | null) => {
    clearTimeout(dupDebounceRef.current);
    setDuplicate(null);
    if (isEdit || n.length < 2) return;
    dupDebounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ name: n });
        if (c) params.set("color", c);
        const res = await fetch(`/api/products/check?${params}`);
        const data = await res.json();
        if (data.exists) setDuplicate(data);
      } catch { /* ignore */ }
    }, 400);
  }, [isEdit]);

  // ── Tallas personalizadas guardadas ──────────────────────────────────────────
  useEffect(() => {
    const known = new Set([...PREDEFINED_SIZES, ...KID_SIZES]);
    fetch("/api/products/sizes")
      .then((res) => res.json())
      .then((data) => {
        const sizes: string[] = data.sizes ?? [];
        setKnownCustomSizes(sizes.filter((s) => !known.has(s.toUpperCase())));
      })
      .catch(() => { /* ignore */ });
  }, []);

  // ── Name autocomplete ────────────────────────────────────────────────────────
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameDebounceRef = useRef<NodeJS.Timeout>();

  const fetchNameSuggestions = useCallback((q: string) => {
    clearTimeout(nameDebounceRef.current);
    if (q.length < 2) { setNameSuggestions([]); setShowSuggestions(false); return; }
    nameDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/names?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const names: string[] = data.names ?? [];
        setNameSuggestions(names);
        setShowSuggestions(names.length > 0);
      } catch { /* ignore */ }
    }, 300);
  }, []);

  // ── Photos ───────────────────────────────────────────────────────────────────
  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file, { maxMb: 20 });
    if (validationError) { setPhotoError(validationError); return; }
    setUploading(true);
    setPhotoError("");
    try {
      const optimized = await optimizeImage(file);
      const form = new FormData();
      form.append("file", optimized);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setPhotoError(data.error ?? "Error al subir"); return; }
      setPhotos((prev) => [...prev, data.url]);
    } catch {
      setPhotoError("Error al procesar o subir la imagen. Intenta de nuevo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function addPhoto() {
    const url = photoInput.trim();
    if (!url) return;
    try { new URL(url); } catch {
      setPhotoError("URL inválida"); return;
    }
    setPhotos((prev) => [...prev, url]);
    setPhotoInput("");
    setPhotoError("");
  }

  // ── Variants ─────────────────────────────────────────────────────────────────
  function updateVariant(index: number, field: keyof VariantInput, value: string | number | boolean) {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  }

  function toggleSize(index: number) {
    const nowActive = !variants[index].is_active;
    if (nowActive && quickSale && variants.some((v) => v.is_active)) {
      setError("Venta Rápida requiere una sola talla activa. Desactiva la talla actual antes de elegir otra.");
      return;
    }
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, is_active: nowActive } : v))
    );
  }

  function addSize(rawSize: string): "added" | "duplicate" | "blocked" {
    const size = rawSize.trim().toUpperCase();
    if (!size) return "blocked";
    if (variants.some((v) => v.size.toUpperCase() === size)) return "duplicate";
    if (quickSale && variants.some((v) => v.is_active)) {
      setError("Venta Rápida requiere una sola talla activa. Desactiva la talla actual antes de agregar otra.");
      return "blocked";
    }
    setVariants((prev) => [
      ...prev,
      { size, stock_online: 0, stock_store: 0, is_active: true, isNew: true },
    ]);
    return "added";
  }

  function addCustomSize() {
    const result = addSize(customSizeInput);
    if (result !== "blocked") {
      setCustomSizeInput("");
      setShowCustomInput(false);
    }
  }

  function addKidSize(size: string) {
    addSize(size);
  }

  function removeCustomVariant(index: number) {
    const v = variants[index];
    if (v.id) {
      setVariants((prev) => prev.map((x, i) => i === index ? { ...x, is_active: false } : x));
    } else {
      setVariants((prev) => prev.filter((_, i) => i !== index));
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError("El nombre es requerido"); return; }
    if (!type.trim()) { setError("El tipo es requerido"); return; }
    if (!priceBcv || Number(priceBcv) <= 0) { setError("El precio BCV debe ser mayor a 0"); return; }
    if (photos.length === 0) { setError("Agrega al menos una foto"); return; }

    const variantsToSend = variants.filter((v) => !(v.is_active === false && v.isNew));
    const activeVariants = variantsToSend.filter((v) => v.is_active);

    if (activeVariants.length === 0) { setError("Activa al menos una talla"); return; }
    if (quickSale && activeVariants.length > 1) {
      setError("Venta Rápida requiere exactamente una talla activa");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name, type, color, description,
        price_bcv: Number(priceBcv),
        price_divisas: Number(priceDivisas) || 0,
        price_bundle_bcv: Number(priceBundleBcv) || 0,
        price_bundle_divisas: Number(priceBundleDivisas) || 0,
        price_mayor_bcv: Number(priceMayorBcv) || 0,
        price_mayor_divisas: Number(priceMayorDivisas) || 0,
        photos,
        variants: variantsToSend,
        quick_sale: quickSale,
      };
      const url = isEdit ? `/api/products/${productId}` : "/api/products";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al guardar"); return; }

      const targetId = isEdit ? productId : data.id;
      router.push(`/dashboard/productos/${targetId}`);
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const predefinedVariants = variants.slice(0, PREDEFINED_SIZES.length);
  const customVariants = variants.slice(PREDEFINED_SIZES.length);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <Alert variant="destructive">
          <AlertCircle size={16} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {duplicate && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-amber-800">
              Ya existe &ldquo;{duplicate.name}{duplicate.color ? ` · ${duplicate.color}` : ""}&rdquo;
            </p>
            <p className="mt-0.5 text-amber-700">
              Para agregar tallas, edita el producto existente en lugar de crear uno nuevo.
            </p>
            <a
              href={`/dashboard/productos/${duplicate.id}/editar`}
              className="mt-2 inline-block rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
            >
              Ir a editar ese producto →
            </a>
          </div>
        </div>
      )}

      {/* ── Info básica ───────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Información del producto
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="relative space-y-1.5">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => { setName(e.target.value); fetchNameSuggestions(e.target.value); checkDuplicate(e.target.value, color); }}
              onFocus={() => nameSuggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Ej: Blusa Floral"
              disabled={loading}
              autoComplete="off"
            />
            {showSuggestions && (
              <ul className="absolute z-50 left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto rounded-lg border bg-white py-1 shadow-lg">
                {nameSuggestions.map((s) => (
                  <li key={s}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setName(s); setShowSuggestions(false); }}
                    className="cursor-pointer px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="type">Tipo *</Label>
            <Input id="type" value={type} onChange={(e) => setType(e.target.value)}
              placeholder="Ej: Blusa, Pantalón, Falda" disabled={loading} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="color">Color</Label>
            <select
              id="color"
              value={color ?? ""}
              onChange={(e) => { const v = e.target.value; setColor(v || null); checkDuplicate(name, v || null); }}
              disabled={loading}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="">Sin color</option>
              {PREDEFINED_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Precios *</p>

          <div className="space-y-2">
            <p className="text-xs text-gray-400">Detal (1-2 piezas)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="price_bcv">BCV *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <Input id="price_bcv" type="number" min="0.01" step="0.01" value={priceBcv}
                    onChange={(e) => setPriceBcv(e.target.value)}
                    placeholder="0.00" className="pl-6" disabled={loading} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price_divisas">Divisas</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <Input id="price_divisas" type="number" min="0" step="0.01" value={priceDivisas}
                    onChange={(e) => setPriceDivisas(e.target.value)}
                    placeholder="0.00" className="pl-6" disabled={loading} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-400">Paquete (3-5 piezas)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="price_bundle_bcv">BCV</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <Input id="price_bundle_bcv" type="number" min="0" step="0.01" value={priceBundleBcv}
                    onChange={(e) => setPriceBundleBcv(e.target.value)}
                    placeholder="0.00" className="pl-6" disabled={loading} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price_bundle_divisas">Divisas</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <Input id="price_bundle_divisas" type="number" min="0" step="0.01" value={priceBundleDivisas}
                    onChange={(e) => setPriceBundleDivisas(e.target.value)}
                    placeholder="0.00" className="pl-6" disabled={loading} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-400">Mayoreo (6+ piezas)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="price_mayor_bcv">BCV</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <Input id="price_mayor_bcv" type="number" min="0" step="0.01" value={priceMayorBcv}
                    onChange={(e) => setPriceMayorBcv(e.target.value)}
                    placeholder="0.00" className="pl-6" disabled={loading} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price_mayor_divisas">Divisas</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <Input id="price_mayor_divisas" type="number" min="0" step="0.01" value={priceMayorDivisas}
                    onChange={(e) => setPriceMayorDivisas(e.target.value)}
                    placeholder="0.00" className="pl-6" disabled={loading} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Descripción</Label>
          <Textarea id="description" value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción opcional del producto…" rows={3} disabled={loading} />
        </div>

        <label className="flex cursor-pointer select-none items-start gap-2 text-sm">
          <input type="checkbox" checked={quickSale}
            onChange={(e) => {
              const checked = e.target.checked;
              if (checked && variants.filter((v) => v.is_active).length > 1) {
                setError("Antes de activar Venta Rápida, desactiva todas las tallas menos una.");
                return;
              }
              setQuickSale(checked);
            }}
            disabled={loading}
            className="mt-0.5 rounded border-gray-300" />
          <span>
            Mostrar en Venta Rápida (tienda)
            <span className="block text-xs text-gray-400">
              Máximo {quickSaleLimit} producto{quickSaleLimit !== 1 ? "s" : ""} pueden estar marcados a la vez, y cada uno debe tener una sola talla activa.
            </span>
          </span>
        </label>
      </section>

      <Separator />

      {/* ── Fotos ─────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Fotos</h2>

        <div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden" onChange={uploadFile} disabled={loading || uploading} />
          <Button type="button" variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploading} className="w-full border-dashed py-6">
            {uploading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Upload size={16} className="mr-2" />}
            {uploading ? "Subiendo…" : "Subir foto desde el computador"}
          </Button>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="h-px flex-1 bg-gray-200" />o pega una URL<div className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="flex gap-2">
          <Input value={photoInput}
            onChange={(e) => { setPhotoInput(e.target.value); setPhotoError(""); }}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPhoto())}
            placeholder="https://ejemplo.com/foto.jpg" disabled={loading || uploading}
            className={photoError ? "border-red-400" : ""} />
          <Button type="button" variant="outline" onClick={addPhoto} disabled={loading || uploading}>
            <Plus size={16} />
          </Button>
        </div>
        {photoError && <p className="text-xs text-red-500">{photoError}</p>}

        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {photos.map((url, i) => (
              <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <div className="absolute inset-0 hidden items-center justify-center bg-gray-100 group-has-[img[style*='none']]:flex">
                  <ImageOff size={20} className="text-gray-400" />
                </div>
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 rounded bg-gray-900/70 px-1.5 py-0.5 text-[10px] text-white">
                    Principal
                  </span>
                )}
                <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                  disabled={loading}
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-gray-600 opacity-0 transition-opacity group-hover:opacity-100">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* ── Tallas y Stock ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Tallas y Stock
        </h2>

        <div className="grid grid-cols-[2rem_3rem_1fr_1fr_2.5rem] items-center gap-3 px-1">
          <span />
          <span className="text-center text-xs text-gray-400">Talla</span>
          <span className="text-center text-xs text-gray-400">Online</span>
          <span className="text-center text-xs text-gray-400">Tienda</span>
          <span />
        </div>

        <div className="space-y-2">
          {predefinedVariants.map((v, i) => (
            <div
              key={v.size}
              className={cn(
                "grid grid-cols-[2rem_3rem_1fr_1fr_2.5rem] items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                v.is_active ? "bg-white" : "bg-gray-50 opacity-60"
              )}
            >
              <button
                type="button"
                onClick={() => toggleSize(i)}
                disabled={loading || (!v.is_active && quickSale && variants.some((x) => x.is_active))}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  v.is_active
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 bg-white"
                )}
                aria-label={v.is_active ? "Desactivar talla" : "Activar talla"}
              >
                {v.is_active && (
                  <svg viewBox="0 0 10 8" className="h-3 w-3 fill-none stroke-current stroke-2">
                    <polyline points="1,4 4,7 9,1" />
                  </svg>
                )}
              </button>

              <div className="flex justify-center">
                <Badge variant={v.is_active ? "secondary" : "outline"} className="text-xs">
                  {v.size}
                </Badge>
              </div>

              <Input
                type="number" min="0" value={v.stock_online}
                onChange={(e) => updateVariant(i, "stock_online", parseInt(e.target.value) || 0)}
                disabled={loading || !v.is_active} className="h-8 text-center"
              />
              <Input
                type="number" min="0" value={v.stock_store}
                onChange={(e) => updateVariant(i, "stock_store", parseInt(e.target.value) || 0)}
                disabled={loading || !v.is_active} className="h-8 text-center"
              />
              <span className={cn(
                "text-center text-sm font-semibold",
                !v.is_active ? "text-gray-300" : v.stock_online + v.stock_store < 3 ? "text-amber-600" : "text-gray-700"
              )}>
                {v.is_active ? v.stock_online + v.stock_store : "—"}
              </span>
            </div>
          ))}
        </div>

        {customVariants.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs text-gray-400">Tallas personalizadas</p>
            {customVariants.map((v, ci) => {
              const i = PREDEFINED_SIZES.length + ci;
              return (
                <div
                  key={v.id ?? v.size}
                  className={cn(
                    "grid grid-cols-[2rem_3rem_1fr_1fr_2.5rem] items-center gap-3 rounded-lg border px-3 py-2",
                    v.is_active ? "bg-white" : "bg-gray-50 opacity-60"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleSize(i)}
                    disabled={loading || (!v.is_active && quickSale && variants.some((x) => x.is_active))}
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      v.is_active
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-300 bg-white"
                    )}
                    aria-label={v.is_active ? "Desactivar talla" : "Activar talla"}
                  >
                    {v.is_active && (
                      <svg viewBox="0 0 10 8" className="h-3 w-3 fill-none stroke-current stroke-2">
                        <polyline points="1,4 4,7 9,1" />
                      </svg>
                    )}
                  </button>
                  <div className="flex justify-center">
                    <Badge variant="outline" className="text-xs">{v.size}</Badge>
                  </div>
                  <Input
                    type="number" min="0" value={v.stock_online}
                    onChange={(e) => updateVariant(i, "stock_online", parseInt(e.target.value) || 0)}
                    disabled={loading || !v.is_active} className="h-8 text-center"
                  />
                  <Input
                    type="number" min="0" value={v.stock_store}
                    onChange={(e) => updateVariant(i, "stock_store", parseInt(e.target.value) || 0)}
                    disabled={loading || !v.is_active} className="h-8 text-center"
                  />
                  {v.id ? (
                    <span />
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeCustomVariant(i)}
                      disabled={loading}
                      className="flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showKidSizes && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-gray-200 p-3">
            <p className="w-full text-xs text-gray-400">Tallas de niño</p>
            {KID_SIZES.filter((size) => !variants.some((v) => v.size.toUpperCase() === size)).map((size) => (
              <button
                type="button"
                key={size}
                onClick={() => addKidSize(size)}
                disabled={quickSale && variants.some((v) => v.is_active)}
                className="inline-flex h-5 items-center justify-center rounded-4xl border border-border px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              >
                {size}
              </button>
            ))}
          </div>
        )}

        {showCustomInput && (
          <div className="space-y-2 pt-1">
            {knownCustomSizes.filter((s) => !variants.some((v) => v.size.toUpperCase() === s.toUpperCase())).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-gray-400">Usadas antes:</span>
                {knownCustomSizes
                  .filter((s) => !variants.some((v) => v.size.toUpperCase() === s.toUpperCase()))
                  .map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => addSize(s)}
                      className="inline-flex h-5 items-center justify-center rounded-4xl border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                ref={customSizeRef}
                value={customSizeInput}
                onChange={(e) => setCustomSizeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addCustomSize(); }
                  if (e.key === "Escape") { setShowCustomInput(false); setCustomSizeInput(""); }
                }}
                placeholder="Ej: 38, 40, XXXL…"
                className="h-8 w-40 text-sm"
                autoFocus
              />
              <Button type="button" size="sm" onClick={addCustomSize} disabled={!customSizeInput.trim()}>
                Agregar
              </Button>
              <Button type="button" variant="ghost" size="sm"
                onClick={() => { setShowCustomInput(false); setCustomSizeInput(""); }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {!showCustomInput && (
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => setShowCustomInput(true)}
              disabled={quickSale && variants.some((v) => v.is_active)}
              className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline disabled:hover:text-gray-400"
            >
              + Agregar talla personalizada
            </button>
            <button
              type="button"
              onClick={() => setShowKidSizes((prev) => !prev)}
              className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
            >
              {showKidSizes ? "Ocultar tallas de niño" : "+ Tallas de niño"}
            </button>
          </div>
        )}
      </section>

      {/* ── Acciones ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={loading || uploading || !!duplicate}>
          {loading
            ? <><Loader2 size={16} className="mr-2 animate-spin" />Guardando…</>
            : isEdit ? "Guardar cambios" : "Crear producto"
          }
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={loading || uploading}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
