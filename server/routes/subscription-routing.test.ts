import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import squareRouter from "./square";
import { MARKETPLACE_PAID_TIER_IDS } from "../../shared/subscription-tiers";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const routeIndex = read("./index.ts");
const appSource = read("../app.ts");
const dashboard = read("../../client/src/pages/store/StoreDashboard.tsx");

function subscriptionRouteStack(): Array<{ handle: Function }> {
  const layer = (squareRouter as any).stack.find((candidate: any) =>
    candidate.route?.path === "/subscription-link" && candidate.route?.methods?.post,
  );
  assert.ok(layer, "real Square router must expose POST /subscription-link");
  return layer.route.stack;
}

function responseRecorder() {
  const state: { status?: number; body?: any } = {};
  const response = {
    status(code: number) { state.status = code; return response; },
    json(body: any) { state.body = body; return response; },
  };
  return { state, response };
}

test("real Square router has exactly one mount and store routers remain mounted", () => {
  assert.match(routeIndex, /import storeRouter from "\.\/stores-crud"/);
  assert.match(routeIndex, /import squareRouter from "\.\/square"/);
  assert.equal((routeIndex.match(/r\.use\("\/square", squareRouter\)/g) || []).length, 1);
  assert.equal((routeIndex.match(/r\.use\("\/stores", storeRouter\)/g) || []).length, 1);
  assert.equal((routeIndex.match(/r\.use\("\/stores", storeDropsRouter\)/g) || []).length, 1);
  assert.doesNotMatch(routeIndex, /squareRouter from "\.\/stores"/);
});

test("StoreDashboard URL composes through /api and /square to the real handler", () => {
  assert.match(appSource, /app\.use\("\/api", routes\)/);
  assert.match(dashboard, /fetch\("\/api\/square\/subscription-link"/);
  assert.equal(subscriptionRouteStack().length, 2, "route must contain requireAuth then handler");
});

test("unauthenticated subscription checkout is rejected before validation", async () => {
  const [auth] = subscriptionRouteStack();
  const { state, response } = responseRecorder();
  let nextCalled = false;
  await auth.handle({ headers: {}, cookies: {} }, response, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(state.status, 401);
  assert.equal(state.body?.code, "NO_TOKEN");
});

test("mounted handler returns validation errors and 503 for every legitimate plan", async () => {
  const [, handler] = subscriptionRouteStack();
  for (const body of [{}, { tier: "unknown" }, { tier: "starter", userId: "attacker" }]) {
    const { state, response } = responseRecorder();
    await handler.handle({ body, user: { id: "authenticated-user" } }, response);
    assert.equal(state.status, 400);
    assert.equal(state.body?.code, "INVALID_SUBSCRIPTION_CHECKOUT");
  }
  for (const tier of MARKETPLACE_PAID_TIER_IDS) {
    const { state, response } = responseRecorder();
    await handler.handle({ body: { tier, trial: false }, user: { id: "authenticated-user" } }, response);
    assert.equal(state.status, 503);
    assert.equal(state.body?.code, "SUBSCRIPTION_BILLING_UNAVAILABLE");
    assert.equal(state.body?.url, undefined);
  }
});
