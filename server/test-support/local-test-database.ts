/**
 * Fail-closed validation for destructive integration tests (they DROP/TRUNCATE tables).
 *
 * The URL is parsed structurally with `new URL`; trust is decided ONLY from the parsed pieces, never by searching
 * the raw string. The returned config is what the test must connect with (explicit host/port/user/password/database),
 * so `pg` never re-parses the original string (pg-connection-string honours `?host=` etc., which would let a
 * validated authority and the actual connection target diverge).
 *
 * Requirements (all must hold):
 *  - scheme is postgres: or postgresql:
 *  - parsed hostname is exactly one of: localhost, 127.0.0.1, [::1]  (no Unix sockets, no LAN, no 0.0.0.0, no DNS names)
 *  - no query string at all (host/hostaddr/service/sslmode/... overrides are refused outright)
 *  - no URL fragment
 *  - database name is non-empty and contains "test" (e.g. chefsire_test): defense in depth against pointing the
 *    suite at a real local database
 */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export type LocalTestDbConfig = { host: string; port: number; user?: string; password?: string; database: string };

export function parseLocalTestDatabaseUrl(raw: string | undefined): LocalTestDbConfig {
  if (!raw) throw new Error("refusing test database: no URL");
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("refusing test database: URL is not parseable");
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") throw new Error("refusing test database: scheme must be postgres(ql)://");
  if (!LOOPBACK_HOSTS.has(u.hostname)) throw new Error(`refusing test database: host "${u.hostname}" is not an allowed loopback host`);
  if (u.search) throw new Error("refusing test database: query parameters are not allowed");
  if (u.hash) throw new Error("refusing test database: fragment is not allowed");
  let database: string;
  let user: string;
  let password: string;
  try {
    database = decodeURIComponent(u.pathname.replace(/^\//, ""));
    user = decodeURIComponent(u.username);
    password = decodeURIComponent(u.password);
  } catch {
    throw new Error("refusing test database: URL is not decodable");
  }
  if (!database || database.includes("/") || !/test/i.test(database)) {
    throw new Error("refusing test database: database name must be a single segment containing \"test\"");
  }
  const port = u.port ? Number(u.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("refusing test database: bad port");
  return {
    host: u.hostname === "[::1]" ? "::1" : u.hostname,
    port,
    ...(user ? { user } : {}),
    ...(password ? { password } : {}),
    database,
  };
}
