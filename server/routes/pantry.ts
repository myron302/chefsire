// server/routes/pantry.ts
import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { randomBytes, randomUUID } from "crypto";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";
import {
  sendHouseholdInviteNotification,
  sendHouseholdInviteAcceptedNotification,
} from "../services/notification-service";

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
 *  - POST   /api/pantry/household/leave    { householdId? }  (if omitted, leaves all)
 * ========================= */

let _householdSchemaReady: Promise<void> | null = null;

async function ensureHouseholdSchema() {
  if (_householdSchemaReady) return _householdSchemaReady;

  _householdSchemaReady = (async () => {
    // These tables are created without gen_random_uuid() so we don't depend on pgcrypto.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pantry_households (
        id varchar PRIMARY KEY,
        name text NOT NULL,
        owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS pantry_household_members_user_idx
      ON pantry_household_members(user_id);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS pantry_household_members_household_idx
      ON pantry_household_members(household_id);
    `);

    // Household invites table for pending invitations
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pantry_household_invites (
        id varchar PRIMARY KEY,
        household_id varchar NOT NULL REFERENCES pantry_households(id) ON DELETE CASCADE,
        invited_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invited_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'pending',
        created_at timestamp DEFAULT now(),
        UNIQUE (household_id, invited_user_id)
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS pantry_household_invites_user_idx
      ON pantry_household_invites(invited_user_id);
    `);

    // Add household_id to pantry_items if missing (nullable; personal pantry items stay null)
    await db.execute(sql`
      ALTER TABLE pantry_items
      ADD COLUMN IF NOT EXISTS household_id varchar REFERENCES pantry_households(id) ON DELETE SET NULL;
    `);
  })();

  return _householdSchemaReady;
}

function makeInviteCode() {
  // Short-ish code, URL-safe enough
  return randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}

async function getHouseholdInfoForUser(userId: string) {
  // If the user is in multiple households, return the most recent membership (created_at)
  const m = await db.execute(sql`
    SELECT m.household_id, m.role
    FROM pantry_household_members m
    WHERE m.user_id = ${userId}
    ORDER BY m.created_at DESC
    LIMIT 1;
  `);
  const row = (m as any)?.rows?.[0];
  if (!row?.household_id) return null;

  const householdId = String(row.household_id);
  const role = String(row.role || "member");

  const h = await db.execute(sql`
    SELECT id, name, owner_id, invite_code, created_at
    FROM pantry_households
    WHERE id = ${householdId}
    LIMIT 1;
  `);
  const hh = (h as any)?.rows?.[0];
  if (!hh?.id) {
    // Stale membership; clean it up
    await db.execute(sql`DELETE FROM pantry_household_members WHERE household_id = ${householdId} AND user_id = ${userId};`);
    return null;
  }

  const members = await db.execute(sql`
    SELECT m.user_id, m.role, u.username, u.email
    FROM pantry_household_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.household_id = ${householdId}
    ORDER BY m.created_at ASC;
  `);

  return {
    id: String(hh.id),
    name: String(hh.name),
    ownerUserId: String(hh.owner_id),
    inviteCode: String(hh.invite_code),
    createdAt: hh.created_at,
    myRole: role,
    members: ((members as any)?.rows || []).map((r: any) => ({
      userId: String(r.user_id),
      role: String(r.role),
      username: r.username ?? null,
      email: r.email ?? null,
    })),
  };
}

/**
 * GET /api/pantry/household
 * Returns the household for the current user (or null).
 */
r.get("/household", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    const householdInfo = await getHouseholdInfoForUser(userId);

    if (!householdInfo) {
      return res.json({ household: null, userRole: null, members: [] });
    }

    // Restructure to match frontend expectations
    res.json({
      household: {
        id: householdInfo.id,
        name: householdInfo.name,
        inviteCode: householdInfo.inviteCode,
        ownerId: householdInfo.ownerUserId,
        createdAt: householdInfo.createdAt,
      },
      userRole: householdInfo.myRole,
      members: householdInfo.members,
    });
  } catch (e: any) {
    console.error("pantry/household get error", e);
    res.status(500).json({ message: "Failed to load household", details: String(e?.message || e) });
  }
});

