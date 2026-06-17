import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const USERS = [
  { name: "Admin Cenicola",      email: "admin@cenicola.com",      password: "Admin1234",  role: "admin"             },
  { name: "Laura Inventario",    email: "inventario@cenicola.com", password: "Test1234",   role: "inventario"        },
  { name: "Carlos Embalador",    email: "embalador@cenicola.com",  password: "Test1234",   role: "embalador"         },
  { name: "María Online",        email: "online@cenicola.com",     password: "Test1234",   role: "vendedora_online"  },
  { name: "Sofía Tienda",        email: "tienda@cenicola.com",     password: "Test1234",   role: "vendedora_tienda"  },
] as const;

async function main() {
  console.log("🌱 Seeding usuarios de prueba...\n");

  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 12);

    const user = await prisma.user.upsert({
      where:  { email: u.email },
      update: { name: u.name, role: u.role, is_active: true },
      create: {
        name:          u.name,
        email:         u.email,
        password_hash: hash,
        role:          u.role,
        is_active:     true,
      },
    });

    console.log(`✅  [${u.role.padEnd(17)}]  ${user.email}  /  contraseña: ${u.password}`);
  }

  console.log("\n✔ Seed completo.");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
