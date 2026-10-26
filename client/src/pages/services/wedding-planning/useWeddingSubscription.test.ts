import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { WeddingSubscriptionStatus } from "./WeddingSubscriptionStatus";
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
    assert.match(String(url), /^\/api\/wedding\/subscription(?:\/(?:change|trial))?$/);
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
    fail = true;
    await act(async () => { renderer.update(createElement(Probe, { userId: account })); });
    assert.equal(result!.subscription, undefined, "previous account state stays hidden");
    assert.match(result!.subscriptionError!, /Unable to load/);
    fail = false;
    await act(async () => { result!.retrySubscription(); });
    assert.equal(result!.subscription?.onboardingCompleted, false, "first-time account can onboard after recovery");
  } finally {
    await unmount();
    globalThis.fetch = originalFetch;
  }
});


test("accessible retry recovers, ignores stale account responses and deduplicates writes", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { method: string; resolve: (response: Response) => void }[] = [];
  globalThis.fetch = (_url, init) => new Promise<Response>((resolve) => {
    requests.push({ method: init?.method || "GET", resolve });
  });
  let result: ReturnType<typeof useWeddingSubscription>;
  function Probe({ userId }: { userId?: string }) {
    result = useWeddingSubscription(userId);
    return createElement(WeddingSubscriptionStatus, {
      loading: result.subscriptionLoading,
      error: result.subscriptionError,
      onRetry: result.retrySubscription,
    });
  }
  const respond = (index: number, completed: boolean, status = 200) => requests[index].resolve(new Response(JSON.stringify({
    ok: status === 200, currentTier: "free", status: "inactive", onboardingCompleted: completed,
  }), { status }));
  let renderer: ReactTestRenderer;
  try {
    await act(async () => { renderer = create(createElement(Probe, { userId: "a" })); });
    assert.equal(result!.subscriptionLoading, true);
    assert.equal(renderer!.root.findByProps({ role: "status" }).children.length > 0, true);
    await act(async () => { respond(0, false, 503); });
    assert.equal(result!.subscriptionLoading, false);
    assert.equal(result!.subscription, undefined, "failed reads never default to Free");
    assert.ok(renderer!.root.findByProps({ role: "alert" }));
    const button = renderer!.root.findByType("button");
    assert.deepEqual(button.children, ["Retry loading plan"]);
    await act(async () => { button.props.onClick(); button.props.onClick(); });
    assert.equal(requests.length, 2, "double retry starts one read");
    assert.equal(result!.subscriptionLoading, true);
    assert.equal(renderer!.root.findAllByProps({ role: "alert" }).length, 0);
    await act(async () => { respond(1, false); });
    assert.equal(result!.subscriptionLoading, false);
    assert.equal(result!.subscriptionError, undefined);
    assert.equal(result!.subscription?.onboardingCompleted, false, "onboarding opens only after successful recovery");

    let write: Promise<void>;
    await act(async () => {
      write = result!.selectPlan("free");
      assert.equal(result!.selectPlan("free"), write, "double selection shares the write");
    });
    assert.equal(requests.filter((request) => request.method === "POST").length, 1);
    // Switch away and back before the old write resolves. Account identity alone
    // cannot distinguish this old session from the current request generation.
    await act(async () => { renderer!.update(createElement(Probe, { userId: "b" })); });
    await act(async () => { renderer!.update(createElement(Probe, { userId: "a" })); });
    await act(async () => { respond(4, false); });
    await act(async () => { respond(3, true); });
    assert.equal(result!.subscription?.onboardingCompleted, false, "stale account read is ignored");
    assert.equal(result!.selectPlan("free"), write!, "returning account shares its original pending write");
    let resolved = false;
    void write!.then(() => { resolved = true; });
    await act(async () => { respond(2, true); });
    assert.equal(requests.length, 6, "stale write completion triggers one authoritative GET");
    assert.equal(requests[5].method, "GET");
    assert.equal(result!.subscriptionLoading, true);
    assert.equal(result!.subscription, undefined, "stale response is never applied");
    assert.equal(resolved, false, "selection cannot report success before reconciliation");
    await act(async () => { respond(5, true); await write!; });
    assert.equal(result!.subscription?.onboardingCompleted, true, "successful reconciliation closes onboarding");
    assert.equal(result!.subscriptionLoading, false);
    assert.equal(resolved, true);
    assert.equal(requests.filter((request) => request.method === "POST").length, 1, "read retries never write");
    await act(async () => { renderer!.update(createElement(Probe, {})); });
    assert.equal(result!.subscriptionLoading, false);
    assert.equal(result!.subscription, undefined);
    assert.equal(result!.subscriptionError, undefined);
  } finally {
    await act(async () => { renderer?.unmount(); });
    globalThis.fetch = originalFetch;
  }
});

