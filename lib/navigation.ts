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
  { label: "Pagos",       href: "/dashboard/pagos",       icon: CreditCard },
  { label: "Embalaje",    href: "/dashboard/embalaje",    icon: PackageCheck },
  { label: "Finanzas",    href: "/dashboard/finanzas",    icon: BarChart3 },
];

const INVENTARIO_NAV: NavItem[] = [
  { label: "Dashboard",   href: "/dashboard",             icon: LayoutDashboard },
  { label: "Productos",   href: "/dashboard/productos",   icon: Package },
  { label: "Inventario",  href: "/dashboard/inventario",  icon: Boxes },
  { label: "Órdenes",     href: "/dashboard/ordenes",     icon: ShoppingCart },
  { label: "Pagos",       href: "/dashboard/pagos",       icon: CreditCard },
  { label: "Embalaje",    href: "/dashboard/embalaje",    icon: PackageCheck },
];

export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  admin:            ADMIN_NAV,
  inventario:       INVENTARIO_NAV,
  embalador: [
    { label: "Embalaje",  href: "/dashboard/embalaje",          icon: PackageCheck },
    { label: "Enviadas",  href: "/dashboard/embalaje/enviadas", icon: Truck },
  ],
  vendedora_online: [
    { label: "Mis Ventas",   href: "/dashboard/ordenes",        icon: ShoppingBag },
    { label: "Nueva Venta",  href: "/dashboard/ordenes/nueva",  icon: PlusCircle },
    { label: "Productos",    href: "/dashboard/productos",      icon: Package },
  ],
  vendedora_tienda: [
    { label: "Mis Ventas",   href: "/dashboard/ordenes",        icon: ShoppingBag },
    { label: "Nueva Venta",  href: "/dashboard/ordenes/nueva",  icon: PlusCircle },
    { label: "Productos",    href: "/dashboard/productos",      icon: Package },
  ],
};

export function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Prefix match solo para rutas que van más allá de un primer segmento
  if (href.split("/").length > 2 && pathname.startsWith(href + "/")) return true;
  return false;
}
