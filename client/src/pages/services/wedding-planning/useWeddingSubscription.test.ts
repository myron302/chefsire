import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useWeddingSubscription } from "./useWeddingSubscription";

// A durable account fixture survives component mounts and browser-session changes.
// HTTP failures never change its persisted selection history.
test("Wedding onboarding survives navigation, refresh and a subsequent login", async () => {
  const originalFetch = globalThis.fetch;
  const completed = new Set<string>(["existing-free", "legacy-paid"]);
  let account = "first-visit";
  let fail = false;
  let pending: (() => void) | undefined;
  let result: ReturnType<typeof useWeddingSubscription>;
  const frames: boolean[] = [];
  function Probe({ userId }: { userId?: string }) {
    result = useWeddingSubscription(userId);
    frames.push(result.subscription?.onboardingCompleted === false);
    return null;
  }
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /^\/api\/wedding\/subscription(?:\/change)?$/);
    assert.equal(init?.credentials, "include");
    const requestAccount = account;
    if (pending) await new Promise<void>((resolve) => { pending = resolve; });
    if (fail) return new Response(JSON.stringify({ ok: false, error: "Request failed" }), { status: 503 });
    if (init?.method === "POST") {
      const { tier } = JSON.parse(String(init.body));
      if (tier !== "free") return new Response(JSON.stringify({ ok: false, error: "Verified billing required" }), { status: 503 });
      completed.add(requestAccount);
    }
    return new Response(JSON.stringify({ ok: true, currentTier: "free", status: "inactive", onboardingCompleted: completed.has(requestAccount) }));
  };
  let renderer: ReactTestRenderer;
  const mount = async (userId = account) => {
    await act(async () => { renderer = create(createElement(Probe, { userId })); });
  };
  const unmount = async () => { await act(async () => { renderer.unmount(); }); };
  try {
    pending = () => {};
    await mount();
    assert.equal(result!.subscription, undefined);
    assert.equal(frames.some(Boolean), false, "loading never flashes the popup");
    await act(async () => { pending!(); pending = undefined; });
    assert.equal(result!.subscription?.onboardingCompleted, false, "first visit opens onboarding");

    fail = true;
    await assert.rejects(() => result!.selectPlan("free"), /Request failed/);
    assert.equal(completed.has(account), false);
    assert.equal(result!.subscription?.onboardingCompleted, false);
    fail = false;
    await assert.rejects(() => result!.selectPlan("premium"), /Verified billing/);
    assert.equal(completed.has(account), false);
    await act(async () => { await result!.selectPlan("free"); });
    assert.equal(result!.subscription?.onboardingCompleted, true);

    for (const scenario of ["return after navigation", "refresh", "new session after login"]) {
      await unmount();
      await mount();
      assert.equal(result!.subscription?.onboardingCompleted, true, scenario);
      assert.equal(result!.subscription?.currentTier, "free");
    }
    for (account of ["existing-free", "legacy-paid"]) {
      await unmount();
      await mount();
      assert.equal(result!.subscription?.onboardingCompleted, true);
    }
    fail = true;
    await unmount();
    await mount();
    assert.equal(result!.subscription, undefined, "read failure never opens onboarding");
    assert.match(result!.subscriptionError!, /Unable to load/);
    await act(async () => { result!.retrySubscription(); });
    assert.match(result!.subscriptionError!, /Unable to load/, "failed retry stays recoverable");
    fail = false;
    pending = () => {};
    await act(async () => { result!.retrySubscription(); });
    assert.equal(result!.subscription, undefined, "retry loading never opens onboarding");
    assert.equal(result!.subscriptionError, undefined, "retry clears the old error");
    await act(async () => { pending!(); pending = undefined; });
    assert.equal(result!.subscription?.onboardingCompleted, true, "same account recovers without remounting");
    assert.equal(result!.subscriptionError, undefined);
    account = "another-new-account";
    await act(async () => { renderer.update(createElement(Probe, { userId: account })); });
    assert.equal(result!.subscription?.onboardingCompleted, false, "selection belongs to the account");
    fail = true;
    await act(async () => { result!.retrySubscription(); });
    assert.match(result!.subscriptionError!, /Unable to load/);
    fail = false;
    await act(async () => { result!.retrySubscription(); });
    assert.equal(result!.subscription?.onboardingCompleted, false, "first-time account can onboard after recovery");
  } finally {
    await unmount();
    globalThis.fetch = originalFetch;
  }
});
