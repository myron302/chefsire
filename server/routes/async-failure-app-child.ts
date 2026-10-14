/**
 * Child process for async-failure-http.test.ts: the REAL server/app.ts with the same process policy as server/index.ts
 * (log + exit(1) on unhandledRejection), a database double that fails with a driver-style secret, and a scripted list of requests.
 * Emits JSON lines. It lives in its own process so a crash (the point of the "before" evidence) cannot take the test runner with it.
 * argv[2] = JSON array of { method, path, body?, auth? }
 */
import "../test-support/accept-test-sessions";
import { testAuthHeader } from "../test-support/auth-test-env";
import http from "node:http";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://app:secret@127.0.0.1:9/chefsire_unreachable_test";

const SECRET = 'connect ECONNREFUSED ep-private-host.neon.tech:5432 role "neondb_owner" password authentication failed';
const emit = (o: unknown) => console.log("@@" + JSON.stringify(o));

process.on("unhandledRejection", (e) => {
  emit({ event: "unhandledRejection", message: (e as Error)?.message });
  process.exit(1); // server/index.ts policy
});

async function main() {
const { db } = await import("../db");
const { default: app } = await import("../app");
const fail = () => { throw new Error(SECRET); };
const chain: any = new Proxy(function () {}, {
  get: (_t, p) => (p === "then" ? (_res: any, rej: any) => rej(new Error(SECRET)) : () => chain),
  apply: () => chain,
});
(db as any).execute = async () => fail();
(db as any).select = () => chain;
(db as any).insert = () => chain;
(db as any).update = () => chain;
(db as any).delete = () => chain;

const requests: Array<{ method: string; path: string; body?: unknown; auth?: boolean }> = JSON.parse(process.argv[2]);
const server = http.createServer(app).listen(0, "127.0.0.1", async () => {
  const port = (server.address() as any).port;
  for (const r of requests) {
    const headers: Record<string, string> = { ...(r.auth ? testAuthHeader("user-1") : {}) };
    if (r.body !== undefined) headers["content-type"] = "application/json";
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 1500);
    try {
      const res = await fetch(`http://127.0.0.1:${port}${r.path}`, { method: r.method, headers, body: r.body === undefined ? undefined : JSON.stringify(r.body), signal: ctl.signal });
      emit({ event: "response", method: r.method, path: r.path, status: res.status, body: await res.text() });
    } catch (e) {
      emit({ event: "no-response", method: r.method, path: r.path, error: (e as Error).name });
    } finally {
      clearTimeout(timer);
    }
    await new Promise((x) => setTimeout(x, 100));
  }
  emit({ event: "done" });
  process.exit(0);
});
}

main().catch((e) => { console.error(e); process.exit(2); });
