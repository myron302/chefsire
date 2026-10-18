/**
 * Telling "the database cannot answer" from "the database answered no" (Stability Phase 2C).
 *
 * Authentication must fail closed in BOTH cases, but it must not say the same thing: a revoked session is a 401, an unreachable database is
 * a retryable 503 that leaves the user's login state alone. `isDatabaseUnavailableError` is deliberately a list of connectivity signatures,
 * not "any error": a constraint violation or a syntax error is an application fault and keeps its existing handling.
 */
import type { Response } from "express";

export class DatabaseTimeoutError extends Error {
  readonly code = "DB_TIMEOUT";
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "DatabaseTimeoutError";
  }
}

const NODE_NETWORK_CODES = new Set([
  "ECONNREFUSED", "ECONNRESET", "ECONNABORTED", "ETIMEDOUT", "EPIPE", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH", "ENETDOWN", "EHOSTDOWN",
]);
// 57P01 admin_shutdown, 57P02 crash_shutdown, 57P03 cannot_connect_now (startup/recovery), 53300 too_many_connections, 53400 configuration_limit_exceeded.
const PG_UNAVAILABLE_CODES = new Set(["57P01", "57P02", "57P03", "53300", "53400", "DB_TIMEOUT"]);
const DRIVER_MESSAGES = [
  /connection terminated/i,
  /timeout exceeded when trying to connect/i,
  /socket hang up/i,
  /client has encountered a connection error/i,
  /cannot use a pool after calling end/i,
  /connection (?:closed|ended|lost)/i,
  /database not configured/i,
  /websocket (?:was closed|connection)/i,
];

function candidates(error: unknown, seen = new Set<unknown>(), out: any[] = []): any[] {
  if (!error || typeof error !== "object" || seen.has(error)) return out;
  seen.add(error);
  out.push(error);
  const e = error as { cause?: unknown; errors?: unknown };
  candidates(e.cause, seen, out);
  if (Array.isArray(e.errors)) for (const inner of e.errors) candidates(inner, seen, out);
  return out;
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  for (const e of candidates(error)) {
    const code = typeof e.code === "string" ? e.code : "";
    if (NODE_NETWORK_CODES.has(code) || PG_UNAVAILABLE_CODES.has(code) || code.startsWith("08")) return true;
    if (e.status === 503 && /database/i.test(String(e.message ?? ""))) return true;
    const message = typeof e.message === "string" ? e.message : "";
    if (DRIVER_MESSAGES.some((re) => re.test(message))) return true;
  }
  return false;
}

/** Bound a READ-ONLY operation. The underlying promise is left to settle on its own (its rejection is swallowed so it cannot go unhandled). */
export function withReadTimeout<T>(operation: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DatabaseTimeoutError(label, ms)), ms);
  });
  operation.catch(() => undefined);
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

/** Server-log description of a database failure: code and a message with any connection string removed. Never the URL, never the SQL text. */
export function describeDatabaseError(error: unknown): string {
  const e = (error ?? {}) as { name?: string; code?: unknown; message?: unknown };
  const message = String(e.message ?? error ?? "").replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-url]").replace(/\s+/g, " ").slice(0, 160);
  return `${e.name ?? "Error"}${e.code ? ` code=${String(e.code)}` : ""}: ${message}`;
}

export const SERVICE_UNAVAILABLE_BODY = Object.freeze({
  error: "Service temporarily unavailable. Please try again in a moment.",
  code: "SERVICE_UNAVAILABLE",
  retryable: true,
});

/** The one retryable-outage response: fixed body, no detail, `Retry-After`, never cached. */
export function sendServiceUnavailable(res: Response, retryAfterSeconds = 5) {
  res.set("Retry-After", String(retryAfterSeconds));
  res.set("Cache-Control", "no-store");
  return res.status(503).json(SERVICE_UNAVAILABLE_BODY);
}
