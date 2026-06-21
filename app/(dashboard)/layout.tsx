import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Sidebar } from "@/components/shared/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar session={session} />

      {/* Desktop offset — matches sidebar width */}
      <div className="lg:pl-64">
        {/* On mobile the top bar is rendered inside Sidebar */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
