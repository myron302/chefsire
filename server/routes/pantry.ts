// server/routes/pantry.ts
import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { randomBytes, randomUUID } from "crypto";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";

const r = Router();

/**
 * Pantry endpoints (user-id based; no session dependency).
 */

// Session-based endpoints (get user ID from session)
// Get current user's pantry
r.get("/items", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const items = await storage.getPantryItems(userId);
    res.json({ items }); // Wrap in object to match frontend expectations
  } catch (error) {
    console.error("pantry/items/list error", error);
    res.status(500).json({ message: "Failed to fetch pantry items" });
  }
});

// Add item to current user's pantry
r.post("/items", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const schema = z.object({
      name: z.string().min(1),
      category: z.string().optional(),
      quantity: z.union([z.string(), z.number()]).optional(),
      unit: z.string().optional(),
      expirationDate: z.string().datetime().optional(),
      notes: z.string().optional(),
      imageUrl: z.string().optional(),
    });

    const body = schema.parse(req.body);

    // Convert quantity to number if it's a string
    let quantityNum: number | undefined;
    if (body.quantity !== undefined) {
      quantityNum = typeof body.quantity === 'string' ? parseFloat(body.quantity) : body.quantity;
      if (isNaN(quantityNum)) quantityNum = undefined;
    }

    const created = await storage.addPantryItem(userId, {
      name: body.name,
      category: body.category,
      quantity: quantityNum,
      unit: body.unit,
      expirationDate: body.expirationDate ? new Date(body.expirationDate) : undefined,
      notes: body.notes,
    });

    res.status(201).json(created);
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ message: "Invalid item", errors: error.issues });
    console.error("pantry/items/add error", error);
    res.status(500).json({ message: "Failed to add pantry item" });
  }
});

// Get expiring items for current user
r.get("/expiring-soon", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const days = Number(req.query.days ?? 7);
    const items = await storage.getExpiringItems(userId, isNaN(days) ? 7 : days);
    res.json({ items }); // Wrap in object to match frontend expectations
  } catch (error) {
    console.error("pantry/expiring-soon error", error);
    res.status(500).json({ message: "Failed to fetch expiring items" });
  }
});

// Delete pantry item by ID
r.delete("/items/:itemId", requireAuth, async (req, res) => {
  try {
    const ok = await storage.deletePantryItem(req.params.itemId);
    if (!ok) return res.status(404).json({ message: "Pantry item not found" });
    res.json({ message: "Pantry item deleted" });
  } catch (error) {
    console.error("pantry/items/delete error", error);
    res.status(500).json({ message: "Failed to delete pantry item" });
  }
});

// User-ID based endpoints (for backwards compatibility)
// Get a user's pantry
r.get("/users/:id/pantry", async (req, res) => {
  try {
    const items = await storage.getPantryItems(req.params.id);
    res.json({ pantryItems: items, total: items.length });
  } catch (error) {
    console.error("pantry/list error", error);
    res.status(500).json({ message: "Failed to fetch pantry items" });
  }
});

// Add pantry item
r.post("/users/:id/pantry", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      category: z.string().optional(),
      quantity: z.number().min(0).optional(),
      unit: z.string().optional(),
      expirationDate: z.string().datetime().optional(),
      notes: z.string().optional(),
    });

    const body = schema.parse(req.body);
    const created = await storage.addPantryItem(req.params.id, {
      name: body.name,
      category: body.category,
      quantity: body.quantity,
      unit: body.unit,
      expirationDate: body.expirationDate ? new Date(body.expirationDate) : undefined,
      notes: body.notes,
    });

    res.status(201).json({ message: "Pantry item added", item: created });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ message: "Invalid item", errors: error.issues });
    console.error("pantry/add error", error);
    res.status(500).json({ message: "Failed to add pantry item" });
  }
});

// Update pantry item
r.put("/pantry/:itemId", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      category: z.string().optional(),
      quantity: z.union([z.number(), z.string()]).optional(),
      unit: z.string().optional(),
      location: z.string().optional(),
      expirationDate: z.string().datetime().optional(),
      notes: z.string().optional(),
      isRunningLow: z.boolean().optional(),
    });
    const body = schema.parse(req.body);

    // Convert quantity to number if it's a string
    let quantityNum: number | undefined;
    if (body.quantity !== undefined) {
      quantityNum = typeof body.quantity === 'string' ? parseFloat(body.quantity) : body.quantity;
      if (isNaN(quantityNum)) quantityNum = undefined;
    }

    const updated = await storage.updatePantryItem(req.params.itemId, {
      name: body.name,
      category: body.category,
      quantity: quantityNum,
      unit: body.unit,
      location: body.location,
      expirationDate: body.expirationDate ? new Date(body.expirationDate) : undefined,
      notes: body.notes,
      isRunningLow: body.isRunningLow,
    });

    if (!updated) return res.status(404).json({ message: "Pantry item not found" });
    res.json({ message: "Pantry item updated", item: updated });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ message: "Invalid update", errors: error.issues });
    console.error("pantry/update error", error);
    res.status(500).json({ message: "Failed to update pantry item" });
  }
});

