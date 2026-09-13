import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringBookingBillingPath } from "@shared/catering-booking-billing";

/**
 * THE CLIENT AND THE SERVER MUST NAME THE SAME ROUTES.
 *
 * The billing component sent every mutation as a POST, hardcoded inside `mutationFn`. Four of the five routes are
 * POSTs, so nothing looked wrong -- but the deposit-terms save is a PUT, and Express answered it with a 404 the
 * client reported as "this billing change could not be saved". A provider could fill the form in, press Save, and
 * be refused by a server that never saw a request it recognised.
 *
 * A default is what made that invisible, so the fix is to remove the default: every call site now states its own
 * method beside its own path, and this file pins the whole contract by extracting BOTH sides and comparing them.
 * A route added later with the wrong verb fails here rather than in production.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "BookingBilling.tsx"), "utf8");
const route = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-billing.ts"), "utf8");

/** A path with its interpolations reduced to a positional marker, so the two sides are comparable. */
const shape = (value: string) => value.replace(/\$\{[^}]*\}/g, ":p").replace(/:[A-Za-z]\w*/g, ":p");

/** What the CLIENT asks for: every `mutation.mutate({ ... method, path ... })` in the component. */
const clientCalls = [...component.matchAll(/method: "(PUT|POST)", path: ([`"])([^`"]*)\2/g)]
  .map((match) => ({ method: match[1], path: shape(match[3]) }));

/** What the SERVER registers, reduced to the part after the booking id. */
const serverRoutes = [...route.matchAll(/r\.(get|put|post)\("\/bookings\/:id(\/billing[^"]*)"/g)]
  .map((match) => ({ method: match[1].toUpperCase(), path: shape(match[2]) }));

test("every mutation the client makes is a route the server actually registers, with the same verb", () => {
  assert.equal(clientCalls.length, 5, JSON.stringify(clientCalls));
  for (const call of clientCalls) {
    const match = serverRoutes.find((row) => row.method === call.method && row.path === call.path);
    assert.ok(match, `no server route for ${call.method} ${call.path}; server has ${JSON.stringify(serverRoutes)}`);
  }
});

test("the deposit-terms save is a PUT, which is the defect this pins", () => {
  const terms = clientCalls.find((call) => call.path === "/billing/deposit-terms");
  assert.ok(terms, JSON.stringify(clientCalls));
  assert.equal(terms.method, "PUT");
  assert.ok(serverRoutes.some((row) => row.method === "PUT" && row.path === "/billing/deposit-terms"));
  // And the component states it at the call site rather than anywhere it could be overridden.
  assert.ok(component.includes('origin: origin(), method: "PUT", path: "/billing/deposit-terms",'));
});

test("each of the other four keeps the verb its route is registered with", () => {
  for (const [pathShape, method] of [
    ["/billing/invoices", "POST"],
    ["/billing/invoices/:p/void", "POST"],
    ["/billing/payments", "POST"],
    ["/billing/payments/:p/void", "POST"],
  ] as const) {
    assert.ok(clientCalls.some((call) => call.path === pathShape && call.method === method), `client: ${method} ${pathShape}`);
    assert.ok(serverRoutes.some((row) => row.path === pathShape && row.method === method), `server: ${method} ${pathShape}`);
  }
});

test("no mutation can silently default to POST again", () => {
  // The method is a required field on the mutation variables, so a call site that omits one does not compile --
  // and `mutationFn` has no literal verb of its own to fall back to.
  assert.ok(component.includes('method: "PUT" | "POST";'), "declared, and not optional");
  assert.equal(component.includes('method: "POST", credentials'), false, "the hardcoded verb is gone");
  assert.ok(component.includes("mutationFn: async ({ origin: started, method, path, body }: BillingMutation)"));
  assert.ok(component.includes("method, credentials: \"include\","), "the request uses the one it was given");
  // Every `mutation.mutate({` in the file states a method.
  for (const call of [...component.matchAll(/mutation\.mutate\(\{([\s\S]{0,200})/g)].map((match) => match[1])) {
    assert.ok(/method: "(PUT|POST)"/.test(call), call.replace(/\s+/g, " ").slice(0, 90));
  }
});

test("every server route is reachable from the client, or is the read", () => {
  // Nothing is registered that no call site uses, and nothing is registered that only the UI knows the verb for.
  for (const row of serverRoutes.filter((entry) => entry.method !== "GET")) {
    assert.ok(clientCalls.some((call) => call.method === row.method && call.path === row.path), `unused route: ${row.method} ${row.path}`);
  }
  // Six routes in total: the read plus the five mutations, and no more.
  assert.equal(serverRoutes.length, 6, JSON.stringify(serverRoutes));
  // The read is a GET through the shared path helper, not a hand-written string.
  assert.ok(component.includes("fetch(cateringBookingBillingPath(bookingId), { credentials: \"include\" })"));
  assert.equal(cateringBookingBillingPath("booking-1"), "/api/catering/bookings/booking-1/billing");
  assert.ok(route.includes('r.get("/bookings/:id/billing", requireAuth'));
});

test("the request body is JSON on every mutation, and the read sends none", () => {
  assert.ok(component.includes('headers: { "Content-Type": "application/json" }'));
  assert.ok(component.includes("body: JSON.stringify(body)"));
  // A GET with a body would be the other half of a contract mismatch.
  const read = component.slice(component.indexOf("queryFn: async ()"), component.indexOf("const billing = query.data;"));
  assert.equal(read.includes("body:"), false);
  assert.equal(read.includes("method:"), false, "the default GET is what the route expects");
});