test("reconciliation failures stay recoverable and stale refreshes cannot affect another account", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const scenario of ["write-fails", "refresh-fails", "switch-during-refresh"] as const) {
      const requests: { method: string; resolve: (response: Response) => void }[] = [];
      globalThis.fetch = (_url, init) => new Promise<Response>((resolve) => {
        requests.push({ method: init?.method || "GET", resolve });
      });
      let result: ReturnType<typeof useWeddingSubscription>;
      function Probe({ userId }: { userId: string }) {
        result = useWeddingSubscription(userId);
        return null;
      }
      const respond = (index: number, completed: boolean, status = 200) => requests[index].resolve(new Response(JSON.stringify({
        ok: status === 200, currentTier: "free", status: "inactive", onboardingCompleted: completed,
      }), { status }));
      let renderer: ReactTestRenderer;
      await act(async () => { renderer = create(createElement(Probe, { userId: "a" })); });
      try {
        await act(async () => { respond(0, false); });
        const write = result!.selectPlan("free");
        // Handle the rejection immediately, including when the refresh is superseded.
        const rejected = assert.rejects(write);
        await act(async () => { renderer!.update(createElement(Probe, { userId: "b" })); });
        await act(async () => { respond(2, false); });
        await act(async () => { renderer!.update(createElement(Probe, { userId: "a" })); });
        await act(async () => { respond(3, false); });
        assert.equal(result!.selectPlan("free"), write);
        if (scenario === "write-fails") {
          await act(async () => { respond(1, false, 503); await rejected; });
          assert.equal(result!.subscription?.onboardingCompleted, false);
          assert.equal(requests.length, 4, "failed writes never trigger successful reconciliation");
        } else {
          await act(async () => { respond(1, true); });
          assert.equal(result!.subscriptionLoading, true);
          if (scenario === "refresh-fails") {
            await act(async () => { respond(4, false, 503); await rejected; });
            assert.equal(result!.subscription, undefined);
            assert.match(result!.subscriptionError!, /could not be reloaded/);
            await act(async () => { result!.retrySubscription(); });
            await act(async () => { respond(5, true); });
            assert.equal(result!.subscription?.onboardingCompleted, true);
            assert.equal(result!.subscriptionError, undefined);
          } else {
            await act(async () => { renderer!.update(createElement(Probe, { userId: "b" })); });
            await act(async () => { respond(5, false); });
            await act(async () => { respond(4, true); await rejected; });
            assert.equal(result!.subscription?.onboardingCompleted, false, "A's refresh cannot overwrite B");
            assert.equal(result!.subscriptionError, undefined);
          }
        }
        assert.equal(requests.filter((request) => request.method === "POST").length, 1, scenario);
      } finally {
        await act(async () => { renderer!.unmount(); });
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("active trial refresh survives failures, throttles after expiration and stops when Free is verified", async (t) => {
  const now = Date.UTC(2026, 9, 26, 12);
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now });
  let reads = 0;
  const active = { ok: true, currentTier: "premium", status: "active", onboardingCompleted: true, trial: { status: "active", eligible: false, tier: "premium", expiresAt: new Date(now + 1000).toISOString(), remainingDays: 1 } };
  t.mock.method(globalThis, "fetch", async () => {
    reads++;
    if (reads === 2) return new Response(JSON.stringify({ ok: false, error: "Temporarily unavailable" }), { status: 503 });
    return new Response(JSON.stringify(reads === 1 ? active : { ...active, currentTier: "free", status: "inactive", trial: { ...active.trial, status: "expired", remainingDays: 0 } }));
  });
  let result!: ReturnType<typeof useWeddingSubscription>;
  function Probe() { result = useWeddingSubscription("owner"); return null; }
  let view!: ReactTestRenderer;
  try {
    await act(async () => { view = create(createElement(Probe)); });
    const verified = result.subscription;
    assert.equal(reads, 1);
    await act(async () => t.mock.timers.tick(999)); assert.equal(reads, 1);
    await act(async () => t.mock.timers.tick(1)); assert.equal(reads, 2);
    assert.equal(result.subscription, verified, "failed refresh must preserve verified same-account state");
    assert.match(result.subscriptionError!, /Unable to load/);
    await act(async () => t.mock.timers.tick(59_000)); assert.equal(reads, 2, "expiration cannot cause a rapid retry loop");
    await act(async () => t.mock.timers.tick(1000)); assert.equal(reads, 3, "failed reads must not stop the timer");
    assert.equal(result.subscription?.currentTier, "free");
    assert.equal(result.subscription?.trial?.status, "expired");
    assert.equal(result.subscription?.trial?.remainingDays, 0);
    assert.equal(result.subscription?.onboardingCompleted, true, "expiration never reopens onboarding");
    assert.equal(result.subscriptionError, undefined);
    await act(async () => t.mock.timers.tick(120_000)); assert.equal(reads, 3);
  } finally { await act(async () => view?.unmount()); t.mock.timers.reset(); }
});

