import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, withRole } from "@/lib/api-auth";

const DOC_TYPES = ["V", "P", "J", "E"] as const;

// GET /api/customers
export async function GET(request: NextRequest) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const pageSize = 25;

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { lastname: { contains: q, mode: "insensitive" as const } },
          { doc_number: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: { _count: { select: { orders: true } } },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  const data = customers.map((c) => ({
    ...c,
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
  }));

  return NextResponse.json({ data, total, page, totalPages: Math.ceil(total / pageSize) });
}

// POST /api/customers
export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { doc_type, doc_number, name, lastname, address } = body;

  if (!DOC_TYPES.includes(doc_type)) {
    return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 });
  }
  if (!doc_number?.trim()) return NextResponse.json({ error: "Número de documento requerido" }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  if (!lastname?.trim()) return NextResponse.json({ error: "Apellido requerido" }, { status: 400 });

  const customer = await prisma.customer.upsert({
    where: { doc_type_doc_number: { doc_type, doc_number: doc_number.trim() } },
    update: {
      name: name.trim(),
      lastname: lastname.trim(),
      address: address?.trim() || null,
    },
    create: {
      doc_type,
      doc_number: doc_number.trim(),
      name: name.trim(),
      lastname: lastname.trim(),
      address: address?.trim() || null,
    },
  });

  return NextResponse.json({
    ...customer,
    created_at: customer.created_at.toISOString(),
    updated_at: customer.updated_at.toISOString(),
  });
}
