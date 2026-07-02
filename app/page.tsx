import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getDefaultRedirect } from "@/lib/auth";

export default async function RootPage() {
  const session = await getSession();
  redirect(session ? getDefaultRedirect(session.role) : "/login");
}
