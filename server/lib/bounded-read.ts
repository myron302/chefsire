/**
 * Run a READ-ONLY query so that it can never hold a pool connection forever (Stability Phase 2C, Codex P1-2).
 *
 * How node-postgres / @neondatabase/serverless behave: `pool.query` checks a client out and returns it only when the query finishes. A client
 * has no per-query cancel. Giving up on the promise (what `withReadTimeout` does) leaves the query running and the client checked out, so with a
 * 5-client pool five stalled lookups pin the pool and every later request fails on connection timeout -- even after the stall is over for new
 * connections. Two independent stalls exist and each needs its own remedy:
 *   - SERVER-side (lock wait, slow plan): `SET LOCAL statement_timeout` inside a READ ONLY transaction makes Postgres itself cancel the statement,
 *     so the backend is freed and the query fails definitively.
 *   - NETWORK-side (replies never arrive): no server setting helps; the client gives up and DESTROYS the connection (`release(true)` removes it from
 *     the pool and ends its socket), so its slot is free for a fresh connection immediately.
 * Scope: ONLY for reads whose abandonment has no side effect (session lookup). A write, a payment or a COMMIT must never go through here:
 * for them "timed out" cannot be told apart from "happened".
 */
import { DatabaseTimeoutError } from "./db-availability";

type ClientLike = {
  query: (...args: any[]) => Promise<any>;
  release: (destroy?: boolean | Error) => void;
  on?: (event: "error", listener: (error: unknown) => void) => unknown;
  removeListener?: (event: "error", listener: (error: unknown) => void) => unknown;
};
type PoolLike = { connect: () => Promise<ClientLike> };

export async function runBoundedRead<T>(
  pool: PoolLike,
  work: (client: ClientLike) => Promise<T>,
  options: { timeoutMs: number; label: string },
): Promise<T> {
  const { timeoutMs, label } = options;
  const serverTimeoutMs = Math.max(250, timeoutMs - 250); // the server cancels just before the client gives up
  let abandoned = false;
  let timer: NodeJS.Timeout | undefined;
  let client: ClientLike | undefined;
  let released = false;
  // A pool only listens for "error" on IDLE clients. A checked-out client whose connection dies (network cut, our own destroy) emits "error"; with no
  // listener Node treats that as an uncaught exception and server/index.ts exits. The failure itself reaches us through the query promise.
  const swallowClientError = () => undefined;
  const release = (destroy: boolean) => {
    if (!client || released) return;
    released = true;
    // A destroyed client may still emit while its socket closes, so its listener stays; a healthy one is handed back clean.
    if (!destroy) client.removeListener?.("error", swallowClientError);
    try { client.release(destroy); } catch { /* the pool already dropped it */ }
  };

  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { abandoned = true; reject(new DatabaseTimeoutError(label, timeoutMs)); }, timeoutMs);
  });

  const attempt = (async () => {
    client = await pool.connect(); // itself bounded by the pool's connectionTimeoutMillis
    client.on?.("error", swallowClientError);
    if (abandoned) { release(false); throw new DatabaseTimeoutError(label, timeoutMs); }
    // One round trip: open a read-only transaction and arm the server-side cancel for it.
    await client.query(`BEGIN READ ONLY; SET LOCAL statement_timeout = ${serverTimeoutMs}`);
    return work(client);
  })();
  attempt.catch(() => undefined); // an abandoned attempt's late failure must never become an unhandled rejection

  try {
    const result = await Promise.race([attempt, expired]);
    // Healthy path: finish the transaction OFF the request's critical path, then hand the connection back (or destroy it if that fails).
    const finishing = client!;
    finishing.query("COMMIT").then(() => release(false), () => release(true));
    return result;
  } catch (error) {
    // Timed out, cancelled by the server, or failed: the connection's state is unknown or mid-transaction -- never return it to the pool.
    release(true);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
