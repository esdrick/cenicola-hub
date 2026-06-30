import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env", override: false });
import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email    = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name     = process.env.ADMIN_NAME ?? "Admin";

  if (!email || !password) {
    throw new Error("Define ADMIN_EMAIL y ADMIN_PASSWORD en tu .env antes de ejecutar el seed.");
  }

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD debe tener al menos 8 caracteres.");
  }

  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where:  { email },
    update: { name, is_active: true },
    create: { name, email, password_hash: hash, role: "admin", is_active: true },
  });

  console.log(`✅  Admin creado: ${user.email}`);

  await prisma.systemSetting.upsert({
    where:  { key: "bundle_threshold" },
    update: {},
    create: { key: "bundle_threshold", value: "3" },
  });
  console.log("✅  SystemSetting bundle_threshold = 3");

  await prisma.systemSetting.upsert({
    where:  { key: "mayor_threshold" },
    update: {},
    create: { key: "mayor_threshold", value: "6" },
  });
  console.log("✅  SystemSetting mayor_threshold = 6");

  console.log("\n✔ Seed completo. Crea los demás usuarios desde la UI con el rol admin.");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
