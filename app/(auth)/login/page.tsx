import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getDefaultRedirect } from "@/lib/auth";
import { LoginForm } from "@/components/shared/LoginForm";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata = { title: "Iniciar sesión — Cenicola's hub" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(getDefaultRedirect(session.role));

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo / marca */}
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900">
            <span className="text-lg font-bold text-white">C</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Cenicola&apos;s hub
          </h1>
          <p className="mt-1 text-sm text-gray-500">Sistema de Gestión</p>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-4 pt-6">
            <p className="text-sm font-medium text-gray-700">
              Inicia sesión en tu cuenta
            </p>
          </CardHeader>
          <CardContent className="pb-6">
            <LoginForm />
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Cenicola — Todos los derechos reservados
        </p>
      </div>
    </main>
  );
}
