// server/routes/pantry.ts
import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { randomBytes } from "crypto";
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
 * Endpoints:
 *  - GET    /api/pantry/household
 *  - POST   /api/pantry/household          { name }
 *  - POST   /api/pantry/household/join     { inviteCode }
 *  - POST   /api/pantry/household/leave
 * ========================= */

let _householdSchemaReady: Promise<void> | null = null;

async function ensureHouseholdSchema() {
  if (_householdSchemaReady) return _householdSchemaReady;

  _householdSchemaReady = (async () => {
    // Create tables if they don't exist yet.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pantry_households (
        id varchar PRIMARY KEY,
        name text NOT NULL,
        owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invite_code text NOT NULL UNIQUE,
        created_at timestamp DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pantry_household_members (
        id varchar PRIMARY KEY,
        household_id varchar NOT NULL REFERENCES pantry_households(id) ON DELETE CASCADE,
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role text NOT NULL DEFAULT 'member',
        created_at timestamp DEFAULT now(),
        UNIQUE (household_id, user_id)
      );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS pantry_household_members_user_idx ON pantry_household_members(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS pantry_household_members_household_idx ON pantry_household_members(household_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS pantry_households_invite_code_idx ON pantry_households(invite_code);`);
  })();

  return _householdSchemaReady;
}

function makeInviteCode(len = 8) {
  // URL-safe, uppercase-ish invite code
  return randomBytes(Math.ceil(len / 2)).toString("hex").slice(0, len).toUpperCase();
}

type HouseholdInfo = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  userRole: "owner" | "admin" | "member";
  members: {
    id: string;
    username: string;
    displayName: string | null;
    role: "owner" | "admin" | "member";
    joinedAt: string;
  }[];
};

async function getHouseholdInfoForUser(userId: string): Promise<HouseholdInfo | null> {
  await ensureHouseholdSchema();

  const header = await db.execute(sql`
    SELECT
      h.id,
      h.name,
      h.invite_code,
      h.owner_user_id,
      m.role AS user_role
    FROM pantry_households h
    JOIN pantry_household_members m ON m.household_id = h.id
    WHERE m.user_id = ${userId}
    LIMIT 1;
  `);

  const row = (header as any)?.rows?.[0];
  if (!row) return null;

  const membersRes = await db.execute(sql`
    SELECT
      u.id,
      u.username,
      u.display_name,
      m.role,
      m.created_at
    FROM pantry_household_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.household_id = ${row.id}
    ORDER BY m.created_at ASC;
  `);

  const members = ((membersRes as any)?.rows || []).map((r: any) => ({
    id: String(r.id),
    username: String(r.username || ""),
    displayName: r.display_name ?? null,
    role: (r.role || "member") as "owner" | "admin" | "member",
    joinedAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  }));

  return {
    id: String(row.id),
    name: String(row.name),
    inviteCode: String(row.invite_code),
    ownerId: String(row.owner_user_id),
    userRole: (row.user_role || "member") as "owner" | "admin" | "member",
    members,
  };
}

// Get current user's household info (or null)
r.get("/household", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const household = await getHouseholdInfoForUser(userId);
    res.json({ household });
  } catch (e: any) {
    console.error("pantry/household get error", e);
    res.status(500).json({ message: "Failed to load household" });
  }
});

// Create household (current user becomes owner)
r.post("/household", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    const schema = z.object({ name: z.string().min(2).max(80) });
    const body = schema.parse(req.body);

    // If user already in a household, block creating another
    const existing = await db.execute(sql`
      SELECT household_id FROM pantry_household_members WHERE user_id = ${userId} LIMIT 1;
    `);
    if ((existing as any)?.rows?.[0]?.household_id) {
      return res.status(400).json({ message: "You are already in a household. Leave it before creating a new one." });
    }

    // Ensure unique invite code
    let inviteCode = makeInviteCode(8);
    for (let i = 0; i < 5; i++) {
      const check = await db.execute(sql`SELECT id FROM pantry_households WHERE invite_code = ${inviteCode} LIMIT 1;`);
      if (!((check as any)?.rows?.[0])) break;
      inviteCode = makeInviteCode(8);
    }

        const hid = randomUUID();

    await db.execute(sql`
      INSERT INTO pantry_households (id, name, owner_user_id, invite_code)
      VALUES (${hid}, ${body.name}, ${userId}, ${inviteCode});
    `);

    await db.execute(sql`
      INSERT INTO pantry_household_members (household_id, user_id, role)
      VALUES (${hid}, ${userId}, 'owner')
      ON CONFLICT (household_id, user_id) DO NOTHING;
    `);

    const household = await getHouseholdInfoForUser(userId);
    res.json({ household });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid input", errors: e.issues });
    console.error("pantry/household create error", e);
    res.status(500).json({ message: "Failed to create household" });
  }
});

// Join household using invite code
r.post("/household/join", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    const schema = z.object({ inviteCode: z.string().min(4).max(32) });
    const body = schema.parse(req.body);

    // If already in a household, block joining another
    const existing = await db.execute(sql`
      SELECT household_id FROM pantry_household_members WHERE user_id = ${userId} LIMIT 1;
    `);
    if ((existing as any)?.rows?.[0]?.household_id) {
      return res.status(400).json({ message: "You are already in a household. Leave it before joining another." });
    }

    const hh = await db.execute(sql`
      SELECT id FROM pantry_households WHERE invite_code = ${body.inviteCode.trim().toUpperCase()} LIMIT 1;
    `);
    const hid = (hh as any)?.rows?.[0]?.id;
    if (!hid) return res.status(404).json({ message: "Invite code not found" });

    await db.execute(sql`
      INSERT INTO pantry_household_members (household_id, user_id, role)
      VALUES (${String(hid)}, ${userId}, 'member')
      ON CONFLICT (household_id, user_id) DO NOTHING;
    `);

    const household = await getHouseholdInfoForUser(userId);
    res.json({ household });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid input", errors: e.issues });
    console.error("pantry/household join error", e);
    res.status(500).json({ message: "Failed to join household" });
  }
});

// Leave current household
r.post("/household/leave", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    const mem = await db.execute(sql`
      SELECT m.household_id, m.role
      FROM pantry_household_members m
      WHERE m.user_id = ${userId}
      LIMIT 1;
    `);
    const row = (mem as any)?.rows?.[0];
    if (!row?.household_id) return res.json({ ok: true }); // nothing to do

    const householdId = String(row.household_id);
    const role = String(row.role || "member");

    if (role === "owner") {
      const others = await db.execute(sql`
        SELECT COUNT(*)::int AS c
        FROM pantry_household_members
        WHERE household_id = ${householdId} AND user_id <> ${userId};
      `);
      const c = Number((others as any)?.rows?.[0]?.c || 0);
      if (c > 0) {
        return res.status(400).json({
          message: "Owners can't leave while other members are in the household. Remove members first.",
        });
      }
      // Owner is the last member — remove household entirely
      await db.execute(sql`DELETE FROM pantry_households WHERE id = ${householdId};`);
      return res.json({ ok: true });
    }

    await db.execute(sql`
      DELETE FROM pantry_household_members
      WHERE household_id = ${householdId} AND user_id = ${userId};
    `);

    res.json({ ok: true });
  } catch (e: any) {
    console.error("pantry/household leave error", e);
    res.status(500).json({ message: "Failed to leave household" });
  }
});

export default r;
