// server/routes/index.ts
import { Router } from "express";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const r = Router();

type MountResult = { name: string; basePath: string | null; ok: boolean; reason?: string };
const diag: MountResult[] = [];

function safeMount(
  name: string,
  basePath: string | null,
  modulePath: string,
  exportName?: string
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(modulePath);
    const router = exportName ? mod[exportName] : (mod.default ?? mod);
    if (!router) throw new Error(`Missing export ${exportName ?? "default"} from ${modulePath}`);

    if (basePath) r.use(basePath, router);
    else r.use(router);

    diag.push({ name, basePath, ok: true });
    console.log(`[routes] Mounted ${name} at ${basePath ?? "(root)"}`);
  } catch (e: any) {
    const reason = e?.message || String(e);
    diag.push({ name, basePath, ok: false, reason });
    console.error(`[routes] FAILED to mount ${name}: ${reason}`);
  }
}

// ---- Mount everything defensively ----
// AUTH (root so it exposes /auth/*)
safeMount("auth", null, "./auth");

// Core
safeMount("recipes", "/recipes", "./recipes");
safeMount("bites", "/bites", "./bites");
safeMount("users", "/users", "./users");
safeMount("posts", "/posts", "./posts");
safeMount("pantry", "/pantry", "./pantry");
safeMount("allergies", "/allergies", "./allergies");
safeMount("meal-plans", "/meal-plans", "./meal-plans");
safeMount("clubs", "/clubs", "./clubs");
safeMount("marketplace", "/marketplace", "./marketplace");
safeMount("substitutions", "/substitutions", "./substitutions");
safeMount("drinks", "/drinks", "./drinks");

// Integrations
safeMount("lookup", "/lookup", "./lookup");
safeMount("export", "/export", "./exportList");
safeMount("google", "/google", "./google", "googleRouter");

// Competitions
safeMount("competitions", "/competitions", "./competitions");

// Stores
safeMount("stores-public", "/stores", "./stores");
safeMount("stores-crud", "/stores-crud", "./stores-crud");

// Dev / health helpers
safeMount("dev.mailcheck", null, "./dev.mailcheck");

// DMs
safeMount("dm", "/dm", "./dm");

// ---- Diagnostics ----
r.get("/_diag", (_req, res) => {
  res.json({
    ok: diag.every(d => d.ok),
    failed: diag.filter(d => !d.ok).map(d => ({ name: d.name, basePath: d.basePath, reason: d.reason })),
    mounted: diag.filter(d => d.ok).map(d => ({ name: d.name, basePath: d.basePath })),
    timestamp: new Date().toISOString(),
  });
});

if (process.env.NODE_ENV !== "production") {
  r.get("/_routes", (_req, res) => {
    res.json({
      endpoints: [
        "/auth/*",
        "/recipes/*",
        "/bites/*",
        "/users/*",
        "/posts/*",
        "/pantry/*",
        "/allergies/*",
        "/meal-plans/*",
        "/clubs/*",
        "/marketplace/*",
        "/substitutions/*",
        "/drinks/*",
        "/lookup/*",
        "/export/*",
        "/google/*",
        "/competitions/*",
        "/stores/*",
        "/stores-crud/*",
        "/auth/_mail-verify",
        "/dm/*",
      ],
      diag,
    });
  });
}

export default r;
