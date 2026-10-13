// server/lib/proxy-trust.ts
/**
 * ONE definition of "which peer is a trusted reverse proxy", shared by Express (`app.set("trust proxy", ...)`) and by code that only has a
 * raw `IncomingMessage` (the Socket.IO / engine.io layer, which Express never sees: `req.protocol`, `req.ip` and `trust proxy` do not exist
 * there).
 *
 * Why it exists: the browser-origin checks need to know the scheme a browser used to reach us. Behind a TLS-terminating proxy the socket is
 * plain HTTP, so the answer has to come from `X-Forwarded-Proto` -- but that header is only evidence when a proxy WE trust wrote it. From
 * anyone else it is a string the client typed. This module makes the trust decision explicit, configurable and identical in both layers.
 *
 * Configuration (env `TRUST_PROXY`). The default is what app.ts hard-coded before this module existed, so an unset variable changes nothing:
 *
 *   unset / blank     1                       the direct peer is one reverse-proxy hop. Correct when the listener is reachable only by the proxy:
 *                                              a Unix socket (Phusion Passenger, the Plesk Node.js extension) or 127.0.0.1.
 *   "false" / "0"     false                   trust nobody: forwarded headers are never evidence and client IPs are socket addresses.
 *   "2" .. "8"        that many hops          (Express hop counts trust the peer unconditionally, whatever its address)
 *   "loopback", "10.0.0.0/8", "203.0.113.7, loopback"
 *                                             trust only peers whose socket address is listed. NOTE: a Unix-socket peer has NO address, and an
 *                                             address list never trusts "no address", so this form is for a TCP upstream (nginx proxy_pass to
 *                                             127.0.0.1). With Passenger on a Unix socket it would silently discard every forwarded header
 *                                             and leave `req.ip` undefined.
 *
 * Refused, and the server refuses to START rather than guess: `true`/`all`/`*` (trust every hop: any client could choose its own address and
 * scheme), hop counts outside 1..8, and anything that is not a hop count, `false`, or a list of loopback/linklocal/uniquelocal keywords,
 * IP literals and CIDRs. The raw string is never handed to Express: it would read "1" as the IP address 0.0.0.1 (trust nothing, silently).
 */
import express from "express";
import { isIP } from "node:net";

export const DEFAULT_TRUST_PROXY = 1;
const MAX_TRUSTED_HOPS = 8;
const MAX_LIST_ENTRIES = 64;
const KEYWORDS = new Set(["loopback", "linklocal", "uniquelocal"]);

/** What `app.set("trust proxy", ...)` receives: a hop count, `false`, or an array of keywords / IP literals / CIDRs. Never a bare string. */
export type TrustProxySetting = number | false | string[];

export interface TrustProxyResolution {
  readonly setting: TrustProxySetting;
  readonly source: "default" | "env";
  /** A one-line, secret-free description for the startup log. */
  readonly description: string;
}

export class TrustProxyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrustProxyConfigError";
  }
}

function describe(setting: TrustProxySetting): string {
  if (setting === false) return "none (forwarded headers are never trusted)";
  if (typeof setting === "number") return `${setting} hop${setting === 1 ? "" : "s"} (the direct peer is the proxy)`;
  return `peers in [${setting.join(", ")}]`;
}

function normalizeEntry(entry: string): string | null {
  const lower = entry.toLowerCase();
  if (KEYWORDS.has(lower)) return lower;
  if (entry.includes("%")) return null; // node's isIP() accepts IPv6 zone ids ("fe80::1%eth0"); Express's matcher does not mean the same thing
  const parts = entry.split("/");
  if (parts.length > 2) return null;
  const family = isIP(parts[0]);
  if (family === 0) return null;
  if (parts.length === 1) return entry;
  if (!/^\d{1,3}$/.test(parts[1])) return null;
  const prefix = Number(parts[1]);
  // A very short prefix trusts a large part of the internet as 'a proxy': /8 and /16 are the floors.
  return prefix >= (family === 4 ? 8 : 16) && prefix <= (family === 4 ? 32 : 128) ? entry : null;
}

