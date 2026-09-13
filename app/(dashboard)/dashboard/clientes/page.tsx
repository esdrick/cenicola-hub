export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ClientesTable } from "@/components/shared/clientes/ClientesTable";
import { WebAccountsTable, type WebAccountJSON } from "@/components/shared/clientes/WebAccountsTable";
import { ClientesTabs } from "@/components/shared/clientes/ClientesTabs";
import type { CustomerJSON } from "@/types";

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function ClientesPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const { tab: activeTabParam } = await searchParams;
  const activeTab = activeTabParam === "web" ? "web" : "hub";

  const pageSize = 25;

  const [customers, hubTotal, webAccounts, webTotal] = await Promise.all([
    prisma.customer.findMany({
      include: { _count: { select: { orders: true } } },
      orderBy: { created_at: "desc" },
      take: pageSize,
    }),
    prisma.customer.count(),
    prisma.customerAccount
      .findMany({
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
        take: pageSize,
      })
      .catch(() => []),
    prisma.customerAccount.count().catch(() => 0),
  ]);

  const webEmails = webAccounts.map((a) => a.email).filter(Boolean);
  const matchingCustomers = webEmails.length > 0
    ? await prisma.customer.findMany({
        where: { email: { in: webEmails, mode: "insensitive" } },
        select: { email: true, doc_type: true, doc_number: true },
      })
    : [];

  const customerMap = new Map(
    matchingCustomers.map((c) => [c.email?.toLowerCase(), `${c.doc_type}-${c.doc_number}`])
  );

  const initialHubData: CustomerJSON[] = customers.map((c) => ({
    ...c,
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
  }));

  const initialWebData: WebAccountJSON[] = webAccounts.map((a) => {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Directorio de clientes de Cenicola Hub y usuarios registrados en la Web
        </p>
      </div>

      <ClientesTabs active={activeTab} hubCount={hubTotal} webCount={webTotal} />

      {activeTab === "hub" ? (
        <ClientesTable initialData={initialHubData} initialTotal={hubTotal} />
      ) : (
        <WebAccountsTable initialData={initialWebData} initialTotal={webTotal} />
      )}
    </div>
  );
}
