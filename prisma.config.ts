import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Use the direct (non-pooled) URL for migrations on Supabase.
  datasource: { url: process.env.DIRECT_URL ?? env("DATABASE_URL") },
});