/** Parse `TRUST_PROXY`. Throws TrustProxyConfigError for anything that is not unambiguously one of the documented forms. */
export function resolveTrustProxy(env: NodeJS.ProcessEnv = process.env): TrustProxyResolution {
  const raw = env.TRUST_PROXY?.trim();
  if (!raw) return { setting: DEFAULT_TRUST_PROXY, source: "default", description: describe(DEFAULT_TRUST_PROXY) };

  const shown = JSON.stringify(raw.length > 80 ? `${raw.slice(0, 80)}...` : raw);
  const lower = raw.toLowerCase();
  if (["false", "off", "no", "none", "0"].includes(lower)) return { setting: false, source: "env", description: describe(false) };
  if (["true", "on", "yes", "all", "*"].includes(lower)) {
    throw new TrustProxyConfigError(`TRUST_PROXY=${shown} would trust every hop, so any client could choose its own address and scheme. Use a hop count (1..${MAX_TRUSTED_HOPS}), "false", or a list of proxy addresses.`);
  }
  if (/^\d+$/.test(raw)) {
    const hops = Number(raw);
    if (Number.isSafeInteger(hops) && hops >= 1 && hops <= MAX_TRUSTED_HOPS) return { setting: hops, source: "env", description: describe(hops) };
    throw new TrustProxyConfigError(`TRUST_PROXY=${shown} is outside 1..${MAX_TRUSTED_HOPS}.`);
  }

  // Comma-separated groups, each of which may hold whitespace-separated entries. An empty group ("a,,b", a leading or trailing comma) is an error.
  const groups = raw.split(",").map((group) => group.trim());
  const tokens = groups.some((group) => group === "") ? [""] : groups.flatMap((group) => group.split(/\s+/));
  const entries = tokens.map((token) => (token === "" ? null : normalizeEntry(token)));
  if (tokens.length <= MAX_LIST_ENTRIES && entries.every((entry): entry is string => entry !== null)) {
    return { setting: entries as string[], source: "env", description: describe(entries as string[]) };
  }
  throw new TrustProxyConfigError(
    `TRUST_PROXY=${shown} is not a hop count (1..${MAX_TRUSTED_HOPS}), "false", or a comma-separated list of loopback / linklocal / uniquelocal / IP addresses / CIDRs.`,
  );
}

type TrustFunction = (address: string | undefined, hop: number) => boolean;
const compiled = new Map<string, TrustFunction>();

/**
 * Express's own compiled trust function for a setting, obtained through Express's `trust proxy` setting instead of being reimplemented.
 * `trust proxy fn` is an internal key (stable across 4.x and 5.x); `proxy-trust.test.ts` pins the standalone function to a real app's so
 * an Express upgrade that renames it fails loudly there, and the typeof guard below makes it fail at first use instead of trusting silently.
 */
export function trustFunctionFor(setting: TrustProxySetting): TrustFunction {
  const key = JSON.stringify(setting);
  let fn = compiled.get(key);
  if (!fn) {
    const probe = express();
    probe.set("trust proxy", setting);
    const candidate = probe.get("trust proxy fn");
    if (typeof candidate !== "function") throw new Error("express no longer exposes a compiled 'trust proxy fn'; proxy-trust.ts must be updated");
    fn = candidate as TrustFunction;
    compiled.set(key, fn);
  }
  return fn;
}

const resolutions = new Map<string, TrustProxySetting | null>();

/**
 * Is the DIRECT peer of this connection (the socket's remote address -- never anything in a header) a trusted reverse proxy, under the same
 * rule Express applies to `req.protocol` and `req.ip`? An unusable `TRUST_PROXY` means "no": this runs per request and must not throw.
 */
export function isTrustedProxyPeer(remoteAddress: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  const key = env.TRUST_PROXY ?? "";
  let setting = resolutions.get(key);
  if (setting === undefined) {
    try {
      setting = resolveTrustProxy(env).setting;
    } catch {
      setting = null;
    }
    resolutions.set(key, setting);
  }
  return setting === null ? false : trustFunctionFor(setting)(remoteAddress, 0);
}
