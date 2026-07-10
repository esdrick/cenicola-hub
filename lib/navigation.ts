import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  CreditCard,
  BarChart3,
  PackageCheck,
  PlusCircle,
  ShoppingBag,
  Truck,
  Users,
  UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/app/generated/prisma/client";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard",   href: "/dashboard",             icon: LayoutDashboard },
  { label: "Productos",   href: "/dashboard/productos",   icon: Package },
  { label: "Inventario",  href: "/dashboard/inventario",  icon: Boxes },
  { label: "Órdenes",     href: "/dashboard/ordenes",     icon: ShoppingCart },
  { label: "Clientes",    href: "/dashboard/clientes",    icon: Users },
  { label: "Pagos",       href: "/dashboard/pagos",       icon: CreditCard },
  { label: "Embalaje",    href: "/dashboard/embalaje",    icon: PackageCheck },
  { label: "Finanzas",    href: "/dashboard/finanzas",    icon: BarChart3 },
  { label: "Usuarios",    href: "/dashboard/usuarios",    icon: UserCog },
];

const INVENTARIO_NAV: NavItem[] = [
  { label: "Dashboard",   href: "/dashboard",             icon: LayoutDashboard },
  { label: "Productos",   href: "/dashboard/productos",   icon: Package },
  { label: "Inventario",  href: "/dashboard/inventario",  icon: Boxes },
  { label: "Órdenes",     href: "/dashboard/ordenes",     icon: ShoppingCart },
  { label: "Embalaje",    href: "/dashboard/embalaje",    icon: PackageCheck },
  { label: "Pagos",       href: "/dashboard/pagos",       icon: CreditCard },
];

export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  admin:            ADMIN_NAV,
  inventario:       INVENTARIO_NAV,
  embalador: [
    { label: "Embalaje",  href: "/dashboard/embalaje",          icon: PackageCheck },
    { label: "Enviadas",  href: "/dashboard/embalaje/enviadas", icon: Truck },
  ],
  vendedora_online: [
    { label: "Dashboard",    href: "/dashboard",                icon: LayoutDashboard },
    { label: "Nueva Venta",  href: "/dashboard/ordenes/nueva",  icon: PlusCircle },
    { label: "Mis Ventas",   href: "/dashboard/ordenes",        icon: ShoppingBag },
    { label: "Productos",    href: "/dashboard/productos",      icon: Package },
    { label: "Embalaje",     href: "/dashboard/embalaje",       icon: PackageCheck },
  ],
  vendedora_tienda: [
    { label: "Dashboard",    href: "/dashboard",                icon: LayoutDashboard },
    { label: "Nueva Venta",  href: "/dashboard/ordenes/nueva",  icon: PlusCircle },
    { label: "Mis Ventas",   href: "/dashboard/ordenes",        icon: ShoppingBag },
    { label: "Productos",    href: "/dashboard/productos",      icon: Package },
  ],
};

export function isNavActive(pathname: string, href: string, allItems: NavItem[]): boolean {
  if (pathname === href) return true;
  // Prefix match: only if no other nav item matches the pathname exactly
  if (href.split("/").length > 2 && pathname.startsWith(href + "/")) {
    const hasExactMatch = allItems.some((item) => item.href !== href && item.href === pathname);
    return !hasExactMatch;
  }
  return false;
}
