import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { SessionUser } from "@/types";
import type { UserRole } from "@/app/generated/prisma/client";

type AuthOk = { ok: true; session: SessionUser };
type AuthFail = { ok: false; response: NextResponse };
export type AuthResult = AuthOk | AuthFail;

// Re-validates the JWT session against the DB so that deactivated users and
// role changes take effect immediately without waiting for the token to expire.
async function resolveUser(session: SessionUser): Promise<SessionUser | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, name: true, email: true, role: true, is_active: true },
    });
    if (!user || !user.is_active) return null;
    return { ...session, role: user.role, is_active: user.is_active };
  } catch {
    // If the DB is unreachable, fail closed — no access granted
    return null;
  }
}

export async function withAuth(): Promise<AuthResult> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  const user = await resolveUser(session);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  return { ok: true, session: user };
}

export async function withRole(allowed: UserRole[]): Promise<AuthResult> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  const user = await resolveUser(session);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  if (!allowed.includes(user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }),
    };
  }

  return { ok: true, session: user };
}

export function getClientIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}
