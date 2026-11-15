/**
 * The plan buttons must not offer what the server will refuse.
 *
 * Every paid subscription path in ChefSire refuses today: there is no verified billing evidence, so
 * `hasAuthoritativePaidEntitlement()` is false and the upgrade/change endpoints answer 503. The
 * failure this suite exists to prevent is a UI that renders a live, priced "Upgrade" button against
 * that, which hands a member a red error on every click -- indistinguishable, to them, from the
 * product being broken.
 *
 * The invariant is a consistency one, so it stays true when billing is eventually enabled:
 *
 *   a tiers endpoint reports paidUpgradesAvailable: true  <=>  its paid change endpoint does not refuse
 *
 * Asserting the current `false` alone would pass for the wrong reason the day the flag flips without
 * the endpoints following, which is exactly the drift the single shared predicate is meant to stop.
 */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";
import { testAuthHeader } from "../test-support/auth-test-env";
import { SUBSCRIPTION_BILLING_NOT_CONFIGURED } from "../lib/subscription-security";

/** The client must gate its paid buttons on the server's flag, not on its own assumption. */
test("the paid plan buttons are gated on the server's availability flag", () => {
  const settings = readFileSync(new URL("../../client/src/pages/settings.tsx", import.meta.url), "utf8");

  for (const [module, flag] of [
    ["marketplace", "marketplacePaidUpgradesAvailable"],
    ["vendor", "vendorPaidUpgradesAvailable"],
    ["nutrition", "nutritionPaidUpgradesAvailable"],
  ] as const) {
    assert.match(settings, new RegExp(`const ${flag} =[^\\n]*paidUpgradesAvailable === true`),
      `${module} must read the flag from the server and fail closed on anything else`);
  }

  // Each paid tier button is disabled when its module's paid changes cannot succeed. Free is
  // deliberately not gated: a downgrade always works.
  assert.match(settings, /tierKey !== "free" && !marketplacePaidUpgradesAvailable/);
  assert.match(settings, /tierKey !== "free" && !vendorPaidUpgradesAvailable/);
  // Nutrition keeps a live button while the cardless trial is still available to the account,
  // because that path does work -- it just is not a purchase.
  assert.match(settings, /tierKey !== "free" && !nutritionTrialEligible && !nutritionPaidUpgradesAvailable/);
  assert.match(settings, /nutritionTrialEligible\)\s*\{\s*\n\s*subscriptionTrialMutation\.mutate/,
    "an eligible member is offered the trial that works, not the purchase that refuses");

  const tab = readFileSync(
    new URL("../../client/src/pages/store/components/StoreDashboardSubscriptionTab.tsx", import.meta.url),
    "utf8",
  );
  assert.match(tab, /disabled=\{currentTier === plan\.id \|\| !paidUpgradesAvailable\}/);
  assert.match(tab, /paidUpgradesAvailable = false/, "the store tab fails closed when not told");
  assert.match(tab, /currentTier !== plan\.id && paidUpgradesAvailable &&/,
    "the trial button is not offered while checkout cannot succeed");
});

/**
 * The store dashboard used to grant the tier locally before the member had paid: it set
 * `subscription` and a 30-day `trialEndDate` as soon as a checkout URL came back, so abandoning
 * Square's page left the client claiming a paid plan. Entitlement is the server's to grant.
 */
