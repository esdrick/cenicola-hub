import { config } from "dotenv";
// Load .env.local first (local overrides), then .env — mirrors Next.js priority
config({ path: ".env.local" });
config({ path: ".env", override: false });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
