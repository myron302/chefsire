/**
 * The real UserProvider, rendered (server renderer: no DOM in this runner, so effects do not run). Checks the provider/hook contract and that the
 * outage notice and the additive context fields exist. The lifecycle itself is tested deterministically in lib/session-controller.test.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { UserProvider, useUser, authenticatedUserFromPayload } from "./UserContext";

function Probe() {
  const u = useUser();
  return React.createElement("pre", null, JSON.stringify({ user: u.user, loading: u.loading, sessionStatus: u.sessionStatus, hasRetry: typeof u.retrySession, hasLogout: typeof u.logout, hasRefresh: typeof u.refreshUser, hasLogin: typeof u.login }));
}

test("UserProvider renders its initial 'checking, signed-out, loading' state and keeps the existing context contract plus the additive fields", () => {
  const html = renderToString(React.createElement(UserProvider, null, React.createElement(Probe)));
  const json = JSON.parse(html.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"'));
  assert.deepEqual(json, { user: null, loading: true, sessionStatus: "checking", hasRetry: "function", hasLogout: "function", hasRefresh: "function", hasLogin: "function" });
  assert.ok(!html.includes("session-unavailable"), "no outage notice before an outage");
});

test("useUser outside the provider still throws", () => {
  assert.throws(() => renderToString(React.createElement(Probe)), /UserProvider/);
});

test("the payload validator the provider injects rejects incomplete users (so they can never be persisted)", () => {
  assert.throws(() => authenticatedUserFromPayload({ id: "1", email: "e" }), /catering/i);
  assert.throws(() => authenticatedUserFromPayload(null), /Incomplete/);
});
