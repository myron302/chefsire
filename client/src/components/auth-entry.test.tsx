import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { act, create } from "react-test-renderer";
import { AuthEntryGate } from "./auth-entry";
import { authEntryDestination } from "../lib/auth-entry";

for (const page of ["/login", "/signup"]) {
  test(`${page}: refresh waits; authenticated direct visit and Back replace the entry`, () => {
    const calls: unknown[] = [];
    const navigate = (...args: unknown[]) => { calls.push(args); };
    const props = { user: null as unknown, loading: true, sessionStatus: "checking" as const, destination: "/feed", navigate };
    let view!: ReturnType<typeof create>;
    act(() => { view = create(<AuthEntryGate {...props}><form data-page={page} /></AuthEntryGate>); });
    assert.equal(view.root.findAllByType("form").length, 0);
    act(() => { view.update(<AuthEntryGate {...props} loading={false} sessionStatus="unavailable"><form /></AuthEntryGate>); });
    assert.equal(view.root.findAllByType("form").length, 0);
    act(() => { view.update(<AuthEntryGate {...props} user={{ id: "1" }} loading={false} sessionStatus="authenticated"><form /></AuthEntryGate>); });
    assert.deepEqual(calls, [["/feed", { replace: true }]]);
    assert.equal(view.toJSON(), null);
    act(() => { view.unmount(); });
    // Returning via history mounts the guard again with the current identity.
    act(() => { view = create(<AuthEntryGate {...props} user={{ id: "1" }} loading={false} sessionStatus="authenticated"><form /></AuthEntryGate>); });
    assert.equal(calls.length, 2);
    act(() => { view.update(<AuthEntryGate {...props} loading={false} sessionStatus="anonymous"><form /></AuthEntryGate>); });
    assert.equal(view.root.findAllByType("form").length, 1, "intentional logout permits the form");
    act(() => { view.unmount(); });
  });
}

test("safe intended destinations cannot redirect outside the site or loop through auth pages", () => {
  for (const next of ["//evil.test", "/\\evil.test", "/login?next=/signup", "/signup", "/%6cogin", "https://evil.test"]) {
    assert.equal(authEntryDestination(`?next=${encodeURIComponent(next)}`), "/feed");
  }
  assert.equal(authEntryDestination("?next=%2Frecipes%2F42%3Ftab%3Dreviews%23comments"), "/recipes/42?tab=reviews#comments");
});

test("both auth routes use the gate and the public header waits for confirmed anonymous state", async () => {
  const { readFileSync } = await import("node:fs");
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  for (const [path, page] of [["login", "Login"], ["signup", "Signup"]]) {
    assert.ok(app.includes(`<Route path="/${path}"><AuthEntry><${page} /></AuthEntry></Route>`));
  }
  const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
  assert.ok(layout.includes('!loading && sessionStatus === "anonymous" && ('));
});

test("an admitted form survives indeterminate checks without trusting a cached profile for redirects", () => {
  const calls: unknown[] = [];
  const navigate = (...args: unknown[]) => { calls.push(args); };
  const props = { user: null as unknown, loading: false, sessionStatus: "anonymous" as const, destination: "/feed", navigate };
  let view!: ReturnType<typeof create>;
  act(() => { view = create(<AuthEntryGate {...props}><form /></AuthEntryGate>); });
  const form = view.root.findByType("form");
  for (const sessionStatus of ["checking", "unavailable"] as const) {
    act(() => { view.update(<AuthEntryGate {...props} loading={true} sessionStatus={sessionStatus} user={{ id: "cached" }}><form /></AuthEntryGate>); });
    assert.equal(view.root.findByType("form"), form);
    assert.deepEqual(calls, [], "only a verified identity may redirect");
  }
  act(() => { view.unmount(); });
});
