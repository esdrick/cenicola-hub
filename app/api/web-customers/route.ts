import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";

// GET /api/web-customers
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
          { email: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
          { doc_number: { contains: q, mode: "insensitive" as const } },
          { orders: { some: { customer_id_doc: { contains: q, mode: "insensitive" as const } } } },
        ],
      }
    : {};

  try {
    const [accounts, total] = await Promise.all([
      prisma.customerAccount.findMany({
        where,
        include: {
          orders: {
            select: { customer_id_doc: true },
            where: { customer_id_doc: { not: "" } },
            orderBy: { created_at: "desc" },
            take: 1,
          },
          _count: { select: { orders: true } },
        },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customerAccount.count({ where }),
    ]);

    const emails = accounts.map((a) => a.email).filter(Boolean);
    const matchingCustomers = emails.length > 0
      ? await prisma.customer.findMany({
          where: { email: { in: emails, mode: "insensitive" } },
          select: { email: true, doc_type: true, doc_number: true },
        })
      : [];

    const customerMap = new Map(
      matchingCustomers.map((c) => [c.email?.toLowerCase(), `${c.doc_type}-${c.doc_number}`])
    );

    const data = accounts.map((a) => {
      const docFromAccount = a.doc_number ? `${a.doc_type || "V"}-${a.doc_number}` : null;
      const docFromOrder = a.orders?.[0]?.customer_id_doc;
      const docFromCustomer = a.email ? customerMap.get(a.email.toLowerCase()) : null;
      return {
        id: a.id,
        email: a.email,
        name: a.name,
        lastname: a.lastname,
        phone: a.phone,
        is_active: a.is_active,
        email_verified: a.email_verified,
        customer_id_doc: docFromAccount || docFromOrder || docFromCustomer || null,
        _count: a._count,
        created_at: a.created_at.toISOString(),
        updated_at: a.updated_at.toISOString(),
      };
    });

    return NextResponse.json({ data, total, page, totalPages: Math.ceil(total / pageSize) });
  } catch {
    // Return empty result gracefully if customer_accounts table does not exist or fails
    return NextResponse.json({ data: [], total: 0, page: 1, totalPages: 1 });
  }
}
