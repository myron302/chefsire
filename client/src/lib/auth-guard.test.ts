import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shouldRedirectToLogin } from "./auth-guard";

test("redirects only when the session is confirmed anonymous", () => {
  assert.equal(shouldRedirectToLogin({ loading: false, user: null, sessionStatus: "anonymous" }), true);
  assert.equal(shouldRedirectToLogin({ loading: false, user: null, sessionStatus: "unavailable" }), false);
  assert.equal(shouldRedirectToLogin({ loading: false, user: null, sessionStatus: "checking" }), false);
  assert.equal(shouldRedirectToLogin({ loading: true, user: null, sessionStatus: "anonymous" }), false);
  assert.equal(shouldRedirectToLogin({ loading: false, user: { id: "1" }, sessionStatus: "authenticated" } as any), false);
});

test("catering provider page uses the guard helper", () => {
  const src = readFileSync(new URL("../pages/services/catering-provider.tsx", import.meta.url), "utf8");
  assert.match(src, /shouldRedirectToLogin\(\{ loading, user, sessionStatus \}\)/);
});
