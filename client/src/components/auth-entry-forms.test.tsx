import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { UserProvider, useUser } from "../contexts/UserContext";
import { AuthEntryGate } from "./auth-entry";
import LoginPage from "../pages/auth/login";
import SignupPage from "../pages/auth/signup";

const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
const verifiedUser = { id: "1", email: "chef@example.test", specialty: null, cateringEnabled: false, cateringLocation: null, cateringLatitude: null, cateringLongitude: null, cateringRadius: null, cateringBio: null, cateringAvailable: false };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function setup(page: "login" | "signup") {
  const browser = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const storage = new Map<string, string>();
  const requests: string[] = [];
  let meReply = () => Promise.resolve(json(401));
  let loginReply = () => Promise.resolve(json(401, { error: "Invalid email or password" }));
  const fetchMock = async (url: unknown) => {
    requests.push(String(url));
    if (url === "/api/auth/me") return meReply();
    if (url === "/api/auth/login") return loginReply();
    throw new Error(`Unexpected request ${url}`);
  };
  const win = Object.assign(browser, {
    fetch: fetchMock,
    location: new URL(`https://chefsire.test/${page}`),
    history: { replaceState() {} },
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
  });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ React, window: win, document: doc, alert: () => {}, FormData: class extends FormData {
    constructor(form?: { values: Record<string, string> }) {
      super();
      for (const [key, value] of Object.entries(form?.values ?? {})) this.set(key, value);
    }
  } })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const location = memoryLocation({ path: `/${page}`, record: true });
  let session!: ReturnType<typeof useUser>;
  function Screen() {
    session = useUser();
    return <AuthEntryGate {...session} destination="/feed" navigate={location.navigate}>{page === "login" ? <LoginPage /> : <SignupPage />}</AuthEntryGate>;
  }
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<Router hook={location.hook}><UserProvider><Screen /></UserProvider></Router>); });
  return {
    view, requests, location, session: () => session,
    setMe: (reply: typeof meReply) => { meReply = reply; },
    setLogin: (reply: typeof loginReply) => { loginReply = reply; },
    async signal(kind: "focus" | "visibilitychange" | "storage") {
      await act(async () => {
        if (kind === "visibilitychange") doc.dispatchEvent(new Event(kind));
        else if (kind === "storage") {
          const event = Object.assign(new Event(kind), { storageArea: win.localStorage, key: "user" });
          browser.dispatchEvent(event);
        } else browser.dispatchEvent(new Event(kind));
      });
    },
    async close() {
      await act(async () => { view.unmount(); });
      for (const [key, descriptor] of Array.from(previous)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

for (const [name, status, message] of [
  ["incorrect password", 401, "Invalid email or password"],
  ["unverified email", 403, "Please verify your email to log in."],
  ["network failure", 0, "Network error. Please try again."],
] as const) {
  test(`${name}: the real login form stays mounted and displays the error`, async () => {
    const s = await setup("login");
    try {
      const reply = deferred<Response>();
      s.setLogin(() => reply.promise);
      const email = s.view.root.findByProps({ id: "email" });
      const password = s.view.root.findByProps({ id: "password" });
      let submitted!: Promise<void>;
      await act(async () => {
        submitted = s.view.root.findByType("form").props.onSubmit({ preventDefault() {}, currentTarget: { values: { email: "chef@example.test", password: "wrong-password" } } });
      });
      assert.equal(s.session().loading, true);
      assert.equal(s.view.root.findByProps({ id: "email" }), email, "uncontrolled email input is not remounted");
      assert.equal(s.view.root.findByProps({ id: "password" }), password, "uncontrolled password input is not remounted");
      await act(async () => {
        if (status) reply.resolve(json(status, { error: message }));
        else reply.reject(new TypeError("Failed to fetch"));
        await submitted;
      });
      assert.equal(s.view.root.findByProps({ id: "email" }), email);
      assert.equal(s.view.root.findByProps({ id: "password" }), password);
      assert.ok(JSON.stringify(s.view.toJSON()).includes(message));
      assert.deepEqual(s.location.history, ["/login"]);
    } finally { await s.close(); }
  });
}

for (const page of ["login", "signup"] as const) {
  test(`${page}: focus, visibility and cross-tab checks retain fields and validation; outage remains retryable`, async () => {
    const s = await setup(page);
    try {
      const form = s.view.root.findByType("form");
      if (page === "signup") {
        await act(async () => {
          s.view.root.findByProps({ name: "signup_email" }).props.onChange({ target: { value: "unfinished@example.test" } });
          s.view.root.findByProps({ name: "signup_password" }).props.onChange({ target: { value: "unfinished-password" } });
          form.props.onSubmit({ preventDefault() {} });
        });
      } else {
        await act(async () => { await form.props.onSubmit({ preventDefault() {}, currentTarget: { values: { email: "unfinished", password: "x" } } }); });
      }
      const before = JSON.stringify(s.view.toJSON());
      for (const kind of ["focus", "visibilitychange", "storage"] as const) {
        const check = deferred<Response>();
        s.setMe(() => check.promise);
        await s.signal(kind);
        assert.equal(s.session().sessionStatus, "checking");
        assert.equal(s.view.root.findByType("form"), form);
        assert.equal(JSON.stringify(s.view.toJSON()), before);
        await act(async () => { check.resolve(json(401)); });
        assert.equal(JSON.stringify(s.view.toJSON()), before);
      }
      s.setMe(() => Promise.resolve(json(503)));
      await s.signal("focus");
      assert.equal(s.session().sessionStatus, "unavailable");
      assert.equal(s.view.root.findByType("form"), form);
      if (page === "signup") {
        assert.equal(s.view.root.findByProps({ name: "signup_email" }).props.value, "unfinished@example.test");
        assert.equal(s.view.root.findByProps({ name: "signup_password" }).props.value, "unfinished-password");
      }
      // The existing recovery run is still active; uncertainty must not trigger logout.
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
      assert.equal(typeof s.session().retrySession, "function");
      assert.equal(s.requests.some(url => url === "/api/auth/logout"), false);
    } finally { await s.close(); }
  });
}

test("successful login redirects with replacement", async () => {
  const s = await setup("login");
  try {
    s.setLogin(() => Promise.resolve(json(200, { success: true, user: verifiedUser })));
    await act(async () => {
      await s.view.root.findByType("form").props.onSubmit({ preventDefault() {}, currentTarget: { values: { email: verifiedUser.email, password: "valid-password" } } });
    });
    assert.deepEqual(s.location.history, ["/feed"]);
    assert.equal(s.view.root.findAllByType("form").length, 0);
  } finally { await s.close(); }
});
