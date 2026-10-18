/**
 * Per-flow Google OAuth correlation (Stability Phase 2C).
 *
 * Every initiation mints its own random flow id. The id travels through Google as the OAuth `state` parameter (Google echoes it verbatim), and the
 * flow's data (post-login destination + the browser-created client nonce) lives in a cookie NAMED for that id, so concurrent sign-ins from several
 * tabs of one browser never share, overwrite or clear each other's state. The callback reads and clears only the cookie named by its own `state`.
 *
 * The cookie value is `<base64url(json)>.<HMAC>` where the MAC covers the flow id too, so a payload cannot be edited or moved to another flow id.
 * Flows expire after 10 minutes (cookie Max-Age and an embedded timestamp), are single use (cleared on callback), and at most MAX_FLOWS are kept.
 * `state` alone proves nothing: with no valid cookie for it the callback just behaves like a plain Google sign-in (no destination, no nonce echo).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getJwtSecret } from "./jwt-config";

export const OAUTH_FLOW_COOKIE_PREFIX = "oauth_flow_";
export const OAUTH_FLOW_TTL_MS = 10 * 60 * 1000;
export const OAUTH_FLOW_MAX = 8;
const FLOW_ID_SHAPE = /^[A-Za-z0-9_-]{16,64}$/;

export type OAuthFlowData = { destination: string | null; clientState: string | null };

const mac = (flowId: string, body: string) =>
  createHmac("sha256", getJwtSecret()).update(`chefsire-oauth-flow\0${flowId}\0${body}`).digest("base64url");

export const isFlowId = (v: unknown): v is string => typeof v === "string" && FLOW_ID_SHAPE.test(v);
export const flowCookieName = (flowId: string) => `${OAUTH_FLOW_COOKIE_PREFIX}${flowId}`;

export function sealFlow(flowId: string, data: OAuthFlowData, nowMs: number = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ d: data.destination, c: data.clientState, t: nowMs })).toString("base64url");
  return `${body}.${mac(flowId, body)}`;
}

/** The flow's data, or null when the cookie is missing, tampered with, minted for another flow id, expired or from the future. */
export function openFlow(flowId: string, sealed: unknown, nowMs: number = Date.now()): OAuthFlowData | null {
  if (!isFlowId(flowId) || typeof sealed !== "string") return null;
  const dot = sealed.indexOf(".");
  if (dot < 1) return null;
  const body = sealed.slice(0, dot);
  const given = Buffer.from(sealed.slice(dot + 1));
  const expected = Buffer.from(mac(flowId, body));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof parsed.t !== "number" || nowMs - parsed.t < 0 || nowMs - parsed.t > OAUTH_FLOW_TTL_MS) return null;
    return {
      destination: typeof parsed.d === "string" ? parsed.d : null,
      clientState: typeof parsed.c === "string" && FLOW_ID_SHAPE.test(parsed.c) ? parsed.c : null,
    };
  } catch {
    return null;
  }
}

/** Names of flow cookies that are expired/invalid, plus the oldest valid ones beyond the cap (leaving room for the flow about to be added). */
export function flowCookiesToEvict(cookies: Record<string, unknown> | undefined, nowMs: number = Date.now()): string[] {
  const evict: string[] = [];
  const live: Array<{ name: string; t: number }> = [];
  for (const [name, value] of Object.entries(cookies ?? {})) {
    if (!name.startsWith(OAUTH_FLOW_COOKIE_PREFIX)) continue;
    const id = name.slice(OAUTH_FLOW_COOKIE_PREFIX.length);
    if (!openFlow(id, value, nowMs)) { evict.push(name); continue; }
    const body = String(value).split(".")[0];
    live.push({ name, t: JSON.parse(Buffer.from(body, "base64url").toString("utf8")).t });
  }
  live.sort((a, b) => b.t - a.t).slice(OAUTH_FLOW_MAX - 1).forEach((x) => evict.push(x.name));
  return evict;
}

