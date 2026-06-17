import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";

const CATEGORIAS = ["operativo", "logistica", "nomina", "otro"] as const;

export async function GET(request: NextRequest) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const categoria = sp.get("categoria") ?? "";
  const desde = sp.get("desde") ?? "";
  const hasta = sp.get("hasta") ?? "";

  const where = {
    ...(categoria && { category: categoria }),
    ...(desde && hasta
      ? { expense_date: { gte: new Date(desde), lte: new Date(hasta) } }
      : desde
      ? { expense_date: { gte: new Date(desde) } }
      : hasta
      ? { expense_date: { lte: new Date(hasta) } }
      : {}),
  };

  const gastos = await prisma.expense.findMany({
    where,
    include: { creator: { select: { id: true, name: true } } },
    orderBy: { expense_date: "desc" },
  });

  const data = gastos.map((g) => ({
    id: g.id,
    category: g.category,
    description: g.description,
    amount_usd: Number(g.amount_usd),
    expense_date: g.expense_date.toISOString().slice(0, 10),
    notas: g.notas,
    creator: g.creator,
    created_at: g.created_at.toISOString(),
  }));

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { descripcion, monto, categoria, fecha, notas } = body;

  if (!descripcion?.trim()) return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
  if (!monto || isNaN(Number(monto)) || Number(monto) <= 0)
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  if (!CATEGORIAS.includes(categoria))
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });

  const fechaDate = fecha ? new Date(fecha) : new Date();
  if (isNaN(fechaDate.getTime()))
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

  const ip = getClientIp(request);

  const gasto = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.expense.create({
      data: {
        description: descripcion.trim(),
        amount_usd: parseFloat(Number(monto).toFixed(2)),
        category: categoria,
        expense_date: fechaDate,
        notas: notas?.trim() || null,
        created_by: auth.session.id,
      },
    });

    await tx.auditLog.create({
      data: {
        user_id: auth.session.id,
        action: "CREATE",
        entity_type: "Expense",
        entity_id: nuevo.id,
        data_after: {
          description: nuevo.description,
          amount_usd: Number(nuevo.amount_usd),
          category: nuevo.category,
          expense_date: nuevo.expense_date.toISOString().slice(0, 10),
        },
        ip_address: ip,
      },
    });

    return nuevo;
  });

  return NextResponse.json({ id: gasto.id }, { status: 201 });
}
