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

export function newFlowId(): string {
  return randomBytes(24).toString("base64url");
}

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