/**
 * Server-authoritative single use with FIXED memory and no capacity cliffs for anyone to hit.
 *
 * Every flow id is minted by the server and encodes where its single-use bit lives: `[boot id | minute | index | random]`. Bits live in per-minute
 * bitmaps (BUCKET_BITS each, allocated lazily, freed once the minute is older than the flow TTL). Consequences:
 *  - A flow is CONSUMED by the atomic test-and-set in `claimFlow`, whatever the outcome (success, Google rejection, outage, client disconnect). There is no
 *    release path, so ownership cannot be handed to a second callback by a disconnect, and no separate "failed" / "succeeded" tables whose capacity could
 *    decide whether a flow is replayable.
 *  - Nothing is ever evicted early and no entry is a "record" an attacker can multiply: the only way to take bits is to initiate flows, which per-IP
 *    limiters bound and which costs ~1 bit. Exhausting a minute's bucket needs over BUCKET_BITS initiations in that single minute (> 17,000 requests per
 *    second to this process) and only affects flow creation for the remainder of that minute (503, retry); verification of existing flows never depends on it.
 *  - Memory is at most (TTL + 2 minutes) x BUCKET_BITS / 8 bytes (about 1.5 MB), regardless of traffic.
 * The boot id makes a flow minted by a previous process, or by another instance, unverifiable here, so it is refused rather than guessed at (see docs for
 * the single-process assumption of the Plesk/Passenger deployment).
 */
export const BUCKET_BITS = 1 << 20;
const BUCKET_MS = 60_000;
const BUCKET_KEEP = Math.ceil(OAUTH_FLOW_TTL_MS / BUCKET_MS) + 2;
const ID_BYTES = 6 + 4 + 4 + 18;

type Bucket = { issued: number; claimed: Uint8Array };
let bootId = randomBytes(6);
const buckets = new Map<number, Bucket>();

export class FlowCapacityError extends Error {
  constructor() { super("OAuth flow capacity for this minute is exhausted"); this.name = "FlowCapacityError"; }
}

function dropOldBuckets(nowMinute: number): void {
  buckets.forEach((_b, minute) => { if (nowMinute - minute > BUCKET_KEEP) buckets.delete(minute); });
}

/** Mint a flow id and reserve its single-use bit. Throws FlowCapacityError only if this minute already issued BUCKET_BITS flows. */
export function newFlowId(nowMs: number = Date.now()): string {
  const minute = Math.floor(nowMs / BUCKET_MS);
  dropOldBuckets(minute);
  let bucket = buckets.get(minute);
  if (!bucket) { bucket = { issued: 0, claimed: new Uint8Array(BUCKET_BITS / 8) }; buckets.set(minute, bucket); }
  if (bucket.issued >= BUCKET_BITS) throw new FlowCapacityError();
  const index = bucket.issued++;
  const id = Buffer.alloc(ID_BYTES);
  bootId.copy(id, 0);
  id.writeUInt32BE(minute >>> 0, 6);
  id.writeUInt32BE(index, 10);
  randomBytes(18).copy(id, 14);
  return id.toString("base64url");
}

export type FlowClaim = "claimed" | "spent" | "unknown";

/**
 * Atomically consume the flow (synchronous test-and-set). "claimed": this caller now exclusively owns the flow, permanently; "spent": already consumed;
 * "unknown": not a flow this process issued within the TTL (foreign boot id, expired, or never issued).
 */
export function claimFlow(flowId: string, nowMs: number = Date.now()): FlowClaim {
  const raw = Buffer.from(flowId, "base64url");
  if (raw.length !== ID_BYTES || raw.toString("base64url") !== flowId) return "unknown";
  if (!raw.subarray(0, 6).equals(bootId)) return "unknown";
  const nowMinute = Math.floor(nowMs / BUCKET_MS);
  const minute = raw.readUInt32BE(6);
  const index = raw.readUInt32BE(10);
  if (nowMinute - minute > BUCKET_KEEP || minute - nowMinute > 1) return "unknown";
  const bucket = buckets.get(minute);
  if (!bucket || index >= bucket.issued) return "unknown";
  const byte = index >> 3, bit = 1 << (index & 7);
  if (bucket.claimed[byte] & bit) return "spent";
  bucket.claimed[byte] |= bit;
  return "claimed";
}

export function flowStateStats(): { buckets: number; bytes: number; issuedLive: number } {
  let issuedLive = 0;
  buckets.forEach((b) => { issuedLive += b.issued; });
  return { buckets: buckets.size, bytes: buckets.size * (BUCKET_BITS / 8), issuedLive };
}

export function resetFlowStateForTests(): void {
  buckets.clear();
  bootId = randomBytes(6);
}

/** Upper bound on how long one callback may spend verifying with Google before it is abandoned (its flow stays consumed). */
export let OAUTH_VERIFY_TIMEOUT_MS = 30_000;
export function setOAuthVerifyTimeoutForTests(ms: number): void { OAUTH_VERIFY_TIMEOUT_MS = ms; }