/**
 * POST /api/pantry/household
 * Create household (current user becomes owner)
 */
r.post("/household", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    const schema = z.object({ name: z.string().min(2).max(80) });
    const body = schema.parse(req.body);

    // Clean up any stale memberships (household deleted but member row still exists)
    await db.execute(sql`
      DELETE FROM pantry_household_members m
      WHERE m.user_id = ${userId}
        AND NOT EXISTS (SELECT 1 FROM pantry_households h WHERE h.id = m.household_id);
    `);

    // If user already in a household, block creating another
    const existing = await db.execute(sql`
      SELECT household_id FROM pantry_household_members WHERE user_id = ${userId} LIMIT 1;
    `);
    if ((existing as any)?.rows?.[0]?.household_id) {
      return res.status(400).json({
        message: "Create failed, you are already in a household. leave it before creating a new one",
      });
    }

    const hid = randomUUID();
    const inviteCode = makeInviteCode();

    await db.execute(sql`
      INSERT INTO pantry_households (id, name, owner_id, invite_code)
      VALUES (${hid}, ${body.name}, ${userId}, ${inviteCode});
    `);

    await db.execute(sql`
      INSERT INTO pantry_household_members (id, household_id, user_id, role)
      VALUES (${randomUUID()}, ${hid}, ${userId}, 'owner')
      ON CONFLICT (household_id, user_id) DO NOTHING;
    `);

    const householdInfo = await getHouseholdInfoForUser(userId);
    if (!householdInfo) {
      return res.status(500).json({ message: "Failed to retrieve created household" });
    }

    // Return same structure as GET /household
    res.json({
      household: {
        id: householdInfo.id,
        name: householdInfo.name,
        inviteCode: householdInfo.inviteCode,
        ownerId: householdInfo.ownerUserId,
        createdAt: householdInfo.createdAt,
      },
      userRole: householdInfo.myRole,
      members: householdInfo.members,
    });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid input", errors: e.issues });
    console.error("pantry/household create error", e);
    res.status(500).json({ message: "Failed to create household", details: String(e?.message || e) });
  }
});

/**
 * POST /api/pantry/household/join
 */
r.post("/household/join", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    const schema = z.object({ inviteCode: z.string().min(4) });
    const body = schema.parse(req.body);

    // Clean stale memberships
    await db.execute(sql`
      DELETE FROM pantry_household_members m
      WHERE m.user_id = ${userId}
        AND NOT EXISTS (SELECT 1 FROM pantry_households h WHERE h.id = m.household_id);
    `);

    // Block if already in a household
    const existing = await db.execute(sql`
      SELECT household_id FROM pantry_household_members WHERE user_id = ${userId} LIMIT 1;
    `);
    if ((existing as any)?.rows?.[0]?.household_id) {
      return res.status(400).json({
        message: "Join failed, you are already in a household. leave it before joining another one",
      });
    }

    const found = await db.execute(sql`
      SELECT id FROM pantry_households WHERE invite_code = ${body.inviteCode} LIMIT 1;
    `);
    const hid = (found as any)?.rows?.[0]?.id;
    if (!hid) return res.status(404).json({ message: "Invalid invite code" });

    await db.execute(sql`
      INSERT INTO pantry_household_members (id, household_id, user_id, role)
      VALUES (${randomUUID()}, ${String(hid)}, ${userId}, 'member')
      ON CONFLICT (household_id, user_id) DO NOTHING;
    `);

    const householdInfo = await getHouseholdInfoForUser(userId);
    if (!householdInfo) {
      return res.status(500).json({ message: "Failed to retrieve household after joining" });
    }

    // Return same structure as GET /household
    res.json({
      household: {
        id: householdInfo.id,
        name: householdInfo.name,
        inviteCode: householdInfo.inviteCode,
        ownerId: householdInfo.ownerUserId,
        createdAt: householdInfo.createdAt,
      },
      userRole: householdInfo.myRole,
      members: householdInfo.members,
    });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid input", errors: e.issues });
    console.error("pantry/household join error", e);
    res.status(500).json({ message: "Failed to join household", details: String(e?.message || e) });
  }
});

