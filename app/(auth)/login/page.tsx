import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getDefaultRedirect } from "@/lib/auth";
import { LoginForm } from "@/components/shared/LoginForm";

export const metadata = { title: "Iniciar sesión — Cenicola's hub" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(getDefaultRedirect(session.role));

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-5">
      <div className="w-full max-w-xs">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 shadow-sm">
            <span className="text-xl font-bold text-white">C</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Cenicola&apos;s hub
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">Sistema de Gestión</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-6 shadow-sm">
          <p className="mb-5 text-sm font-semibold text-gray-700">
            Inicia sesión en tu cuenta
          </p>
          <LoginForm />
        </div>

        <p className="mt-5 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Cenicola — Todos los derechos reservados
        </p>
      </div>
    </main>
  );
}
