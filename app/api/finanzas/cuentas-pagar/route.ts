import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";

export async function GET(_request: NextRequest) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const cuentas = await prisma.accountPayable.findMany({
    include: { creator: { select: { id: true, name: true } } },
    orderBy: { created_at: "desc" },
  });

  const data = cuentas.map((c) => ({
    id: c.id,
    proveedor: c.proveedor,
    descripcion: c.descripcion,
    monto: Number(c.monto),
    fecha_vencimiento: c.fecha_vencimiento
      ? c.fecha_vencimiento.toISOString().slice(0, 10)
      : null,
    status: c.status,
    paid_at: c.paid_at ? c.paid_at.toISOString() : null,
    creator: c.creator,
    created_at: c.created_at.toISOString(),
  }));

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { proveedor, descripcion, monto, fecha_vencimiento } = body;

  if (!proveedor?.trim()) return NextResponse.json({ error: "Nombre del proveedor requerido" }, { status: 400 });
  if (!descripcion?.trim()) return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
  if (!monto || isNaN(Number(monto)) || Number(monto) <= 0)
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 });

  const vencimiento = fecha_vencimiento ? new Date(fecha_vencimiento) : null;
  if (vencimiento && isNaN(vencimiento.getTime()))
    return NextResponse.json({ error: "Fecha de vencimiento inválida" }, { status: 400 });

  const ip = getClientIp(request);

  const cuenta = await prisma.$transaction(async (tx) => {
    const nueva = await tx.accountPayable.create({
      data: {
        proveedor: proveedor.trim(),
        descripcion: descripcion.trim(),
        monto: parseFloat(Number(monto).toFixed(2)),
        fecha_vencimiento: vencimiento,
        created_by: auth.session.id,
      },
    });

    await tx.auditLog.create({
      data: {
        user_id: auth.session.id,
        action: "CREATE",
        entity_type: "AccountPayable",
        entity_id: nueva.id,
        data_after: {
          proveedor: nueva.proveedor,
          descripcion: nueva.descripcion,
          monto: Number(nueva.monto),
        },
        ip_address: ip,
      },
    });

    return nueva;
  });

  return NextResponse.json({ id: cuenta.id }, { status: 201 });
}
