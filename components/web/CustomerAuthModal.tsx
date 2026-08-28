"use client";

import Link from "next/link";
import { User, LogIn, Search, X, PackageCheck, ShoppingBag } from "lucide-react";

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  loginUrl?: string;
  searchOrderUrl?: string;
}

export function CustomerAuthModal({
  isOpen,
  onClose,
  loginUrl = "/login",
  searchOrderUrl = "/buscar-pedido",
}: CustomerAuthModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-0 duration-200"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón de cierre */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Ícono y Encabezado */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-sm border border-blue-100">
            <User className="h-8 w-8" />
          </div>

          <h3 className="text-xl font-bold text-gray-900">Tu Cuenta Cenicola</h3>

          <p className="mt-3 text-sm leading-relaxed text-gray-600 font-medium">
            Si deseas saber información de tu pedido o gestionar tus compras, inicia sesión.
          </p>
        </div>

        {/* Vista previa de ventajas */}
        <div className="mt-6 rounded-xl bg-gray-50 p-4 border border-gray-100 space-y-2.5">
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <PackageCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Consulta el estado en tiempo real de tu pedido y guía de envío.</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <ShoppingBag className="h-4 w-4 text-blue-600 shrink-0" />
            <span>Accede a tu historial de compras y comprobantes de pago.</span>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={loginUrl}
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-gray-800 active:scale-[0.99] transition-all"
          >
            <LogIn className="h-4 w-4" />
            Iniciar sesión
          </Link>

          <Link
            href={searchOrderUrl}
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:scale-[0.99] transition-all"
          >
            <Search className="h-4 w-4 text-gray-500" />
            Buscar o consultar un pedido
          </Link>
        </div>
      </div>
    </div>
  );
}
