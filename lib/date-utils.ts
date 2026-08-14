export const VENEZUELA_TIMEZONE = "America/Caracas";

/** Extrae las partes (año, mes, día, horas, minutos, segundos) de una fecha en hora de Venezuela */
export function getVenezuelaParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: VENEZUELA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";

  return {
    year: parseInt(getPart("year"), 10),
    month: parseInt(getPart("month"), 10),
    day: parseInt(getPart("day"), 10),
    hours: parseInt(getPart("hour"), 10) % 24,
    minutes: parseInt(getPart("minute"), 10),
    seconds: parseInt(getPart("second"), 10),
  };
}

/** Devuelve la representación "YYYY-MM-DD" de una fecha según la hora de Venezuela */
export function getVenezuelaDateString(date: Date = new Date()): string {
  const { year, month, day } = getVenezuelaParts(date);
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/** Devuelve la representación "YYYYMMDD" de una fecha según la hora de Venezuela */
export function getVenezuelaCompactDateString(date: Date = new Date()): string {
  const { year, month, day } = getVenezuelaParts(date);
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}${m}${d}`;
}

/** Obtiene la fecha que representa el inicio del día (00:00:00.000) en hora de Venezuela */
export function getVenezuelaStartOfDay(date: Date = new Date()): Date {
  const dateStr = getVenezuelaDateString(date);
  return new Date(`${dateStr}T00:00:00.000-04:00`);
}

/** Obtiene la fecha que representa el fin del día (23:59:59.999) en hora de Venezuela */
export function getVenezuelaEndOfDay(date: Date = new Date()): Date {
  const dateStr = getVenezuelaDateString(date);
  return new Date(`${dateStr}T23:59:59.999-04:00`);
}

/** Formatea una fecha a la hora de Venezuela (solo fecha, ej: "13/08/2026") */
export function formatVenezuelaDate(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", {
    timeZone: VENEZUELA_TIMEZONE,
    ...options,
  });
}

/** Formatea una fecha y hora a la hora de Venezuela (ej: "13/08/2026, 08:30 PM") */
export function formatVenezuelaDateTime(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-VE", {
    timeZone: VENEZUELA_TIMEZONE,
    ...options,
  });
}
