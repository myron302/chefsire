/**
 * Database timeout configuration (Stability Phase 2C).
 *
 * Pure and side-effect free: `server/db/index.ts` applies the result, tests exercise it directly. An invalid value never disables a
 * protection and never stops the site from booting (a Plesk typo must not take ChefSire down): it is reported as a warning and the safe
 * default is used instead. Nothing here ever reads or prints DATABASE_URL.
 *
 *   DB_CONNECT_TIMEOUT_MS    Time to obtain a database connection: the TCP/WebSocket + Postgres handshake for a new connection AND the wait for
 *                            a free pooled one (node-postgres `connectionTimeoutMillis`). Default 15000 -- long enough for a Neon compute to wake
 *                            from suspend (a few seconds), far short of the proxy's 60s. Range 1000..120000.
 *   DB_STATEMENT_TIMEOUT_MS  OPT-IN server-side `statement_timeout` applied to each new connection. Default 0 (off). Unlike a client-side query
 *                            timeout, the SERVER cancels the statement, so it fails definitively and its transaction aborts atomically. Range 1000..600000.
 *   AUTH_LOOKUP_TIMEOUT_MS   Bound on the read-only session lookup in authentication (the one query every authenticated request waits on).
 *                            Default 8000. Range 1000..60000. Abandoning a read-only SELECT has no side effects.
 *
 * There is deliberately NO global client-side query timeout: abandoning a write mid-flight cannot tell "did not happen" from "happened,
 * reply lost" (see docs/stability-phase-2c-database-auth-resilience.md).
 */
export type DbSettings = {
  connectionTimeoutMillis: number;
  /** 0 = disabled. */
  statementTimeoutMs: number;
  authLookupTimeoutMs: number;
  warnings: string[];
};

type Spec = { name: string; fallback: number; min: number; max: number; allowZero?: boolean };

const SPECS = {
  connect: { name: "DB_CONNECT_TIMEOUT_MS", fallback: 15_000, min: 1_000, max: 120_000 },
  statement: { name: "DB_STATEMENT_TIMEOUT_MS", fallback: 0, min: 1_000, max: 600_000, allowZero: true },
  auth: { name: "AUTH_LOOKUP_TIMEOUT_MS", fallback: 8_000, min: 1_000, max: 60_000 },
} satisfies Record<string, Spec>;

function read(env: NodeJS.ProcessEnv, spec: Spec, warnings: string[]): number {
  const raw = env[spec.name]?.trim();
  if (raw === undefined || raw === "") return spec.fallback;
  const n = Number(raw);
  const ok = /^\d+$/.test(raw) && Number.isSafeInteger(n) && ((spec.allowZero && n === 0) || (n >= spec.min && n <= spec.max));
  if (!ok) {
    warnings.push(`${spec.name} must be an integer ${spec.allowZero ? "0 (off) or " : ""}${spec.min}..${spec.max} (milliseconds); using ${spec.fallback}`);
    return spec.fallback;
  }
  return n;
}

export function resolveDbSettings(env: NodeJS.ProcessEnv = process.env): DbSettings {
  const warnings: string[] = [];
  return {
    connectionTimeoutMillis: read(env, SPECS.connect, warnings),
    statementTimeoutMs: read(env, SPECS.statement, warnings),
    authLookupTimeoutMs: read(env, SPECS.auth, warnings),
    warnings,
  };
}
