import { redirect } from "next/navigation";

export default function HistorialRedirect() {
  redirect("/dashboard/finanzas?tab=historial");
}