/**
 * POST /api/pantry/household/leave
 * If householdId is omitted, leaves ALL households the user belongs to.
 * (This fixes cases where multiple membership rows exist.)
 */
r.post("/household/leave", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    const schema = z.object({ householdId: z.string().optional() }).optional();
    const body = schema?.parse(req.body ?? {}) as any;
    const targetHouseholdId = body?.householdId ? String(body.householdId) : null;

    const mems = await db.execute(sql`
      SELECT m.household_id, m.role
      FROM pantry_household_members m
      WHERE m.user_id = ${userId}
      ${targetHouseholdId ? sql`AND m.household_id = ${targetHouseholdId}` : sql``}
    `);

    const rows = ((mems as any)?.rows || []) as any[];
    if (rows.length === 0) return res.json({ ok: true });

    // If user is owner in any household that still has other members, block leaving that household.
    for (const r0 of rows) {
      const hid = String(r0.household_id);
      const role = String(r0.role || "member");
      if (role === "owner") {
        const others = await db.execute(sql`
          SELECT COUNT(*)::int AS c
          FROM pantry_household_members
          WHERE household_id = ${hid} AND user_id <> ${userId};
        `);
        const c = Number((others as any)?.rows?.[0]?.c || 0);
        if (c > 0) {
          return res.status(400).json({
            message: "Owners can't leave while other members are in the household. Remove members first.",
          });
        }
      }
    }

    // For owner households with no others, delete the household (will cascade members)
    for (const r0 of rows) {
      const hid = String(r0.household_id);
      const role = String(r0.role || "member");
      if (role === "owner") {
        await db.execute(sql`DELETE FROM pantry_households WHERE id = ${hid};`);
      }
    }

    // Delete membership rows for user (for the target household or all)
    await db.execute(sql`
      DELETE FROM pantry_household_members
      WHERE user_id = ${userId}
      ${targetHouseholdId ? sql`AND household_id = ${targetHouseholdId}` : sql``}
    `);

    res.json({ ok: true });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid input", errors: e.issues });
    console.error("pantry/household leave error", e);
    res.status(500).json({ message: "Failed to leave household", details: String(e?.message || e) });
  }
});

/**
 * POST /api/pantry/household/invite
 * Invite a user by email or userId
 * Body: { emailOrUserId: string }
 */
r.post("/household/invite", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    const schema = z.object({ emailOrUserId: z.string().min(1) });
    const body = schema.parse(req.body);
    const emailOrUserId = body.emailOrUserId.trim();

    // Get inviter's household
    const myHousehold = await getHouseholdInfoForUser(userId);
    if (!myHousehold) {
      return res.status(400).json({ message: "You are not in a household" });
    }

    // Check if inviter is owner or admin
    if (myHousehold.myRole !== "owner" && myHousehold.myRole !== "admin") {
      return res.status(403).json({ message: "Only owners and admins can invite members" });
    }

    // Find the target user by email, userId, or username
    const userSearch = await db.execute(sql`
      SELECT id, username, email
      FROM users
      WHERE id = ${emailOrUserId} OR email = ${emailOrUserId} OR username = ${emailOrUserId}
      LIMIT 1
    `);
    const targetUser = (userSearch as any)?.rows?.[0];
    if (!targetUser?.id) {
      return res.status(404).json({
        message: "User not found with that email, username, or ID",
        details: `Searched for: "${emailOrUserId}"`,
      });
    }

    const targetUserId = String(targetUser.id);

    // Check if target user is already in a household
    const targetHousehold = await getHouseholdInfoForUser(targetUserId);
    if (targetHousehold) {
      return res.status(400).json({
        message: `${targetUser.username || targetUser.email} is already in a household`,
      });
    }

    // Check if there's already a pending invite
    const existingInvite = await db.execute(sql`
      SELECT id, status FROM pantry_household_invites
      WHERE household_id = ${myHousehold.id} AND invited_user_id = ${targetUserId}
      LIMIT 1
    `);
    const existing = (existingInvite as any)?.rows?.[0];
    if (existing && existing.status === 'pending') {
      return res.status(400).json({
        message: `${targetUser.username || targetUser.email} already has a pending invite`,
      });
    }

    // Create pending invite instead of auto-adding
    await db.execute(sql`
      INSERT INTO pantry_household_invites (id, household_id, invited_user_id, invited_by_user_id, status)
      VALUES (${randomUUID()}, ${myHousehold.id}, ${targetUserId}, ${userId}, 'pending')
      ON CONFLICT (household_id, invited_user_id)
      DO UPDATE SET status = 'pending', invited_by_user_id = ${userId}, created_at = now()
    `);

    // Send notification to invited user
    const inviter = await db.execute(sql`
      SELECT username, avatar FROM users WHERE id = ${userId} LIMIT 1
    `);
    const inviterUser = (inviter as any)?.rows?.[0];

    if (inviterUser) {
      sendHouseholdInviteNotification(
        targetUserId,
        userId,
        inviterUser.username,
        inviterUser.avatar,
        myHousehold.name
      );
    }

    res.json({
      ok: true,
      message: `Invite sent to ${targetUser.username || targetUser.email}`,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
      },
    });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid input", errors: e.issues });
    console.error("pantry/household invite error", e);
    res.status(500).json({ message: "Failed to invite user", details: String(e?.message || e) });
  }
});