// Delete pantry item
r.delete("/pantry/:itemId", async (req, res) => {
  try {
    const ok = await storage.deletePantryItem(req.params.itemId);
    if (!ok) return res.status(404).json({ message: "Pantry item not found" });
    res.json({ message: "Pantry item deleted" });
  } catch (error) {
    console.error("pantry/delete error", error);
    res.status(500).json({ message: "Failed to delete pantry item" });
  }
});

// Expiring soon
r.get("/users/:id/pantry/expiring", async (req, res) => {
  try {
    const days = Number(req.query.days ?? 7);
    const items = await storage.getExpiringItems(req.params.id, isNaN(days) ? 7 : days);
    res.json({ expiringItems: items, daysAhead: days, total: items.length });
  } catch (error) {
    console.error("pantry/expiring error", error);
    res.status(500).json({ message: "Failed to fetch expiring items" });
  }
});

// Pantry-based recipe suggestions
r.get("/users/:id/pantry/recipe-suggestions", async (req, res) => {
  try {
    const schema = z.object({
      requireAllIngredients: z.coerce.boolean().default(false),
      maxMissingIngredients: z.coerce.number().min(0).max(10).default(3),
      includeExpiringSoon: z.coerce.boolean().default(true),
      limit: z.coerce.number().min(1).max(50).default(20),
    });
    const opts = schema.parse(req.query);

    const suggestions = await storage.getRecipesFromPantryItems(req.params.id, opts);
    res.json({
      suggestions,
      options: opts,
      total: suggestions.length,
      message:
        suggestions.length === 0
          ? "No matches yet. Try adding more items to your pantry."
          : undefined,
    });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid parameters", errors: e.issues });
    console.error("pantry/suggestions error", e);
    res.status(500).json({ message: "Failed to get suggestions" });
  }
});


/* =========================
 * Household pantry (shared pantry)
 * Used by /pantry/household page
 *
 * Endpoints:
 *  - GET    /api/pantry/household
 *  - POST   /api/pantry/household
 *  - POST   /api/pantry/household/join
 *  - POST   /api/pantry/household/leave
 *  - POST   /api/pantry/household/sync
 *  - POST   /api/pantry/household/resolve-duplicates
 *
 * Notes:
 *  - We avoid relying on DB extensions like pgcrypto. IDs are generated in Node (randomUUID()).
 *  - We create the household tables/column if they don't exist yet, so this works even if db:push hasn't run.
 * ========================= */

async function ensureHouseholdSchema() {
  // Households table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pantry_households (
      id text PRIMARY KEY,
      name text NOT NULL,
      invite_code varchar NOT NULL UNIQUE,
      owner_id varchar NOT NULL REFERENCES users(id),
      created_at timestamptz DEFAULT now()
    );
  `);

  // Members table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pantry_household_members (
      id text PRIMARY KEY,
      household_id text NOT NULL REFERENCES pantry_households(id) ON DELETE CASCADE,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL DEFAULT 'member',
      joined_at timestamptz DEFAULT now(),
      UNIQUE (household_id, user_id)
    );
  `);

  // Shared pantry linkage: pantry_items.household_id (nullable)
  // This lets multiple users see the same pantry list when in the same household.
  await db.execute(sql`
    ALTER TABLE pantry_items
      ADD COLUMN IF NOT EXISTS household_id text REFERENCES pantry_households(id) ON DELETE SET NULL;
  `);
}

function makeInviteCode(len = 8) {
  // readable upper-case code
  return randomBytes(Math.ceil(len / 2)).toString("hex").slice(0, len).toUpperCase();
}

