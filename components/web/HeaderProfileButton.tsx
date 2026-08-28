"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { CustomerAuthModal } from "./CustomerAuthModal";

interface HeaderProfileButtonProps {
  isLoggedIn?: boolean;
  customerName?: string;
  onProfileClick?: () => void;
  loginUrl?: string;
  searchOrderUrl?: string;
  className?: string;
}

export function HeaderProfileButton({
  isLoggedIn = false,
  customerName,
  onProfileClick,
  loginUrl = "/login",
  searchOrderUrl = "/buscar-pedido",
  className = "",
}: HeaderProfileButtonProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }

    if (isLoggedIn) {
      if (onProfileClick) {
        onProfileClick();
      } else {
        window.location.href = "/mis-pedidos";
      }
    } else {
      setShowAuthModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`relative flex items-center gap-2 rounded-full p-2 text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900/10 ${className}`}
        title={isLoggedIn ? `Perfil de ${customerName || "Cliente"}` : "Iniciar sesión / Perfil"}
        aria-label="Perfil de usuario"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-colors">
          <User className="h-5 w-5" />
        </div>
        {isLoggedIn && customerName && (
          <span className="hidden md:inline-block text-sm font-medium text-gray-800">
            {customerName}
          </span>
        )}
      </button>

      <CustomerAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        loginUrl={loginUrl}
        searchOrderUrl={searchOrderUrl}
      />
    </>
  );
}
