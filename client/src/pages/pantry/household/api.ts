import type { DuplicatePair, DuplicateDecision, HouseholdInfo, HouseholdInvite } from "./types";

type JsonRecord = Record<string, any>;

async function readJson(res: Response): Promise<JsonRecord> {
  return res.json().catch(() => ({}));
}

export async function fetchHouseholdInfo() {
  const res = await fetch("/api/pantry/household", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load household");
  return (await readJson(res)) as HouseholdInfo;
}

export async function fetchHouseholdInvites() {
  const res = await fetch("/api/pantry/household/invites", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load invites");
  return (await readJson(res)) as { invites: HouseholdInvite[] };
}

export async function createHousehold(name: string) {
  const res = await fetch("/api/pantry/household", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  const j = await readJson(res);
  if (!res.ok) {
    const debugInfo = `Status: ${res.status}\nMessage: ${j.message || "Unknown"}\nDetails: ${j.details || "None"}\nResponse: ${JSON.stringify(j)}`;
    throw new Error(debugInfo);
  }
  return j as HouseholdInfo;
}

export async function joinHousehold(inviteCode: string) {
  const res = await fetch("/api/pantry/household/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ inviteCode }),
  });
  const j = await readJson(res);
  if (!res.ok) throw new Error(j.message || "Failed to join household");
  return j as HouseholdInfo;
}

export async function leaveHousehold() {
  const res = await fetch("/api/pantry/household/leave", {
    method: "POST",
    credentials: "include",
  });
  const j = await readJson(res);
  if (!res.ok) throw new Error(j.message || "Failed to leave household");
  return j;
}

export async function syncHouseholdPantry() {
  const res = await fetch("/api/pantry/household/sync", {
    method: "POST",
    credentials: "include",
  });
  const j = await readJson(res);
  if (!res.ok) throw new Error(j.message || "Failed to sync pantry");
  return j as { ok: boolean; moved: number; duplicates: DuplicatePair[] };
}

export async function resolveHouseholdDuplicates(
  decisions: Array<{ incomingId: string; existingId: string; action: DuplicateDecision }>,
) {
  const res = await fetch("/api/pantry/household/resolve-duplicates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ decisions }),
  });
  const j = await readJson(res);
  if (!res.ok) throw new Error(j.message || "Failed to resolve duplicates");
  return j as { ok: boolean; merged: number; discarded: number; kept: number };
}

export async function inviteHouseholdUser(emailOrUserId: string) {
  const res = await fetch("/api/pantry/household/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ emailOrUserId }),
  });
  const j = await readJson(res);
  if (!res.ok) {
    const debugInfo = `Status: ${res.status}\nMessage: ${j.message || "Unknown"}\nDetails: ${j.details || "None"}`;
    const error = new Error(j.message || "Failed to invite user");
    (error as any).debugInfo = debugInfo;
    throw error;
  }
  return j;
}

export async function acceptHouseholdInvite(inviteId: string) {
  const res = await fetch(`/api/pantry/household/invites/${inviteId}/accept`, {
    method: "POST",
    credentials: "include",
  });
  const j = await readJson(res);
  if (!res.ok) throw new Error(j.message || "Failed to accept invite");
  return j;
}

export async function declineHouseholdInvite(inviteId: string) {
  const res = await fetch(`/api/pantry/household/invites/${inviteId}/decline`, {
    method: "POST",
    credentials: "include",
  });
  const j = await readJson(res);
  if (!res.ok) throw new Error(j.message || "Failed to decline invite");
  return j;
}

export async function removeHouseholdMember(userId: string) {
  const res = await fetch(`/api/pantry/household/members/${userId}`, {
    method: "DELETE",
    credentials: "include",
  });
  const j = await readJson(res);
  if (!res.ok) throw new Error(j.message || "Failed to remove member");
  return j;
}
