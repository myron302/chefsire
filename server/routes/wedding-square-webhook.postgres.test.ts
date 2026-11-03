import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import pg from "pg";
import { createWeddingSquareWebhookIntake, createWeddingSquareWebhookRouter } from "./wedding-square-webhook";

const databaseUrl = process.env.WEDDING_SQUARE_TEST_DATABASE_URL;
test("PostgreSQL: signed webhook intake persists once, rejects invalid signatures and retries DB failures", {
  skip: !databaseUrl ? "Requires disposable PostgreSQL" : undefined,
}, async () => {
  if (!databaseUrl) throw Error("Missing disposable database");
  const parsed = new URL(databaseUrl);
  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) || !/test/i.test(parsed.pathname))
    throw Error("Remote or non-test DB prohibited");
  const notificationUrl = "https://chefsire.com/api/wedding/subscription/webhooks/square";
  const key = "offline-disposable-webhook-test-signature-key";
  const vars = { SQUARE_ENV: "sandbox", SQUARE_LIVE_PAYMENTS_ENABLED: "false",
    WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true", WEDDING_SQUARE_SANDBOX_WEBHOOK_ENABLED: "true",
    WEDDING_SQUARE_SANDBOX_MERCHANT_ID: "merchant-test", WEDDING_SQUARE_WEBHOOK_SIGNATURE_KEY: key,
    WEDDING_SQUARE_WEBHOOK_NOTIFICATION_URL: notificationUrl };
  const old = { ...process.env }; Object.assign(process.env, vars);
  const db = new pg.Client({ connectionString: databaseUrl });
  const schema = "wedding_hook_test_" + randomUUID().replaceAll("-", "");
  let server: ReturnType<typeof express.application.listen> | undefined;
  let connected = false;
  try {
    await db.connect(); connected = true;
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.query(`SET search_path TO "${schema}"`);
    await db.query("CREATE TABLE users(id varchar PRIMARY KEY)");
    for (const file of ["20261101_02_wedding_square_billing_foundation.sql", "20261102_03_wedding_square_webhook_object_correlation.sql"])
      await db.query(readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"));
    const app = express();
    app.use(express.json({ verify(req, _res, bytes) { (req as any).rawBody = bytes.toString("utf8"); } }));
    app.use("/api/wedding", createWeddingSquareWebhookRouter(createWeddingSquareWebhookIntake(db)));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server!.once("listening", resolve));
    const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/wedding/subscription/webhooks/square`;
    for (const family of ["subscription", "invoice", "payment", "refund", "dispute"]) {
      const type = family === "dispute" ? "dispute.state.updated" : family + ".updated";
      const body = JSON.stringify({ event_id: "event-" + family, merchant_id: "merchant-test", type,
        data: { type: family, id: "object-" + family, object: { private: "must-not-persist" } } });
      const signature = createHmac("sha256", key).update(notificationUrl + body).digest("base64");
      const send = (sig: string) => fetch(endpoint, { method: "POST", body,
        headers: { "Content-Type": "application/json", "x-square-hmacsha256-signature": sig } });
      assert.equal((await send("invalid-signature")).status, 401);
      assert.equal((await send(signature)).status, 202);
      assert.equal((await send(signature)).status, 202);
    }
    const rows = (await db.query("SELECT event_id,event_type,square_object_id,processing_status FROM wedding_square_webhook_events ORDER BY event_id")).rows;
    assert.equal(rows.length, 5);
    assert.ok(rows.every(row => row.processing_status === "pending" && row.square_object_id.startsWith("object-")));
    assert.equal((await db.query("SELECT count(*)::int AS n FROM wedding_square_subscriptions")).rows[0].n, 0);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM wedding_square_invoice_evidence")).rows[0].n, 0);
    await db.query("ALTER TABLE wedding_square_webhook_events RENAME TO unavailable_webhook_events");
    const body = JSON.stringify({ event_id: "db-outage", merchant_id: "merchant-test", type: "payment.updated" });
    const signature = createHmac("sha256", key).update(notificationUrl + body).digest("base64");
    const outage = await fetch(endpoint, { method: "POST", body,
      headers: { "Content-Type": "application/json", "x-square-hmacsha256-signature": signature } });
    assert.equal(outage.status, 503); assert.equal(outage.headers.get("retry-after"), "5");
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close(e => e ? reject(e) : resolve()));
    if (connected) { await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await db.end(); }
    for (const k of Object.keys(vars)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; }
  }
});
