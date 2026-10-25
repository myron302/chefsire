import test from "node:test";
import assert from "node:assert/strict";
import { requestWeddingSubscription, WeddingSubscriptionError } from "./weddingSubscription";

test("Wedding plan requests route trials separately from paid changes", async (t) => {
  const requests: any[] = [];
  t.mock.method(globalThis, "fetch", async (url: any, init: any) => {
    requests.push({ url, init });
    return new Response(JSON.stringify({ ok: true, currentTier: "premium", status: "active", onboardingCompleted: true, trial: { expiresAt: "2026-11-08T16:00:00Z", remainingDays: 14 } }));
  });
  for (const tier of [undefined, "free", "premium", "elite"] as const) await requestWeddingSubscription(tier);
  assert.deepEqual(requests.map(({ url }) => url), ["/api/wedding/subscription", "/api/wedding/subscription/change", "/api/wedding/subscription/trial", "/api/wedding/subscription/trial"]);
  for (const { init } of requests) assert.equal(init.credentials, "include");
  assert.deepEqual(JSON.parse(requests[2].init.body), { tier: "premium" });
  assert.deepEqual(JSON.parse(requests[3].init.body), { tier: "elite" });
  assert.equal((await requestWeddingSubscription()).trial?.remainingDays, 14);
});

test("trial failures expose helpful conflict and database errors", async (t) => {
  for (const [status, code, error] of [[409, "WEDDING_TRIAL_USED", "Already used"], [503, undefined, "Please try again"]] as const) {
    t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ ok: false, code, error }), { status }));
    await assert.rejects(requestWeddingSubscription("elite"), (value: any) => value instanceof WeddingSubscriptionError && value.message === error && value.code === code);
  }
});
