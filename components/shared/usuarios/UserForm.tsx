"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Save, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ROLE_LABELS } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { UserJSON, UserRole } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: UserRole[] = ["inventario", "embalador", "vendedora_online", "vendedora_tienda"];

const ROLE_DOMAINS: Record<UserRole, string> = {
  admin:             "admin.cenicola.com",
  inventario:        "inventario.cenicola.com",
  embalador:         "embalaje.cenicola.com",
  vendedora_online:  "online.cenicola.com",
  vendedora_tienda:  "tienda.cenicola.com",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, ".");
}

function generateEmail(nombre: string, rol: UserRole): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const local =
    parts.length === 1
      ? slugify(parts[0])
      : `${slugify(parts[0])}.${slugify(parts.slice(1).join(" "))}`;
  if (!local) return "";
  return `${local}@${ROLE_DOMAINS[rol]}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const ONLY_LETTERS = /^[a-zA-ZÀ-ÿ\s\-']+$/;
const EMAIL_RE     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errNombre(v: string): string {
  if (!v.trim()) return "El nombre es obligatorio";
  if (!ONLY_LETTERS.test(v)) return "Solo se permiten letras, espacios y guiones";
  if (v.trim().length < 2) return "Mínimo 2 caracteres";
  return "";
}

function errEmail(v: string): string {
  if (!v.trim()) return "El email es obligatorio";
  if (!EMAIL_RE.test(v)) return "Formato de email inválido";
  return "";
}

function errPassword(v: string, required: boolean): string {
  if (!v) return required ? "La contraseña es obligatoria" : "";
  if (v.length < 8)       return "Mínimo 8 caracteres";
  if (!/[A-Z]/.test(v))  return "Debe incluir al menos una mayúscula";
  if (!/[0-9]/.test(v))  return "Debe incluir al menos un número";
  return "";
}

function errConfirm(pw: string, cf: string, required: boolean): string {
  if (!cf && required && pw) return "Confirma la contraseña";
  if (cf && pw !== cf)       return "Las contraseñas no coinciden";
  return "";
}

// ─── Password strength bar ────────────────────────────────────────────────────

function PasswordStrength({ pw }: { pw: string }) {
  if (!pw) return null;
  const checks = [
    { label: "8+ caracteres", ok: pw.length >= 8 },
    { label: "Mayúscula",     ok: /[A-Z]/.test(pw) },
    { label: "Número",        ok: /[0-9]/.test(pw) },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const barColor = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-emerald-500"][passed];
  return (
    <div className="space-y-1.5 pt-0.5">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn("h-1 flex-1 rounded-full transition-colors", i < passed ? barColor : "bg-gray-200")}
          />
        ))}
      </div>
      <div className="flex gap-4">
        {checks.map((c) => (
          <span key={c.label} className={cn("text-xs", c.ok ? "text-emerald-600" : "text-gray-400")}>
            {c.ok ? "✓" : "·"} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Field error message ──────────────────────────────────────────────────────

function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return <p className="text-xs font-medium text-red-600">{msg}</p>;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props =
  | { mode: "create" }
  | { mode: "edit"; user: UserJSON; sessionId: string };

export function UserForm(props: Props) {
  const router  = useRouter();
  const isEdit  = props.mode === "edit";
  const user    = isEdit ? props.user : null;
  const isSelf  = isEdit && props.sessionId === user?.id;

  const [nombre,          setNombre]          = useState(user?.name  ?? "");
  const [email,           setEmail]           = useState(user?.email ?? "");
  const [emailAuto,       setEmailAuto]       = useState(!isEdit);
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rol,             setRol]             = useState<UserRole>(user?.role ?? "inventario");
  const [activo,          setActivo]          = useState(user?.is_active ?? true);
  const [showPw,          setShowPw]          = useState(false);
  const [showCf,          setShowCf]          = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [apiError,        setApiError]        = useState("");
  const [submitted,       setSubmitted]       = useState(false);
  const [touched, setTouched] = useState({
    nombre: false, email: false, password: false, confirmPassword: false,
  });

  const pwRequired = !isEdit;

  // Auto-generate email when nombre or rol changes (while in auto mode)
  useEffect(() => {
    if (!emailAuto) return;
    const gen = generateEmail(nombre, rol);
    if (gen) setEmail(gen);
  }, [nombre, rol, emailAuto]);

  const show = {
    nombre:          touched.nombre          || submitted,
    email:           touched.email           || submitted,
    password:        touched.password        || submitted,
    confirmPassword: touched.confirmPassword || submitted,
  };

  const errors = {
    nombre:          show.nombre          ? errNombre(nombre)                         : "",
    email:           show.email           ? errEmail(email)                           : "",
    password:        show.password        ? errPassword(password, pwRequired)         : "",
    confirmPassword: show.confirmPassword ? errConfirm(password, confirmPassword, pwRequired) : "",
  };

  function touch(field: keyof typeof touched) {
    setTouched((p) => ({ ...p, [field]: true }));
  }

  function handleNombreChange(raw: string) {
    // Strip digits as the user types
    setNombre(raw.replace(/[0-9]/g, ""));
  }

  function handleEmailChange(val: string) {
    setEmail(val);
    setEmailAuto(false);
  }

  function regenerateEmail() {
    const gen = generateEmail(nombre, rol);
    if (gen) { setEmail(gen); setEmailAuto(true); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setApiError("");

    if (
      errNombre(nombre) ||
      errEmail(email) ||
      errPassword(password, pwRequired) ||
      errConfirm(password, confirmPassword, pwRequired)
    ) return;

    setLoading(true);
    try {
      const url    = isEdit ? `/api/usuarios/${user!.id}` : "/api/usuarios";
      const method = isEdit ? "PUT" : "POST";
      const body   = isEdit
        ? { nombre, email, ...(password ? { password } : {}), rol, activo }
        : { nombre, email, password, rol };

      const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();

      if (!res.ok) { setApiError(data.error ?? "Ocurrió un error"); return; }

      router.push("/dashboard/usuarios?success=1");
      router.refresh();
    } catch {
      setApiError("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>

      {/* ── Nombre ─────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="nombre">
          Nombre completo <span className="text-red-500">*</span>
        </Label>
        <Input
          id="nombre"
          value={nombre}
          onChange={(e) => handleNombreChange(e.target.value)}
          onBlur={() => touch("nombre")}
          placeholder="Ej. María González"
          autoComplete="off"
          className={cn(errors.nombre && "border-red-500 focus-visible:ring-red-500/50")}
        />
        <FieldError msg={errors.nombre} />
      </div>

      {/* ── Email ──────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="email">
            Email <span className="text-red-500">*</span>
          </Label>
          {!emailAuto && nombre.trim() && (
            <button
              type="button"
              onClick={regenerateEmail}
              className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
            >
              <Wand2 size={11} />
              Regenerar
            </button>
          )}
          {emailAuto && (
            <span className="text-xs text-blue-500">Auto-generado</span>
          )}
        </div>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => handleEmailChange(e.target.value)}
          onBlur={() => touch("email")}
          placeholder="correo@rol.cenicola.com"
          autoComplete="off"
          className={cn(errors.email && "border-red-500 focus-visible:ring-red-500/50")}
        />
        {!errors.email && emailAuto && (
          <p className="text-xs text-gray-400">
            Edita el campo para personalizarlo o cambia el nombre/rol para regenerar.
          </p>
        )}
        <FieldError msg={errors.email} />
      </div>

      {/* ── Contraseña ─────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="password">
          {isEdit ? "Nueva contraseña" : <>Contraseña <span className="text-red-500">*</span></>}
          {isEdit && <span className="ml-1 text-xs text-gray-400">(vacío = sin cambios)</span>}
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => touch("password")}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            className={cn("pr-10", errors.password && "border-red-500 focus-visible:ring-red-500/50")}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <FieldError msg={errors.password} />
        <PasswordStrength pw={password} />
      </div>

      {/* ── Confirmar contraseña ───────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">
          Confirmar contraseña
          {!isEdit && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showCf ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => touch("confirmPassword")}
            placeholder="Repite la contraseña"
            autoComplete="new-password"
            className={cn("pr-10", errors.confirmPassword && "border-red-500 focus-visible:ring-red-500/50")}
          />
          <button
            type="button"
            onClick={() => setShowCf((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showCf ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <FieldError msg={errors.confirmPassword} />
      </div>

      {/* ── Rol ────────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="rol">
          Rol <span className="text-red-500">*</span>
        </Label>
        {(isSelf || rol === "admin") ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {ROLE_LABELS[rol]}
            <span className="ml-2 text-xs text-gray-400">
              {rol === "admin"
                ? "(el rol Administrador no puede modificarse desde el sistema)"
                : "(no puedes cambiar tu propio rol)"}
            </span>
          </div>
        ) : (
          <Select value={rol} onValueChange={(v) => setRol(v as UserRole)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona un rol">
                {ROLE_LABELS[rol]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Estado activo (solo edición) ───────────────────────────────────── */}
      {isEdit && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Cuenta activa</p>
            <p className="text-xs text-gray-500">
              {isSelf
                ? "No puedes desactivar tu propia cuenta"
                : activo
                ? "El usuario puede iniciar sesión"
                : "El usuario no puede iniciar sesión"}
            </p>
          </div>
          <Switch id="activo" checked={activo} onCheckedChange={setActivo} disabled={isSelf} />
        </div>
      )}

      {/* ── Error de API ───────────────────────────────────────────────────── */}
      {apiError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{apiError}</p>
      )}

      {/* ── Acciones ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading
            ? <Loader2 size={16} className="mr-2 animate-spin" />
            : <Save size={16} className="mr-2" />}
          {isEdit ? "Guardar cambios" : "Crear usuario"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/usuarios")} disabled={loading}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
