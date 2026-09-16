import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { getCustomColors } from "@/lib/settings";

const BASE_COLORS = [
  "Rojo", "Azul", "Amarillo", "Verde", "Blanco", "Negro", "Gris", "Naranja",
  "Morado", "Rosa", "Marrón", "Turquesa", "Celeste", "Violeta", "Magenta",
  "Beige", "Oliva", "Marino", "Esmeralda", "Escarlata", "Carmín", "Burdeos",
  "Granate", "Lavanda", "Lila", "Salmón", "Coral", "Fucsia", "Índigo",
  "Mostaza", "Ámbar", "Oro", "Caqui", "Crema", "Marfil", "Aguamarina",
];

function formatColorName(str: string): string {
  const trimmed = str.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export async function GET() {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const [rows, customColors] = await Promise.all([
    prisma.product.groupBy({
      by: ["color"],
      where: {
        color: { not: null },
      },
      orderBy: { color: "asc" },
    }),
    getCustomColors(),
  ]);

  const dbColors = rows
    .map((r) => r.color?.trim())
    .filter((c): c is string => !!c && c.length > 0);

  const colorMap = new Map<string, string>();

  for (const c of BASE_COLORS) {
    const formatted = formatColorName(c);
    if (formatted) {
      colorMap.set(formatted.toLowerCase(), formatted);
    }
  }

  for (const c of customColors) {
    const formatted = formatColorName(c);
    if (formatted && !colorMap.has(formatted.toLowerCase())) {
      colorMap.set(formatted.toLowerCase(), formatted);
    }
  }

  for (const c of dbColors) {
    const formatted = formatColorName(c);
    if (formatted && !colorMap.has(formatted.toLowerCase())) {
      colorMap.set(formatted.toLowerCase(), formatted);
    }
  }

  const sortedColors = Array.from(colorMap.values()).sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );

  return NextResponse.json({ colors: sortedColors });
}