test("the store dashboard does not grant a plan locally before payment", () => {
  const dashboard = readFileSync(new URL("../../client/src/pages/store/StoreDashboard.tsx", import.meta.url), "utf8");
  // Checked against the whole file rather than a sliced function body, so the assertion cannot be
  // satisfied by the slice landing in the wrong place.
  assert.doesNotMatch(dashboard, /updateUser\(/,
    "the dashboard must not write local entitlement at all");
  assert.doesNotMatch(dashboard, /trialEndDate:/,
    "no local trial end date may be assigned; reading user?.trialEndDate for display is fine");
  assert.match(dashboard, /window\.location\.href = data\.url/, "the redirect itself is still intact");
});

/**
 * The audit GPT asked for after the store-dashboard fix: the client must never supply an entitlement
 * status the server did not state. Three Settings handlers used to fill in "active" when the
 * response omitted a status for a paid tier, which is the same assumption in a milder form.
 * Removing entitlement is always safe, so a downgrade to free may still be written locally.
 */
test("the client never invents an entitlement status the server did not state", () => {
  const settings = readFileSync(new URL("../../client/src/pages/settings.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(settings, /subscriptionStatus: "active"/,
    "the marketplace response carries no status, so writing one is the client's invention");
  for (const field of ["weddingStatus", "vendorStatus"]) {
    assert.doesNotMatch(settings, new RegExp(`${field}: data\\.status \\|\\| \\(data\\.currentTier === "free" \\? "inactive" : "active"\\)`),
      `${field} must not fall back to "active" when the server omitted a status`);
  }
  // Writing the server's own status, and writing "inactive" on a downgrade, both stay.
  assert.match(settings, /\? \{ weddingStatus: data\.status \}/);
  assert.match(settings, /\? \{ vendorStatus: data\.status \}/);
  assert.match(settings, /weddingStatus: "inactive" as const/);
  assert.match(settings, /vendorStatus: "inactive" as const/);
  // Cancellations are removals, so they remain client-writable.
  assert.match(settings, /subscriptionStatus: "cancelled"/);
});

if (!PG_URL) {
  test("Paid upgrade availability (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  test("every module's advertised availability matches what its paid endpoint actually does", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { default: subscriptionsRouter } = await import("./subscriptions");
    const { default: vendorRouter } = await import("./vendor-subscription");
    const { default: nutritionRouter } = await import("./nutrition");

    const app = express();
    app.use(express.json());
    app.use("/api/subscriptions", subscriptionsRouter);
    app.use("/api/vendors", vendorRouter);
    app.use("/api/nutrition", nutritionRouter);
    const server = app.listen(0, "127.0.0.1");
    try {
      await local.query(`
        DROP TABLE IF EXISTS nutrition_intro_trials, subscription_history, users CASCADE;
        ${ddl(schema.users, "users")};
        ${readFileSync(new URL("../../docs/ops/2026-11-09-nutrition-intro-trials.sql", import.meta.url), "utf8")}
      `);
      const [member] = (await local.query(
        "INSERT INTO users (username, email, display_name) VALUES ('plans','plans@example.test','Plans') RETURNING id",
      )).rows;
      const id = String(member.id);
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

      const call = async (method: string, path: string, body?: unknown) => {
        const response = await fetch(base + path, {
          method,
          headers: { ...testAuthHeader(id), "content-type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        return { status: response.status, data: await response.json().catch(() => ({})) as any };
      };

      const modules = [
        { name: "marketplace", tiers: "/api/subscriptions/tiers", change: "/api/subscriptions/upgrade", body: { tier: "professional" } },
        { name: "vendors", tiers: "/api/vendors/subscription/tiers", change: "/api/vendors/subscription/change", body: { tier: "professional" } },
        { name: "nutrition", tiers: "/api/nutrition/subscription/tiers", change: "/api/nutrition/subscription/change", body: { tier: "premium" } },
      ];

      for (const module of modules) {
        const tiers = await call("GET", module.tiers);
        assert.equal(tiers.status, 200, `${module.name} tiers: ${JSON.stringify(tiers.data)}`);
        assert.equal(typeof tiers.data.paidUpgradesAvailable, "boolean",
          `${module.name} must state whether paid changes are available, not leave it undefined`);

        const change = await call("POST", module.change, module.body);
        const where = `${module.name} answered ${change.status} ${JSON.stringify(change.data)}`;

        // Stated as two implications rather than `flag === !refused`. An earlier version defined
        // refusal as "status is 503" and availability as its negation, which meant that once the
        // flag flips to true a 400, 401, 409 or 500 would count as a successful non-refusal and the
        // test would pass while nothing actually worked. A non-503 failure is not availability.
        if (tiers.data.paidUpgradesAvailable === false) {
          assert.equal(change.status, 503, `${module.name} says paid changes are unavailable, so its paid endpoint must refuse: ${where}`);
          assert.equal(change.data.code, SUBSCRIPTION_BILLING_NOT_CONFIGURED,
            `${module.name} must refuse with the shared billing code, so one client check covers all three: ${where}`);
        } else {
          assert.ok(change.status >= 200 && change.status < 300,
            `${module.name} advertises paid changes, so an authorized request must actually succeed: ${where}`);
          assert.notEqual(change.data.code, SUBSCRIPTION_BILLING_NOT_CONFIGURED, where);
        }
      }

      // A free downgrade is never gated by the flag: removing entitlement always works.
      const downgrade = await call("POST", "/api/vendors/subscription/change", { tier: "free" });
      assert.equal(downgrade.status, 200, JSON.stringify(downgrade.data));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query("DROP TABLE IF EXISTS nutrition_intro_trials, subscription_history, users CASCADE");
      await local.end();
    }
  });
}
