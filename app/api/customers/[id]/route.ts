import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";

const DOC_TYPES = ["V", "P", "J", "E"] as const;

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

  const { doc_type, doc_number, name, lastname, address } = body;

  if (doc_type && !DOC_TYPES.includes(doc_type)) {
    return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 });
  }

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const updated = await prisma.customer.update({
    where: { id },
    data: {
      ...(doc_type && { doc_type }),
      ...(doc_number?.trim() && { doc_number: doc_number.trim() }),
      ...(name?.trim() && { name: name.trim() }),
      ...(lastname?.trim() && { lastname: lastname.trim() }),
      address: address !== undefined ? (address?.trim() || null) : existing.address,
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
