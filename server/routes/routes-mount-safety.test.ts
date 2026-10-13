/**
 * A guard for the class of defect behind Stability Phase 2A.
 *
 * `routes/index.ts` mounts a few routers WITHOUT a path prefix (their URLs are absolute). Express runs a router's own middleware layers --
 * `router.use(...)` -- for every request that reaches that router, whether or not one of its routes matches, so a middleware layer on an
 * unprefixed router runs for a large part of the whole API (everything mounted after it, and every unknown /api path). The meal-social
 * schema initialization was exactly that, and a failure in it answered 500 for the Square webhook, DMs and unknown paths.
 *
 * This reads the real router tree: an unprefixed router may contain routes and nothing else. Anything that needs a precondition adds it to
 * the routes that need it (see `requireMealSocialSchema` in meal-social.ts), after authentication.
 */
import "../test-support/accept-test-sessions";
import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://app:secret@127.0.0.1:9/chefsire_mount_safety_test";

const { default: index } = await import("./index");

type Layer = { route?: unknown; name: string; handle: { stack?: Layer[] }; regexp?: { fast_slash?: boolean } };

test("every router mounted without a path prefix contains only routes, never router-level middleware", () => {
  const unprefixedRouters = (index as unknown as { stack: Layer[] }).stack.filter((layer) => layer.name === "router" && layer.regexp?.fast_slash === true);
  assert.ok(unprefixedRouters.length >= 3, `expected the auth, meal-plans and meal-social routers; found ${unprefixedRouters.length}`);

  for (const mounted of unprefixedRouters) {
    const inner = mounted.handle.stack ?? [];
    const routes = inner.filter((layer) => layer.route);
    const middleware = inner.filter((layer) => !layer.route).map((layer) => layer.name);
    assert.ok(routes.length > 0, "an unprefixed router with no routes should not be mounted");
    assert.deepEqual(middleware, [], `an unprefixed router has router-level middleware (${middleware.join(", ")}); it would run for every request that reaches it`);
  }
});

test("the meal-social routes each carry their schema guard (it was moved from the router to the routes)", async () => {
  const { default: social } = await import("./meal-social");
  const routes = (social as unknown as { stack: Layer[] }).stack.filter((layer) => layer.route) as unknown as Array<{ route: { path: string; stack: Array<{ name: string }> } }>;
  assert.equal(routes.length, 19);
  for (const { route } of routes) {
    const names = route.stack.map((handler) => handler.name);
    assert.ok(names.includes("requireAuth") || names.includes("optionalAuth"), `${route.path} has no authentication layer: ${names.join(",")}`);
    // authentication first, then the schema guard, then the (error-wrapped) handler
    assert.ok(names.indexOf("requireAuth") === 0 || names.indexOf("optionalAuth") === 0, `${route.path}: authentication must come first`);
    assert.equal(names.length, 3, `${route.path}: expected [auth, schema guard, handler], got ${names.join(",")}`);
  }
});
