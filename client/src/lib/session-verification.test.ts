import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { classifySessionStatus, recheckSession, SESSION_RECHECK_DELAYS_MS } from "./session-verification";

test("only the server's definitive 'no' (401/4xx) invalidates the session; outages never do", () => {
  assert.equal(classifySessionStatus(200), "valid");
  assert.equal(classifySessionStatus(401), "invalid");
  assert.equal(classifySessionStatus(403), "invalid");
  for (const status of [500, 502, 503, 504, 429, 408]) assert.equal(classifySessionStatus(status), "unavailable", String(status));
});

test("recheck: bounded to three tries with increasing delays, then stops without a verdict", async () => {
  const slept: number[] = [];
  let calls = 0;
  const verdict = await recheckSession(async () => { calls++; return 503; }, { sleep: async (ms) => { slept.push(ms); } });
  assert.equal(verdict, "unavailable");
  assert.equal(calls, 3);
  assert.deepEqual(slept, [...SESSION_RECHECK_DELAYS_MS]);
});

test("recheck: stops at the first definitive answer, in either direction", async () => {
  let n = 0;
  assert.equal(await recheckSession(async () => (++n < 2 ? 503 : 200), { sleep: async () => {} }), "valid");
  n = 0;
  assert.equal(await recheckSession(async () => (++n < 3 ? 502 : 401), { sleep: async () => {} }), "invalid");
});

test("recheck: network errors count as 'no information'; shouldStop cancels without further requests", async () => {
  let calls = 0;
  assert.equal(await recheckSession(async () => { calls++; throw new TypeError("Failed to fetch"); }, { sleep: async () => {} }), "unavailable");
  assert.equal(calls, 3);
  calls = 0;
  assert.equal(await recheckSession(async () => { calls++; return 200; }, { sleep: async () => {}, shouldStop: () => true }), "unavailable");
  assert.equal(calls, 0);
});

test("UserContext consults the classifier before it forgets the stored user", () => {
  const src = fs.readFileSync(new URL("../contexts/UserContext.tsx", import.meta.url), "utf8");
  const verify = src.slice(src.indexOf("Verify the cookie/session is still valid"));
  const classify = verify.indexOf("classifySessionStatus(verifyRes.status)");
  const clear = verify.indexOf('localStorage.removeItem("user")');
  assert.ok(classify > 0 && clear > classify, "the stored user is only cleared after the verdict has been taken");
  assert.match(verify, /verdict === "unavailable"[\s\S]{0,400}setUser\(parsed as User\)/, "an unavailable verdict keeps the signed-in state");
});
