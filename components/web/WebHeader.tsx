"use client";

import Link from "next/link";
import { HeaderProfileButton } from "./HeaderProfileButton";
import { Search } from "lucide-react";

interface WebHeaderProps {
  isLoggedIn?: boolean;
  customerName?: string;
  loginUrl?: string;
  searchOrderUrl?: string;
}

export function WebHeader({
  isLoggedIn = false,
  customerName,
  loginUrl = "/login",
  searchOrderUrl = "/buscar-pedido",
}: WebHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 shadow-xs">
            <span className="text-base font-bold text-white">C</span>
          </div>
          <span className="text-lg font-bold text-gray-900 tracking-tight">CENICOLA</span>
        </Link>

        {/* Acciones del encabezado */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href={searchOrderUrl}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            title="Buscar o consultar pedido"
          >
            <Search className="h-4 w-4 text-gray-500" />
            <span className="hidden sm:inline-block">Buscar Pedido</span>
          </Link>

          {/* Botón de Perfil con apertura de Modal si no hay sesión */}
          <HeaderProfileButton
            isLoggedIn={isLoggedIn}
            customerName={customerName}
            loginUrl={loginUrl}
            searchOrderUrl={searchOrderUrl}
          />
        </div>
      </div>
    </header>
  );
}