async function getHouseholdInfoForUser(userId: string) {
  await ensureHouseholdSchema();

  const membershipRes = await db.execute(sql`
    SELECT household_id, role
    FROM pantry_household_members
    WHERE user_id = ${userId}
    ORDER BY joined_at DESC
    LIMIT 1;
  `);

  const membershipRow = (membershipRes as any)?.rows?.[0];
  if (!membershipRow) {
    return { household: null, userRole: null, members: [] };
  }

  const householdId = String(membershipRow.household_id);
  const userRole = String(membershipRow.role) as "owner" | "admin" | "member";

  const hhRes = await db.execute(sql`
    SELECT id, name, invite_code, owner_id, created_at
    FROM pantry_households
    WHERE id = ${householdId}
    LIMIT 1;
  `);

  const hh = (hhRes as any)?.rows?.[0];
  if (!hh) {
    return { household: null, userRole: null, members: [] };
  }

  const membersRes = await db.execute(sql`
    SELECT m.user_id, m.role, m.joined_at, u.username, u.display_name, u.avatar_url
    FROM pantry_household_members m
    LEFT JOIN users u ON u.id = m.user_id
    WHERE m.household_id = ${householdId}
    ORDER BY m.role = 'owner' DESC, m.joined_at ASC;
  `);

  const members = ((membersRes as any)?.rows ?? []).map((r: any) => ({
    userId: String(r.user_id),
    role: String(r.role),
    joinedAt: r.joined_at ? new Date(r.joined_at).toISOString() : undefined,
    username: r.username ?? null,
    displayName: r.display_name ?? null,
    avatarUrl: r.avatar_url ?? null,
  }));

  return {
    household: {
      id: String(hh.id),
      name: String(hh.name),
      inviteCode: String(hh.invite_code),
      ownerId: String(hh.owner_id),
      createdAt: hh.created_at ? new Date(hh.created_at).toISOString() : undefined,
    },
    userRole,
    members,
  };
}

// GET household info for current user
r.get("/household", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const info = await getHouseholdInfoForUser(userId);
    return res.json(info);
  } catch (error) {
    console.error("pantry/household/get error", error);
    return res.status(500).json({ message: "Failed to load household" });
  }
});

// Create a household
r.post("/household", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    const schema = z.object({ name: z.string().min(2).max(80) });
    const body = schema.parse(req.body);

    // Ensure unique invite code
    let inviteCode = makeInviteCode(8);
    for (let i = 0; i < 6; i++) {
      const check = await db.execute(sql`SELECT id FROM pantry_households WHERE invite_code = ${inviteCode} LIMIT 1;`);
      if (!((check as any)?.rows?.[0])) break;
      inviteCode = makeInviteCode(8);
    }

    const householdId = randomUUID();
    await db.execute(sql`
      INSERT INTO pantry_households (id, name, owner_id, invite_code)
      VALUES (${householdId}, ${body.name}, ${userId}, ${inviteCode});
    `);

    const memberId = randomUUID();
    await db.execute(sql`
      INSERT INTO pantry_household_members (id, household_id, user_id, role)
      VALUES (${memberId}, ${householdId}, ${userId}, 'owner')
      ON CONFLICT (household_id, user_id) DO NOTHING;
    `);

    const info = await getHouseholdInfoForUser(userId);
    return res.json(info);
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ message: "Invalid request", errors: error.issues });
    console.error("pantry/household/create error", error);
    return res.status(500).json({ message: "Failed to create household" });
  }
});

// Join a household by invite code
r.post("/household/join", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    const schema = z.object({ inviteCode: z.string().min(4).max(32) });
    const body = schema.parse(req.body);
    const code = body.inviteCode.trim().toUpperCase();

    const hhRes = await db.execute(sql`
      SELECT id
      FROM pantry_households
      WHERE invite_code = ${code}
      LIMIT 1;
    `);
    const hh = (hhRes as any)?.rows?.[0];
    if (!hh?.id) return res.status(404).json({ message: "Invite code not found" });

    const memberId = randomUUID();
    await db.execute(sql`
      INSERT INTO pantry_household_members (id, household_id, user_id, role)
      VALUES (${memberId}, ${String(hh.id)}, ${userId}, 'member')
      ON CONFLICT (household_id, user_id) DO NOTHING;
    `);

    const info = await getHouseholdInfoForUser(userId);
    return res.json(info);
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ message: "Invalid request", errors: error.issues });
    console.error("pantry/household/join error", error);
    return res.status(500).json({ message: "Failed to join household" });
  }
});

// Leave household
r.post("/household/leave", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    await db.execute(sql`DELETE FROM pantry_household_members WHERE user_id = ${userId};`);
    return res.json({ ok: true });
  } catch (error) {
    console.error("pantry/household/leave error", error);
    return res.status(500).json({ message: "Failed to leave household" });
  }
});

