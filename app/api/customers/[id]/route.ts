import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";

const DOC_TYPES = ["V", "P", "J", "E"] as const;
const PHONE_RE = /^0\d{9,10}$/;

// GET /api/customers/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } },
  });
  if (!customer) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  return NextResponse.json({
    ...customer,
    created_at: customer.created_at.toISOString(),
    updated_at: customer.updated_at.toISOString(),
  });
}

// PUT /api/customers/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { doc_type, doc_number, name, lastname, address, phone, email } = body;

  if (doc_type && !DOC_TYPES.includes(doc_type)) {
    return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 });
  }
  if (phone?.trim() && !PHONE_RE.test(phone.trim())) {
    return NextResponse.json({ error: "Número de teléfono inválido" }, { status: 400 });
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const cleanEmail = email !== undefined ? (email?.trim() ? email.trim().toLowerCase() : null) : undefined;
  if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
    return NextResponse.json({ error: "Correo electrónico inválido" }, { status: 400 });
  }

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  if (cleanEmail !== undefined && cleanEmail !== existing.email?.toLowerCase()) {
    if (cleanEmail) {
      const emailOwner = await prisma.customer.findFirst({
        where: {
          email: cleanEmail,
          id: { not: id },
        },
      });
      if (emailOwner) {
        return NextResponse.json(
          { error: "El correo electrónico ya está registrado por otro cliente" },
          { status: 409 }
        );
      }
    }
  }

  const newDocType = doc_type || existing.doc_type;
  const newDocNumber = doc_number?.trim() || existing.doc_number;
  if (newDocType !== existing.doc_type || newDocNumber !== existing.doc_number) {
    const docOwner = await prisma.customer.findFirst({
      where: {
        doc_type: newDocType,
        doc_number: newDocNumber,
        id: { not: id },
      },
    });
    if (docOwner) {
      return NextResponse.json(
        { error: `Ya existe otro cliente registrado con la cédula ${newDocType}-${newDocNumber}` },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.customer.update({
    where: { id },
    data: {
      ...(doc_type && { doc_type }),
      ...(doc_number?.trim() && { doc_number: doc_number.trim() }),
      ...(name?.trim() && { name: name.trim() }),
      ...(lastname?.trim() && { lastname: lastname.trim() }),
      address: address !== undefined ? (address?.trim() || null) : existing.address,
      phone: phone !== undefined ? (phone?.trim() || null) : existing.phone,
      ...(cleanEmail !== undefined && { email: cleanEmail }),
    },
  });

  return NextResponse.json({
    ...updated,
    created_at: updated.created_at.toISOString(),
    updated_at: updated.updated_at.toISOString(),
  });
}

// DELETE /api/customers/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
