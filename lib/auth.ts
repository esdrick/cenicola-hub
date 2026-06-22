import type { UserRole } from "@/app/generated/prisma/client";

export type { UserRole };

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  inventario: "Inventario",
  embalador: "Embalador",
  vendedora_online: "Vendedora Online",
  vendedora_tienda: "Vendedora Tienda",
};

// Prefijos de ruta que cada rol puede visitar (evaluado con startsWith)
export const ROLE_ALLOWED_PATHS: Record<UserRole, string[]> = {
  admin: ["/dashboard"],
  inventario: ["/dashboard"],
  embalador: ["/dashboard/embalaje"],
  vendedora_online: ["/dashboard/ordenes", "/dashboard/productos"],
  vendedora_tienda: ["/dashboard/ordenes", "/dashboard/productos"],
};

export function canAccessPath(role: UserRole, path: string): boolean {
  if (role === "admin" || role === "inventario") return true;

  const allowed = ROLE_ALLOWED_PATHS[role] ?? [];
  return allowed.some((allowedPath) => path.startsWith(allowedPath));
}

export function getDefaultRedirect(role: UserRole): string {
  const paths: Record<UserRole, string> = {
    admin: "/dashboard",
    inventario: "/dashboard",
    embalador: "/dashboard/embalaje",
    vendedora_online: "/dashboard",
    vendedora_tienda: "/dashboard",
  };
  return paths[role] ?? "/dashboard";
}
