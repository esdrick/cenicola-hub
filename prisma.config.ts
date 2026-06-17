import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Dev: conexión directa al contenedor Docker
    // Prod (Supabase): usar el pooler (port 6543) en DATABASE_URL
    url: process.env["DATABASE_URL"],
  },
});
