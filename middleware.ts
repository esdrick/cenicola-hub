import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "cenicola_session";
const PUBLIC_PATHS = ["/login", "/api/auth"];

function getSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET env var is required but not set");
  return new TextEncoder().encode(secret);
}

type UserRole =
  | "admin"
  | "inventario"
  | "embalador"
  | "vendedora_online"
  | "vendedora_tienda";

type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

const ALLOWED_PATHS: Record<UserRole, string[]> = {
  admin:             ["/dashboard"],
  inventario:        ["/dashboard"],
  embalador:         ["/dashboard/embalaje"],
  vendedora_online:  ["/dashboard", "/dashboard/ordenes", "/dashboard/productos", "/dashboard/carritos"],
  vendedora_tienda:  ["/dashboard", "/dashboard/ordenes", "/dashboard/productos", "/dashboard/carritos"],
};

const DEFAULT_REDIRECT: Record<UserRole, string> = {
  admin:             "/dashboard",
  inventario:        "/dashboard",
  embalador:         "/dashboard/embalaje",
  vendedora_online:  "/dashboard",
  vendedora_tienda:  "/dashboard",
};

// Exact match OR the path is a sub-route (starts with allowed + "/")
// This prevents "/dashboard" from granting access to "/dashboard/embalaje"
function canAccess(role: UserRole, path: string): boolean {
  return ALLOWED_PATHS[role]?.some((p) => path === p || path.startsWith(p + "/")) ?? false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const user = payload as unknown as SessionUser;

    if (pathname.startsWith("/dashboard") && !canAccess(user.role, pathname)) {
      return NextResponse.redirect(
        new URL(DEFAULT_REDIRECT[user.role] ?? "/dashboard", request.url)
      );
    }

    return NextResponse.next();
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|swe-worker-.*|workbox-.*|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
