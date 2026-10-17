/**
 * Stability Phase 2C, final verification: pending logout + Google OAuth, END TO END.
 * Real auth router (initiation + callback + sealed per-flow cookies) and a real client session controller, joined by a browser-like cookie jar and
 * localStorage. Only Google (stub strategy) and /api/auth/me|logout (stub: me trusts the auth_token cookie; logout is down, so the intent stays pending) are faked.
 */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import cookieParser from "cookie-parser";
import passport from "passport";
import { Strategy } from "passport-strategy";
import { beginGoogleSignIn, createSessionController, LOGOUT_PENDING_KEY, USER_STORAGE_KEY } from "../../client/src/lib/session-controller";

process.env.DATABASE_URL ||= "postgres://app:secret@127.0.0.1:9/chefsire_unreachable_test";
const { default: authRouter } = await import("./auth");

class FakeGoogle extends (Strategy as any) {
  name = "google";
  authenticate(req: any, options: any = {}) {
    if (String(req.path).endsWith("/callback")) return (this as any).success({ id: "g-user", email: "g@example.test", username: "g", authVersion: 1 });
    const u = new URL("https://accounts.google.test/o/oauth2/auth");
    if (options.state) u.searchParams.set("state", options.state);
    (this as any).redirect(u.toString());
  }
}
passport.use("google", new FakeGoogle() as any);

const app = express();
app.use(cookieParser());
app.use(passport.initialize());
app.use("/api", authRouter);
const server = http.createServer(app);
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
test.after(() => { server.close(); server.closeAllConnections?.(); });

