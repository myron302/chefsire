import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../../db";

export function makeInviteCode() {
  // Short-ish code, URL-safe enough
  return randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}

export async function getHouseholdInfoForUser(userId: string) {
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
