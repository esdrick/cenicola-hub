import dns from "dns/promises";

interface EmailValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida la sintaxis estricta de un correo y comprueba si su dominio posee registros MX (Servidor de correo activo).
 */
export async function validateEmailDomain(email: string): Promise<EmailValidationResult> {
  const GENERIC_ERROR = "Indique un correo electrónico válido";

  if (!email || typeof email !== "string") {
    return { valid: false, error: GENERIC_ERROR };
  }

  const cleanEmail = email.trim().toLowerCase();

  // 1. Sintaxis estricta RFC 5322
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!EMAIL_REGEX.test(cleanEmail)) {
    return { valid: false, error: GENERIC_ERROR };
  }

  // 2. Extraer dominio
  const parts = cleanEmail.split("@");
  if (parts.length !== 2) {
    return { valid: false, error: GENERIC_ERROR };
  }

  const domain = parts[1];

  // Detectar errores comunes de tipeo en dominios conocidos
  const TYPO_DOMAINS: Record<string, string> = {
    "gmai.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gmial.com": "gmail.com",
    "hotmai.com": "hotmail.com",
    "outlok.com": "outlook.com",
  };

  if (TYPO_DOMAINS[domain]) {
    return { valid: false, error: GENERIC_ERROR };
  }

  // 3. Verificación de registros MX por DNS
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { valid: false, error: GENERIC_ERROR };
    }
  } catch (err: unknown) {
    const errorObj = err as { code?: string };
    if (errorObj.code === "ENOTFOUND" || errorObj.code === "ENODATA" || errorObj.code === "EREFUSED") {
      return { valid: false, error: GENERIC_ERROR };
    }
  }

  return { valid: true };
}