class Browser {
  cookies = new Map<string, string>(); // name -> value (one path for this test's purposes)
  ls = new Map<string, string>();
  storage = { getItem: (k: string) => this.ls.get(k) ?? null, setItem: (k: string, v: string) => void this.ls.set(k, v), removeItem: (k: string) => void this.ls.delete(k) };
  logoutCalls = 0;
  async nav(path: string) {
    const r = await fetch(base + path, { redirect: "manual", headers: { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") } });
    for (const line of r.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";").map((s) => s.trim());
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq), value = pair.slice(eq + 1);
      const cleared = value === "" || attrs.some((a) => /^max-age=0$/i.test(a));
      if (cleared) this.cookies.delete(name); else this.cookies.set(name, value);
    }
    return r;
  }
  /** User clicks "Continue with Google" -> server initiation -> (Google) -> callback; returns the URL the browser lands on. */
  async googleSignIn(opts: { next?: string; recordNonce?: boolean; forgeState?: boolean } = {}) {
    const nonce = opts.recordNonce === false ? "N".repeat(24) : beginGoogleSignIn(this.storage, Date.now());
    const init = await this.nav(`/api/auth/google?client_state=${nonce}${opts.next ? `&next=${encodeURIComponent(opts.next)}` : ""}`);
    const state = opts.forgeState ? "F".repeat(32) : new URL(init.headers.get("location")!).searchParams.get("state");
    const cb = await this.nav(`/api/auth/google/callback?code=x&state=${state}`);
    return { landed: new URL(cb.headers.get("location")!, "https://app.test"), nonce };
  }
  controllerAt(url: URL) {
    let loc = new URL(url);
    const hang = (_ms: number, signal: AbortSignal) => new Promise<void>((r) => { if (signal.aborted) return r(); signal.addEventListener("abort", () => r(), { once: true }); });
    const fetchFn = (async (u: string) => {
      if (u === "/api/auth/me") {
        return this.cookies.get("auth_token") ? new Response(JSON.stringify({ success: true, user: { id: "g-user", email: "g@example.test" } }), { status: 200 }) : new Response("{}", { status: 401 });
      }
      if (u === "/api/auth/logout") { this.logoutCalls++; return new Response("{}", { status: 503 }); } // server logout is down: intent must persist
      throw new Error(`unexpected ${u}`);
    }) as unknown as typeof fetch;
    return createSessionController<{ id: string; email: string }>({
      fetch: fetchFn, storage: this.storage,
      getLocation: () => ({ pathname: loc.pathname, search: loc.search, hash: loc.hash }),
      replaceUrl: (u: string) => { loc = new URL(u, loc); },
      sleep: hang, mutationDeadline: hang, verifyDeadline: hang,
      parseUser: (p: any) => p as { id: string; email: string },
      onChange: () => {},
    } as never);
  }
}
const pendingLogout = (b: Browser) => { b.ls.set(LOGOUT_PENDING_KEY, "1"); b.ls.delete(USER_STORAGE_KEY); };

test("pending logout, then a LEGITIMATE Google sign-in (real initiation + callback + sealed flow cookie): the new login wins and the intent is cleared", async () => {
  const b = new Browser();
  pendingLogout(b);
  const { landed } = await b.googleSignIn({ next: "/services/catering/provider?tab=menu#billing" });
  assert.equal(landed.searchParams.get("google-login"), "success");
  assert.ok(landed.searchParams.get("oauth_state"), "the server echoed this browser's own nonce");
  const c = b.controllerAt(landed);
  c.start();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(c.getState().user?.id, "g-user");
  assert.equal(c.getState().sessionStatus, "authenticated");
  assert.equal(b.ls.has(LOGOUT_PENDING_KEY), false, "a genuine new sign-in supersedes the pending logout");
  assert.equal(b.logoutCalls, 0);
  c.dispose();
});

test("pending logout + FORGED callback URL (marker and a nonce this browser never created): stays signed out and finishes the logout", async () => {
  const b = new Browser();
  pendingLogout(b);
  b.cookies.set("auth_token", "stale-session");
  for (const q of ["?google-login=success", `?google-login=success&oauth_state=${"X".repeat(24)}`, "?google-login=success&oauth_state=short"]) {
    const c = b.controllerAt(new URL(`https://app.test/${q}`));
    c.start();
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(c.getState().user, null, q);
    assert.equal(c.getState().sessionStatus, "anonymous", q);
    assert.equal(b.ls.get(LOGOUT_PENDING_KEY), "1", `${q}: intent preserved`);
    c.dispose();
  }
  assert.ok(b.logoutCalls >= 3, "the logout is re-attempted each time");
});

test("pending logout + a callback whose server-side state is forged/unknown: no nonce is echoed, so it cannot cancel the logout", async () => {
  const b = new Browser();
  pendingLogout(b);
  const { landed } = await b.googleSignIn({ forgeState: true });
  assert.equal(landed.searchParams.has("oauth_state"), false);
  const c = b.controllerAt(landed);
  c.start();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(c.getState().user, null);
  assert.equal(b.ls.get(LOGOUT_PENDING_KEY), "1");
  c.dispose();
});

test("pending logout + a nonce the page never recorded (cross-browser / injected initiation): the server echoes it but the client refuses it", async () => {
  const b = new Browser();
  pendingLogout(b);
  const { landed } = await b.googleSignIn({ recordNonce: false });
  assert.ok(landed.searchParams.get("oauth_state"));
  const c = b.controllerAt(landed);
  c.start();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(c.getState().user, null);
  assert.equal(b.ls.get(LOGOUT_PENDING_KEY), "1");
  c.dispose();
});

test("REPLAY: after a genuine sign-in and a later logout that fails, revisiting the old callback URL (and replaying the server callback) cannot undo the logout", async () => {
  const b = new Browser();
  pendingLogout(b);
  const { landed, nonce } = await b.googleSignIn({ next: "/recipes/9" });
  const first = b.controllerAt(landed);
  first.start();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(first.getState().user?.id, "g-user");
  await first.logout(); // server logout is down: local sign-out + persisted intent
  assert.equal(b.ls.get(LOGOUT_PENDING_KEY), "1");
  first.dispose();
  // browser history replays the very same callback URL
  const replay = b.controllerAt(landed);
  replay.start();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(replay.getState().user, null, "the single-use nonce is spent");
  assert.equal(b.ls.get(LOGOUT_PENDING_KEY), "1");
  replay.dispose();
  // and replaying the server callback with the consumed flow state yields no nonce
  const again = await b.nav(`/api/auth/google/callback?code=x&state=${encodeURIComponent("Q".repeat(32))}`);
  assert.equal(new URL(again.headers.get("location")!, "https://app.test").searchParams.has("oauth_state"), false);
  void nonce;
});