/**
 * GET /api/pantry/household/invites
 * Get pending invites for the current user
 */
r.get("/household/invites", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    const invites = await db.execute(sql`
      SELECT
        i.id,
        i.household_id,
        i.status,
        i.created_at,
        h.name AS household_name,
        u.username AS invited_by_username,
        u.email AS invited_by_email
      FROM pantry_household_invites i
      JOIN pantry_households h ON h.id = i.household_id
      JOIN users u ON u.id = i.invited_by_user_id
      WHERE i.invited_user_id = ${userId} AND i.status = 'pending'
      ORDER BY i.created_at DESC
    `);

    const rows = (invites as any)?.rows || [];
    res.json({
      invites: rows.map((r: any) => ({
        id: String(r.id),
        householdId: String(r.household_id),
        householdName: String(r.household_name),
        invitedBy: {
          username: r.invited_by_username,
          email: r.invited_by_email,
        },
        createdAt: r.created_at,
      })),
    });
  } catch (e: any) {
    console.error("pantry/household/invites get error", e);
    res.status(500).json({ message: "Failed to fetch invites", details: String(e?.message || e) });
  }
});

/**
 * POST /api/pantry/household/invites/:inviteId/accept
 * Accept a household invite
 */
r.post("/household/invites/:inviteId/accept", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    const inviteId = req.params.inviteId;

    // Get the invite
    const inviteResult = await db.execute(sql`
      SELECT id, household_id, invited_user_id, status
      FROM pantry_household_invites
      WHERE id = ${inviteId} AND invited_user_id = ${userId}
      LIMIT 1
    `);
    const invite = (inviteResult as any)?.rows?.[0];

    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    if (invite.status !== 'pending') {
      return res.status(400).json({ message: "Invite is no longer pending" });
    }

    // Check if user is already in a household
    const existingHousehold = await getHouseholdInfoForUser(userId);
    if (existingHousehold) {
      return res.status(400).json({ message: "You are already in a household. Leave it first." });
    }

    const householdId = String(invite.household_id);

    // Add user to household
    await db.execute(sql`
      INSERT INTO pantry_household_members (id, household_id, user_id, role)
      VALUES (${randomUUID()}, ${householdId}, ${userId}, 'member')
      ON CONFLICT (household_id, user_id) DO NOTHING
    `);

    // Mark invite as accepted
    await db.execute(sql`
      UPDATE pantry_household_invites
      SET status = 'accepted'
      WHERE id = ${inviteId}
    `);

    // Get invite details to send notification to inviter
    const inviteDetails = await db.execute(sql`
      SELECT i.invited_by_user_id, h.name as household_name
      FROM pantry_household_invites i
      JOIN pantry_households h ON h.id = i.household_id
      WHERE i.id = ${inviteId}
      LIMIT 1
    `);
    const details = (inviteDetails as any)?.rows?.[0];

    // Get accepter user info
    const accepter = await db.execute(sql`
      SELECT username, avatar FROM users WHERE id = ${userId} LIMIT 1
    `);
    const accepterUser = (accepter as any)?.rows?.[0];

    if (details && accepterUser) {
      sendHouseholdInviteAcceptedNotification(
        details.invited_by_user_id,
        userId,
        accepterUser.username,
        accepterUser.avatar,
        details.household_name
      );
    }

    res.json({ ok: true, message: "Invite accepted" });
  } catch (e: any) {
    console.error("pantry/household/invites/accept error", e);
    res.status(500).json({ message: "Failed to accept invite", details: String(e?.message || e) });
  }
});

