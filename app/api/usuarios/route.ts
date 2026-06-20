import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";
import type { UserRole } from "@/app/generated/prisma/client";

// GET /api/usuarios — lista todos los usuarios (solo admin)
export async function GET(request: NextRequest) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const rol = sp.get("rol") as UserRole | null;
  const estado = sp.get("estado");
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const pageSize = 25;

  const where = {
    ...(rol && { role: rol }),
    ...(estado === "activo" && { is_active: true }),
    ...(estado === "inactivo" && { is_active: false }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
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
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  const data = users.map((u) => ({
    ...u,
    created_at: u.created_at.toISOString(),
  }));

  return NextResponse.json({ data, total, page, totalPages: Math.ceil(total / pageSize) });
}

// POST /api/usuarios — crear usuario (solo admin)
export async function POST(request: NextRequest) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  let body: { nombre?: string; email?: string; password?: string; rol?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const nombre = (body.nombre ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const rol = (body.rol ?? "") as UserRole;

  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  if (!email) return NextResponse.json({ error: "El email es obligatorio" }, { status: 400 });
  if (!password) return NextResponse.json({ error: "La contraseña es obligatoria" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });

  const VALID_ROLES: UserRole[] = ["inventario", "embalador", "vendedora_online", "vendedora_tienda"];
  if (!VALID_ROLES.includes(rol)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  // El rol admin solo se puede asignar directamente en base de datos
  if (rol === "admin") {
    return NextResponse.json(
      { error: "No se puede crear un usuario con rol Administrador desde este sistema" },
      { status: 403 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 12);

  const newUser = await prisma.user.create({
    data: {
      name: nombre,
      email,
      password_hash,
      role: rol,
      is_active: true,
      created_by: auth.session.id,
    },
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
      action: "usuario_creado",
      entity_type: "user",
      entity_id: newUser.id,
      data_after: { name: newUser.name, email: newUser.email, role: newUser.role },
      ip_address: getClientIp(request),
    },
  });

  return NextResponse.json(
    { ...newUser, created_at: newUser.created_at.toISOString() },
    { status: 201 }
  );
}
