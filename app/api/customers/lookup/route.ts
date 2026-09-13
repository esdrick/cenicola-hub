import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

const DOC_TYPES = ["V", "P", "J", "E"] as const;

// GET /api/customers/lookup?doc_type=V&doc_number=12345678
export async function GET(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const doc_type = sp.get("doc_type") ?? "";
  const doc_number = sp.get("doc_number")?.trim() ?? "";

  if (!DOC_TYPES.includes(doc_type as (typeof DOC_TYPES)[number])) {
    return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 });
  }
  if (!doc_number) {
    return NextResponse.json({ customer: null });
  }

  const customer = await prisma.customer.findUnique({
    where: { doc_type_doc_number: { doc_type: doc_type as (typeof DOC_TYPES)[number], doc_number } },
  });

  if (!customer) return NextResponse.json({ customer: null });

  return NextResponse.json({
    customer: {
      ...customer,
      created_at: customer.created_at.toISOString(),
      updated_at: customer.updated_at.toISOString(),
    },
  });
}