/**
 * POST /api/pantry/household/invites/:inviteId/decline
 * Decline a household invite
 */
r.post("/household/invites/:inviteId/decline", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    const inviteId = req.params.inviteId;

    // Verify the invite exists and belongs to this user
    const inviteResult = await db.execute(sql`
      SELECT id, invited_user_id, status
      FROM pantry_household_invites
      WHERE id = ${inviteId} AND invited_user_id = ${userId}
      LIMIT 1
    `);
    const invite = (inviteResult as any)?.rows?.[0];

    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    if (invite.status !== 'pending') {
      return res.status(400).json({ message: "Invite is no longer pending" });
    }

    // Mark invite as declined
    await db.execute(sql`
      UPDATE pantry_household_invites
      SET status = 'declined'
      WHERE id = ${inviteId}
    `);

    res.json({ ok: true, message: "Invite declined" });
  } catch (e: any) {
    console.error("pantry/household/invites/decline error", e);
    res.status(500).json({ message: "Failed to decline invite", details: String(e?.message || e) });
  }
});

/**
 * DELETE /api/pantry/household/members/:userId
 * Remove a member from the household (owner/admin only)
 */
r.delete("/household/members/:userId", requireAuth, async (req, res) => {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    const targetUserId = req.params.userId;

    // Get current user's household and role
    const myHousehold = await getHouseholdInfoForUser(currentUserId);
    if (!myHousehold) {
      return res.status(400).json({ message: "You are not in a household" });
    }

    // Check if current user is owner or admin
    if (myHousehold.myRole !== "owner" && myHousehold.myRole !== "admin") {
      return res.status(403).json({ message: "Only owners and admins can remove members" });
    }

    // Check if target user is in the same household
    const targetMember = myHousehold.members.find(m => m.userId === targetUserId);
    if (!targetMember) {
      return res.status(404).json({ message: "User is not a member of this household" });
    }

    // Prevent removing the owner
    if (targetMember.role === "owner") {
      return res.status(400).json({ message: "Cannot remove the household owner" });
    }

    // Remove the member
    await db.execute(sql`
      DELETE FROM pantry_household_members
      WHERE household_id = ${myHousehold.id} AND user_id = ${targetUserId}
    `);

    res.json({ ok: true, message: "Member removed from household" });
  } catch (e: any) {
    console.error("pantry/household/members/remove error", e);
    res.status(500).json({ message: "Failed to remove member", details: String(e?.message || e) });
  }
});

/**
 * POST /api/pantry/household/sync
 * Move user's personal pantry items into the household pantry
 */
