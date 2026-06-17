import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, SESSION_COOKIE, SESSION_DURATION_SECONDS } from "@/lib/session";
import { getDefaultRedirect } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let email: string;
  let password: string;

  try {
    const body = await request.json();
    email = (body.email ?? "").trim().toLowerCase();
    password = body.password ?? "";
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Completa todos los campos" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Respuesta genérica para no revelar si el email existe
  if (!user) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  if (!user.is_active) {
    return NextResponse.json(
      { error: "Tu cuenta está desactivada. Contacta al administrador." },
      { status: 403 }
    );
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
  };

  const token = await createSession(sessionUser);
  const redirectTo = getDefaultRedirect(user.role);

  const response = NextResponse.json({ redirectTo });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
  });

  return response;
}
