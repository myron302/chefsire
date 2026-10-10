// drizzle.config.ts
import "dotenv/config";             // ⬅️ ensures DATABASE_URL loads when running drizzle-kit
import { defineConfig } from "drizzle-kit";
import { declaredTableNames } from "./shared/schema-managed-tables";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  // Include BOTH schemas (social + DMs)
  schema: ["./shared/schema.ts", "./shared/schema.dm.ts"],  // ⬅️ add dm schema
  // (alt: schema: "./shared/schema*.ts" works too)

  out: "./server/drizzle",

  // SAFETY: push only ever sees the tables declared in the schema above. Without this, `drizzle-kit push` treats the schema as the whole truth
  // and plans `DROP TABLE ... CASCADE` for every database table it does not declare (migration ledger, audit evidence, quarantine and
  // runtime-created tables). Derived from the schema itself, so there is no second list to keep in sync. See docs/schema-push-safety.md.
  tablesFilter: declaredTableNames(),
  verbose: true,
  dialect: "postgresql",
  dbCredentials: { url: DATABASE_URL },
});