r.post("/household/sync", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    // Get user's household
    const myHousehold = await getHouseholdInfoForUser(userId);
    if (!myHousehold) {
      return res.status(400).json({ message: "You are not in a household" });
    }

    // Get user's personal pantry items (not already in a household)
    const personalItems = await db.execute(sql`
      SELECT id, name, category, quantity, unit
      FROM pantry_items
      WHERE user_id = ${userId} AND household_id IS NULL
    `);

    const items = (personalItems as any)?.rows || [];

    if (items.length === 0) {
      return res.json({ ok: true, moved: 0, duplicates: [] });
    }

    // Check for duplicates (items with same name already in household)
    const householdItems = await db.execute(sql`
      SELECT id, name, category, quantity, unit
      FROM pantry_items
      WHERE household_id = ${myHousehold.id}
    `);

    const existingItems = (householdItems as any)?.rows || [];
    const duplicates: any[] = [];
    const itemsToMove: any[] = [];

    for (const item of items) {
      const existing = existingItems.find((e: any) =>
        e.name.toLowerCase().trim() === item.name.toLowerCase().trim()
      );

      if (existing) {
        duplicates.push({
          existing: {
            id: String(existing.id),
            name: existing.name,
            category: existing.category,
            quantity: existing.quantity,
            unit: existing.unit,
          },
          incoming: {
            id: String(item.id),
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unit: item.unit,
          },
        });
      } else {
        itemsToMove.push(item.id);
      }
    }

    // Move non-duplicate items to household
    if (itemsToMove.length > 0) {
      for (const itemId of itemsToMove) {
        await db.execute(sql`
          UPDATE pantry_items
          SET household_id = ${myHousehold.id}
          WHERE id = ${itemId}
        `);
      }
    }

    res.json({
      ok: true,
      moved: itemsToMove.length,
      duplicates,
    });
  } catch (e: any) {
    console.error("pantry/household/sync error", e);
    res.status(500).json({ message: "Failed to sync pantry", details: String(e?.message || e) });
  }
});

/**
 * POST /api/pantry/household/resolve-duplicates
 * Resolve duplicate items after sync
 * Body: { decisions: [{ incomingId, existingId, action: "merge" | "keepBoth" | "discardIncoming" }] }
 */
r.post("/household/resolve-duplicates", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await ensureHouseholdSchema();

    const myHousehold = await getHouseholdInfoForUser(userId);
    if (!myHousehold) {
      return res.status(400).json({ message: "You are not in a household" });
    }

    const schema = z.object({
      decisions: z.array(
        z.object({
          incomingId: z.string(),
          existingId: z.string(),
          action: z.enum(["merge", "keepBoth", "discardIncoming"]),
        })
      ),
    });

    const body = schema.parse(req.body);

    let merged = 0;
    let discarded = 0;
    let kept = 0;

    for (const decision of body.decisions) {
      if (decision.action === "merge") {
        // Merge quantities if both have them
        const existing = await db.execute(sql`
          SELECT quantity, unit FROM pantry_items WHERE id = ${decision.existingId} LIMIT 1
        `);
        const incoming = await db.execute(sql`
          SELECT quantity, unit FROM pantry_items WHERE id = ${decision.incomingId} LIMIT 1
        `);

        const existingRow = (existing as any)?.rows?.[0];
        const incomingRow = (incoming as any)?.rows?.[0];

        if (existingRow && incomingRow && existingRow.quantity && incomingRow.quantity) {
          const newQuantity = Number(existingRow.quantity) + Number(incomingRow.quantity);
          await db.execute(sql`
            UPDATE pantry_items
            SET quantity = ${newQuantity}
            WHERE id = ${decision.existingId}
          `);
        }

        // Delete the incoming item
        await db.execute(sql`
          DELETE FROM pantry_items WHERE id = ${decision.incomingId}
        `);
        merged++;
      } else if (decision.action === "keepBoth") {
        // Move incoming item to household
        await db.execute(sql`
          UPDATE pantry_items
          SET household_id = ${myHousehold.id}
          WHERE id = ${decision.incomingId}
        `);
        kept++;
      } else if (decision.action === "discardIncoming") {
        // Delete the incoming item
        await db.execute(sql`
          DELETE FROM pantry_items WHERE id = ${decision.incomingId}
        `);
        discarded++;
      }
    }

    res.json({ ok: true, merged, discarded, kept });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid input", errors: e.issues });
    console.error("pantry/household/resolve-duplicates error", e);
    res.status(500).json({ message: "Failed to resolve duplicates", details: String(e?.message || e) });
  }
});


export default r;
