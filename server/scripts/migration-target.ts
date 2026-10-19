import { createHash } from "node:crypto";

/**
 * Verifiable identity of the PostgreSQL target a destructive migration will run on.
 *
 * A database NAME is not an identity: two servers (or two Neon branches) can share it. The identity is built from
 * values the server itself reports plus the network route the client is actually using:
 *   - systemIdentifier  pg_control_system().system_identifier  (per-cluster id written at initdb; needs a role that
 *                       may call pg_control_system — if it cannot be read, verification FAILS, never skipped)
 *   - databaseOid       pg_database.oid of the current database
 *   - neonEndpointId / neonTimelineId  neon.endpoint_id / neon.timeline_id as reported by a Neon compute
 *   - host, port        from the connection string (pooler suffix removed), i.e. where the client really connected
 * The authorization pins the SHA-256 of all of these. Limits (see docs): a branch created from another may share
 * systemIdentifier and databaseOid, so branch separation relies on the endpoint/timeline ids and host; a Neon host
 * that does not report them is refused outright rather than guessed at.
 */
export type TargetIdentity = {
  databaseName: string;
  databaseOid: string;
  systemIdentifier: string;
  host: string;
  port: string;
  neonEndpointId: string | null;
  neonTimelineId: string | null;
};

export class TargetVerificationError extends Error {
  constructor(message: string) {
    super(`Cannot verify the migration target: ${message}. Destructive execution is refused; nothing was executed.`);
    this.name = "TargetVerificationError";
  }
}

type Queryable = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };

export function connectionRoute(connectionString: string): { host: string; port: string } {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new TargetVerificationError("DATABASE_URL is not a parseable URL");
  }
  let host = url.searchParams.get("host") || url.hostname;
  if (!host) throw new TargetVerificationError("the connection string names no host");
  host = host.toLowerCase();
  if (host.endsWith(".neon.tech")) host = host.replace(/-pooler(?=\.)/, "");
  return { host, port: url.searchParams.get("port") || url.port || "5432" };
}

export async function describeTarget(client: Queryable, connectionString: string): Promise<TargetIdentity> {
  const route = connectionRoute(connectionString);
  const base = (
    await client.query(
      `select current_database() as name,
              (select oid::text from pg_database where datname = current_database()) as oid`
    )
  ).rows[0];
  let systemIdentifier: string | undefined;
  try {
    systemIdentifier = (await client.query(`select system_identifier::text as id from pg_control_system()`)).rows[0]?.id;
  } catch (error) {
    throw new TargetVerificationError(
      `pg_control_system() is not readable by this role (${error instanceof Error ? error.message : String(error)})`
    );
  }
  if (!base?.name || !base?.oid || !systemIdentifier) throw new TargetVerificationError("the server did not report its identity");
  const neon = (
    await client.query(
      `select nullif(current_setting('neon.endpoint_id', true), '') as endpoint,
              nullif(current_setting('neon.timeline_id', true), '') as timeline`
    )
  ).rows[0];
  const identity: TargetIdentity = {
    databaseName: base.name,
    databaseOid: base.oid,
    systemIdentifier,
    ...route,
    neonEndpointId: neon?.endpoint ?? null,
    neonTimelineId: neon?.timeline ?? null,
  };
  if (route.host.endsWith(".neon.tech") && !identity.neonEndpointId && !identity.neonTimelineId) {
    throw new TargetVerificationError("a Neon host was used but the compute reports neither neon.endpoint_id nor neon.timeline_id");
  }
  return identity;
}

/** Deterministic fingerprint over every identity component. */
export function targetFingerprint(identity: TargetIdentity): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        identity.databaseName, identity.databaseOid, identity.systemIdentifier, identity.host, identity.port,
        identity.neonEndpointId, identity.neonTimelineId,
      ])
    )
    .digest("hex");
}
