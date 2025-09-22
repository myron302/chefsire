import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: postgresql://neondb_owner:npg_Lwd7A9beEhcz@ep-aged-forest-aduhidk1-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require,
  },
});
