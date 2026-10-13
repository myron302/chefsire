/**
 * Child process for the Phase 2B regression tests. Mirrors server/index.ts's process policy (exit(1) on unhandledRejection), serves
 * an async-failing route, and reports what happened on stdout as JSON lines. Run in its OWN process so a crash cannot kill the test runner.
 * argv[2] = "patched" | "unpatched"
 */
import http from "node:http";
import express from "express";

async function main() {
if (process.argv[2] === "patched") await import("./async-error-forwarding.install");

process.on("unhandledRejection", (e) => {
  console.log(JSON.stringify({ event: "unhandledRejection", message: (e as Error)?.message }));
  process.exit(1); // the exact policy in server/index.ts
});

const app = express();
let handled = 0;
app.get("/boom", async () => { await Promise.resolve(); throw new Error("async boom"); });
app.get("/ok", (_req, res) => { res.json({ ok: true }); });
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  handled++;
  console.log(JSON.stringify({ event: "errorHandler", message: err.message, headersSent: res.headersSent }));
  res.status(500).json({ error: "Internal Server Error" });
});
const server = app.listen(0, "127.0.0.1", async () => {
  const port = (server.address() as any).port;
  const get = (path: string) => new Promise<{ status: number } | { error: string }>((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path, timeout: 1500 }, (r) => { r.resume(); r.on("end", () => resolve({ status: r.statusCode! })); });
    req.on("timeout", () => { req.destroy(); resolve({ error: "timeout" }); });
    req.on("error", (e) => resolve({ error: (e as Error).message }));
  });
  console.log(JSON.stringify({ event: "boom", result: await get("/boom") }));
  await new Promise((r) => setTimeout(r, 200));
  console.log(JSON.stringify({ event: "ok-after", result: await get("/ok"), handled }));
  process.exit(0);
});
}

main().catch((e) => { console.error(e); process.exit(2); });
