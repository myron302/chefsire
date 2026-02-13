import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();

type RegistryLink = {
  id: number;
  name: string;
  url: string;
  icon: string;
};

const DEFAULT_REGISTRY_LINKS: RegistryLink[] = [
  { id: 1, name: "Amazon", url: "", icon: "🎁" },
  { id: 2, name: "Target", url: "", icon: "🎯" },
  { id: 3, name: "Zola", url: "", icon: "💑" },
];


async function ensureWeddingRegistryLinksTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wedding_registry_links (
      user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      registry_links JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS wedding_registry_links_user_idx
      ON wedding_registry_links(user_id)
  `);
}


function parseRegistryLinksPayload(input: unknown): unknown {
  if (Array.isArray(input)) return input;
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      return input;
    }
  }
  return input;
}

function normalizeRegistryLinks(input: unknown): RegistryLink[] {
  if (!Array.isArray(input)) return DEFAULT_REGISTRY_LINKS;

  const normalized = input
    .filter((item) => item && typeof item === "object")
    .map((item: any, index: number) => ({
      id: Number.isFinite(Number(item.id)) ? Number(item.id) : Date.now() + index,
      name: typeof item.name === "string" && item.name.trim() ? item.name.trim().slice(0, 100) : "Registry",
      url: typeof item.url === "string" ? item.url.trim().slice(0, 2048) : "",
      icon: typeof item.icon === "string" && item.icon.trim() ? item.icon.trim().slice(0, 8) : "🎁",
    }));

  return normalized.length > 0 ? normalized : DEFAULT_REGISTRY_LINKS;
}

router.get("/registry-links", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    await ensureWeddingRegistryLinksTable();

    const result: any = await db.execute(sql`
      SELECT registry_links AS "registryLinks"
      FROM wedding_registry_links
      WHERE user_id = ${userId}
      LIMIT 1
    `);

    const row = result?.rows?.[0] ?? result?.[0] ?? null;
    const registryLinks = normalizeRegistryLinks(parseRegistryLinksPayload(row?.registryLinks ?? DEFAULT_REGISTRY_LINKS));

    return res.json({ ok: true, registryLinks });
  } catch (error: any) {
    console.error("[wedding-registry-links] GET error:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Failed to load registry links" });
  }
});

router.post("/registry-links", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    await ensureWeddingRegistryLinksTable();

    const registryLinks = normalizeRegistryLinks(req.body?.registryLinks);

    await db.execute(sql`
      INSERT INTO wedding_registry_links (user_id, registry_links, updated_at)
      VALUES (${userId}, ${JSON.stringify(registryLinks)}::jsonb, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        registry_links = EXCLUDED.registry_links,
        updated_at = NOW()
    `);

    return res.json({ ok: true, registryLinks });
  } catch (error: any) {
    console.error("[wedding-registry-links] POST error:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Failed to save registry links" });
  }
});

router.get("/public-registry/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim();
    if (!slug) {
      return res.status(400).json({ ok: false, error: "Registry slug is required" });
    }

    await ensureWeddingRegistryLinksTable();

    const result: any = await db.execute(sql`
      SELECT
        w.registry_links AS "registryLinks",
        u.username AS "username"
      FROM wedding_registry_links w
      INNER JOIN users u ON u.id = w.user_id
      WHERE LOWER(u.username) = LOWER(${slug}) OR w.user_id = ${slug}
      LIMIT 1
    `);

    const row = result?.rows?.[0] ?? result?.[0] ?? null;
    if (!row) {
      return res.status(404).json({ ok: false, error: "Registry not found" });
    }

    const registryLinks = normalizeRegistryLinks(parseRegistryLinksPayload(row.registryLinks ?? []));
    const publicLinks = registryLinks.filter((link) => !!link.url?.trim());

    return res.json({ ok: true, username: row.username ?? slug, registryLinks: publicLinks });
  } catch (error: any) {
    console.error("[wedding-registry-links] public GET error:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Failed to load public registry" });
  }
});

export default router;