test("trial polling does not overlap writes or leak stale refreshes across account switches/unmount", async (t) => {
  const now = Date.UTC(2026, 9, 26, 12);
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now });
  let account = "a";
  let reads = 0;
  let resolveWrite!: (response: Response) => void;
  let resolveRefresh!: (response: Response) => void;
  const active = { ok: true, currentTier: "elite", status: "active", onboardingCompleted: true, trial: { status: "active", eligible: false, tier: "elite", expiresAt: new Date(now + 600_000).toISOString(), remainingDays: 1 } };
  t.mock.method(globalThis, "fetch", (_url: any, init: any) => {
    if (init?.method === "POST") return new Promise<Response>((resolve) => { resolveWrite = resolve; });
    reads++;
    if (reads === 2) return new Promise<Response>((resolve) => { resolveRefresh = resolve; });
    return Promise.resolve(new Response(JSON.stringify(account === "a" ? active : { ok: true, currentTier: "free", status: "inactive", onboardingCompleted: true })));
  });
  let result!: ReturnType<typeof useWeddingSubscription>;
  function Probe({ userId }: { userId: string }) { result = useWeddingSubscription(userId); return null; }
  let view!: ReactTestRenderer;
  try {
    await act(async () => { view = create(createElement(Probe, { userId: account })); });
    let write!: Promise<void>;
    await act(async () => { write = result.selectPlan("elite"); });
    await act(async () => t.mock.timers.tick(60_000)); assert.equal(reads, 1, "pending write suppresses polling");
    await act(async () => { resolveWrite(new Response(JSON.stringify(active))); await write; });
    await act(async () => t.mock.timers.tick(60_000)); assert.equal(reads, 2);
    await act(async () => t.mock.timers.tick(60_000)); assert.equal(reads, 2, "pending read suppresses polling");
    account = "b";
    await act(async () => view.update(createElement(Probe, { userId: account })));
    assert.equal(result.subscription?.currentTier, "free");
    await act(async () => resolveRefresh(new Response(JSON.stringify(active))));
    assert.equal(result.subscription?.currentTier, "free", "A's late trial cannot overwrite B");
    await act(async () => view.unmount());
    await act(async () => t.mock.timers.tick(180_000)); assert.equal(reads, 3, "unmount leaves no polling work");
  } finally { await act(async () => view?.unmount()); t.mock.timers.reset(); }
});
