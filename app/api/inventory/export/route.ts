import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!["admin", "inventario"].includes(session.role)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const LOW_STOCK = await getSetting("low_stock_threshold");
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const tipo = searchParams.get("tipo") ?? "";
  const stockStatus = searchParams.get("stock_status") ?? "";

  const where = {
    is_active: true,
    ...(stockStatus === "sin" && { stock_total: 0 }),
    ...(stockStatus === "bajo" && { stock_total: { gt: 0, lt: LOW_STOCK } }),
    AND: [
      ...(tipo ? [{ product: { type: { contains: tipo, mode: "insensitive" as const } } }] : []),
      ...(q ? [{
        OR: [
          { product: { name: { contains: q, mode: "insensitive" as const } } },
          { size: { contains: q, mode: "insensitive" as const } },
          { product: { color: { contains: q, mode: "insensitive" as const } } },
        ],
      }] : []),
    ],
  };

  const variants = await prisma.productVariant.findMany({
    where,
    include: {
      product: { select: { name: true, type: true, color: true } },
    },
    orderBy: [{ product: { name: "asc" } }, { size: "asc" }],
  });

  // ── Build workbook ────────────────────────────────────────────────────────

  const wb = new ExcelJS.Workbook();
  wb.creator = "Cenicola Hub";
  wb.created = new Date();

  const ws = wb.addWorksheet("Stock Inventario");

  ws.columns = [
    { header: "Producto",  key: "nombre",  width: 32 },
    { header: "Tipo",      key: "tipo",    width: 16 },
    { header: "Color",     key: "color",   width: 16 },
    { header: "Talla",     key: "talla",   width: 10 },
    { header: "SKU",       key: "sku",     width: 18 },
    { header: "Online",    key: "online",  width: 10 },
    { header: "Tienda",    key: "tienda",  width: 10 },
    { header: "Total",     key: "total",   width: 10 },
  ];

  // Header row style
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
  headerRow.height = 24;
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.eachCell((cell) => {
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF374151" } },
    };
  });

  // Data rows
  let totalOnline = 0;
  let totalTienda = 0;
  let totalStock = 0;

  for (const v of variants) {
    const row = ws.addRow({
      nombre: v.product.name,
      tipo:   v.product.type,
      color:  v.product.color ?? "",
      talla:  v.size,
      sku:    v.sku,
      online: v.stock_online,
      tienda: v.stock_store,
      total:  v.stock_total,
    });

    row.height = 20;
    row.alignment = { vertical: "middle" };

    // Row fill by stock level
    if (v.stock_total === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
      });
      row.getCell("total").font = { bold: true, color: { argb: "FFDC2626" } };
    } else if (v.stock_total < LOW_STOCK) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
      });
      row.getCell("total").font = { bold: true, color: { argb: "FFD97706" } };
    } else {
      row.getCell("total").font = { bold: true };
    }

    totalOnline += v.stock_online;
    totalTienda += v.stock_store;
    totalStock  += v.stock_total;
  }

  // Totals row
  const totalsRow = ws.addRow({
    nombre: "TOTAL",
    tipo: "", color: "", talla: "", sku: "",
    online: totalOnline,
    tienda: totalTienda,
    total:  totalStock,
  });
  totalsRow.font = { bold: true, size: 11 };
  totalsRow.height = 22;
  totalsRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
  totalsRow.eachCell((cell) => {
    cell.border = { top: { style: "thin", color: { argb: "FFD1D5DB" } } };
  });
  totalsRow.alignment = { vertical: "middle" };

  // Freeze header row
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // Right-align numeric columns
  ["online", "tienda", "total"].forEach((key) => {
    ws.getColumn(key).alignment = { horizontal: "right", vertical: "middle" };
  });

  const buffer = await wb.xlsx.writeBuffer();

  const date = new Date().toISOString().split("T")[0];

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventario-${date}.xlsx"`,
    },
  });
}
