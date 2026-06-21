"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_BY_ROLE, isNavActive } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/auth";
import type { SessionUser } from "@/types";

type SidebarProps = {
  session: SessionUser;
};

export function Sidebar({ session }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = NAV_BY_ROLE[session.role] ?? [];

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center border-b px-5">
        <span className="text-base font-semibold text-gray-900">
          Cenicola<span className="text-blue-600">&apos;s hub</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isNavActive(pathname, item.href, navItems);
            const Icon = item.icon;
            return (
              <li key={item.href + item.label}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium transition-colors",
                    active
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User info + logout */}
      <div className="shrink-0 border-t p-5">
        <div className="mb-3.5 min-w-0">
          <p className="truncate text-[15px] font-medium text-gray-900">{session.name}</p>
          <p className="truncate text-sm text-gray-500">{ROLE_LABELS[session.role]}</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-[15px] text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          {loggingOut ? (
            <Loader2 size={17} className="shrink-0 animate-spin" />
          ) : (
            <LogOut size={17} className="shrink-0" />
          )}
          Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:bg-white">
        {sidebarContent}
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="sticky top-0 z-20 flex h-16 items-center border-b bg-white px-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>
        <span className="ml-3 text-base font-semibold text-gray-900">
          Cenicola<span className="text-blue-600">&apos;s hub</span>
        </span>
      </div>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r bg-white transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="absolute right-3 top-3">
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-2 text-gray-400 hover:bg-gray-100"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>
        {sidebarContent}
      </aside>
    </>
  );
}
