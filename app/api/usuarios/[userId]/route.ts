import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";
import type { UserRole } from "@/app/generated/prisma/client";

type Params = { params: { userId: string } };

// GET /api/usuarios/[userId]
export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      is_active: true,
      created_by: true,
      created_at: true,
      creator: { select: { id: true, name: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ...user, created_at: user.created_at.toISOString() });
}

// PUT /api/usuarios/[userId]
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  let body: { nombre?: string; email?: string; password?: string; rol?: string; activo?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const nombre = (body.nombre ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = (body.password ?? "").trim();
  const rol = (body.rol ?? "") as UserRole;
  const activo = body.activo ?? true;

  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  if (!email) return NextResponse.json({ error: "El email es obligatorio" }, { status: 400 });

  const VALID_ROLES: UserRole[] = ["admin", "inventario", "embalador", "vendedora_online", "vendedora_tienda"];
  if (!VALID_ROLES.includes(rol)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  if (password && password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }

  const isSelf = params.userId === auth.session.id;

  if (isSelf && !activo) {
    return NextResponse.json({ error: "No puedes desactivar tu propia cuenta" }, { status: 400 });
  }

  if (isSelf && rol !== auth.session.role) {
    return NextResponse.json({ error: "No puedes cambiar tu propio rol" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!existing) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Si el usuario ya es admin, su rol no puede ser cambiado desde el sistema
  if (existing.role === "admin" && rol !== "admin") {
    return NextResponse.json(
      { error: "El rol Administrador no puede cambiarse desde este sistema" },
      { status: 403 }
    );
  }

  // No se puede asignar el rol admin a un usuario que no lo tenía
  if (existing.role !== "admin" && rol === "admin") {
    return NextResponse.json(
      { error: "No se puede asignar el rol Administrador desde este sistema" },
      { status: 403 }
    );
  }

  // Check email uniqueness (excluding current user)
  const emailConflict = await prisma.user.findFirst({
    where: { email, NOT: { id: params.userId } },
  });
  if (emailConflict) {
    return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
  }

  const updateData: {
    name: string;
    email: string;
    role: UserRole;
    is_active: boolean;
    password_hash?: string;
  } = {
    name: nombre,
    email,
    role: rol,
    is_active: activo,
  };

  if (password) {
    updateData.password_hash = await bcrypt.hash(password, 12);
  }

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      is_active: true,
      created_at: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      user_id: auth.session.id,
      action: "usuario_editado",
      entity_type: "user",
      entity_id: updated.id,
      data_before: {
        name: existing.name,
        email: existing.email,
        role: existing.role,
        is_active: existing.is_active,
      },
      data_after: {
        name: updated.name,
        email: updated.email,
        role: updated.role,
        is_active: updated.is_active,
      },
      ip_address: getClientIp(request),
    },
  });

  return NextResponse.json({ ...updated, created_at: updated.created_at.toISOString() });
}