/**
 * Sync personal pantry items into the household pantry.
 * - Moves non-duplicate items by setting household_id.
 * - Returns duplicates for user decision.
 */
r.post("/household/sync", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const info = await getHouseholdInfoForUser(userId);
    const hid = info.household?.id;
    if (!hid) return res.status(400).json({ message: "You are not in a household" });

    // Load personal items (not yet shared)
    const personalRes = await db.execute(sql`
      SELECT id, name, unit, category, quantity
      FROM pantry_items
      WHERE user_id = ${userId} AND household_id IS NULL
      ORDER BY created_at ASC;
    `);

    const personal = (personalRes as any)?.rows ?? [];
    let moved = 0;
    const duplicates: any[] = [];

    for (const item of personal) {
      const name = String(item.name);
      const unit = item.unit ?? null;

      const dupeRes = await db.execute(sql`
        SELECT id, name, unit, category, quantity
        FROM pantry_items
        WHERE household_id = ${hid}
          AND lower(name) = lower(${name})
          AND coalesce(unit,'') = coalesce(${unit},'')
        LIMIT 1;
      `);
      const existing = (dupeRes as any)?.rows?.[0];

      if (existing) {
        duplicates.push({
          existing: {
            id: String(existing.id),
            name: String(existing.name),
            unit: existing.unit ?? null,
            category: existing.category ?? null,
            quantity: existing.quantity?.toString?.() ?? (existing.quantity ?? null),
          },
          incoming: {
            id: String(item.id),
            name: String(item.name),
            unit: item.unit ?? null,
            category: item.category ?? null,
            quantity: item.quantity?.toString?.() ?? (item.quantity ?? null),
          },
        });
        continue;
      }

      await db.execute(sql`
        UPDATE pantry_items
        SET household_id = ${hid}
        WHERE id = ${String(item.id)} AND user_id = ${userId};
      `);
      moved += 1;
    }

    return res.json({ ok: true, moved, duplicates });
  } catch (error) {
    console.error("pantry/household/sync error", error);
    return res.status(500).json({ message: "Failed to sync pantry" });
  }
});

// Resolve duplicates returned from /sync
r.post("/household/resolve-duplicates", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const info = await getHouseholdInfoForUser(userId);
    const hid = info.household?.id;
    if (!hid) return res.status(400).json({ message: "You are not in a household" });

    const schema = z.object({
      decisions: z.array(z.object({
        incomingId: z.string().min(1),
        existingId: z.string().min(1),
        action: z.enum(["merge", "keepBoth", "discardIncoming"]),
      })).min(1),
    });

    const body = schema.parse(req.body);

    let merged = 0;
    let kept = 0;
    let discarded = 0;

    for (const d of body.decisions) {
      const incomingId = d.incomingId;
      const existingId = d.existingId;

      if (d.action === "discardIncoming") {
        await db.execute(sql`DELETE FROM pantry_items WHERE id = ${incomingId} AND user_id = ${userId};`);
        discarded += 1;
        continue;
      }

      if (d.action === "keepBoth") {
        await db.execute(sql`
          UPDATE pantry_items
          SET household_id = ${hid}
          WHERE id = ${incomingId} AND user_id = ${userId};
        `);
        kept += 1;
        continue;
      }

      // merge: add quantities when possible, otherwise just discard incoming
      const qRes = await db.execute(sql`
        SELECT quantity FROM pantry_items WHERE id = ${existingId} AND household_id = ${hid} LIMIT 1;
      `);
      const qiRes = await db.execute(sql`
        SELECT quantity FROM pantry_items WHERE id = ${incomingId} AND user_id = ${userId} LIMIT 1;
      `);

      const existingQ = Number((qRes as any)?.rows?.[0]?.quantity ?? 0);
      const incomingQ = Number((qiRes as any)?.rows?.[0]?.quantity ?? 0);

      const newQ = (isNaN(existingQ) ? 0 : existingQ) + (isNaN(incomingQ) ? 0 : incomingQ);

      await db.execute(sql`
        UPDATE pantry_items SET quantity = ${String(newQ)} WHERE id = ${existingId} AND household_id = ${hid};
      `);
      await db.execute(sql`DELETE FROM pantry_items WHERE id = ${incomingId} AND user_id = ${userId};`);

      merged += 1;
    }

    return res.json({ ok: true, merged, kept, discarded });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ message: "Invalid request", errors: error.issues });
    console.error("pantry/household/resolve-duplicates error", error);
    return res.status(500).json({ message: "Failed to resolve duplicates" });
  }
});

export default r;
