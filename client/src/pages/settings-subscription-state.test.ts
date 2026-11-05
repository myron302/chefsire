import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

for (const scenario of [
  { name: "new Premium checkout", currentTier: "free", targetTier: "premium", trial: false, enrollment: "not_enrolled", action: "Upgrade", blocked: false },
  { name: "same-tier Premium cardless trial", currentTier: "premium", targetTier: "premium", trial: true, enrollment: "not_enrolled", action: "Review recurring billing", blocked: false },
  { name: "same-tier Elite cardless trial", currentTier: "elite", targetTier: "elite", trial: true, enrollment: "not_enrolled", action: "Review recurring billing", blocked: false },
  { name: "existing Elite enrollment", currentTier: "elite", targetTier: "elite", trial: true, enrollment: "active", action: "Review recurring billing", blocked: true },
  { name: "unavailable Elite billing status", currentTier: "elite", targetTier: "elite", trial: true, enrollment: "unavailable", action: "Review recurring billing", blocked: true },
  { name: "non-trial current Elite", currentTier: "elite", targetTier: "elite", trial: false, enrollment: "not_enrolled", action: "Review recurring billing", blocked: true },
]) test(`Settings ${scenario.name}: quote eligibility and checkout state`, async () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const cache = join(repo, "node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  const temp = mkdtempSync(join(cache, "settings-checkout-"));
  const dom = new JSDOM('<div id="root"></div>', { url: "https://chefsire.test/settings", pretendToBeVisual: true });
  const fixtureKey = "__chefsireSettingsTest";
  const replacements: Record<string, unknown> = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    location: dom.window.location, history: dom.window.history,
    addEventListener: dom.window.addEventListener.bind(dom.window),
    removeEventListener: dom.window.removeEventListener.bind(dom.window),
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element,
    Node: dom.window.Node, NodeFilter: dom.window.NodeFilter,
    MutationObserver: dom.window.MutationObserver, CustomEvent: dom.window.CustomEvent,
    HTMLInputElement: dom.window.HTMLInputElement,
    getComputedStyle: dom.window.getComputedStyle,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
    [fixtureKey]: {
      session: { user: { id: "sandbox-tester", email: "tester@example.test", username: "tester" }, updateUser() {} },
      toastApi: { toast() {} },
    },
  };
  let cardCreates = 0;
  let cardDestroys = 0;
  let tokenizations = 0;
  Object.assign(dom.window, { Square: { payments: () => ({
    async card() {
      cardCreates++;
      return {
        async attach(selector: string) {
          const field = dom.window.document.createElement("input");
          field.setAttribute("aria-label", "SDK fixture field");
          dom.window.document.querySelector(selector)!.append(field);
        },
        async destroy() { cardDestroys++; },
        async tokenize() { tokenizations++; throw new Error("No payment allowed in this UI regression"); },
      };
    },
  }) } });
  const requests: string[] = [];
  replacements.fetch = async (url: string, init?: RequestInit) => {
    assert.equal(init?.method || "GET", "GET", "this regression must never write payment data");
    requests.push(url);
    const data = url.includes("billing-quote") ? {
      ok: true, billingAvailable: true, tier: scenario.targetTier, amountCents: scenario.targetTier === "elite" ? 4999 : 2499,
      currency: "USD", cadence: "MONTHLY", consentVersion: "test", automaticRenewal: true,
      trialExpiresAt: scenario.trial ? "2026-11-10T14:13:16Z" : null,
      firstChargeStartDate: scenario.trial ? "2026-11-11" : null, requiresExplicitConsent: true,
    } : url.endsWith("card-config") ? {
      ok: true, squareEnvironment: "sandbox", billingLive: false, cardSetupAvailable: true,
      applicationId: "sandbox-test", locationId: "sandbox-location",
    } : url.includes("billing-status") ? {
      ok: true, billingMode: "sandbox", billingLive: false, enrollmentStatus: scenario.enrollment,
    } : url.endsWith("tiers") ? {
      ok: true, tiers: { free: { name: "Free", price: 0 }, premium: { name: "Premium", price: 24.99 }, elite: { name: "Elite", price: 49.99 } },
    } : { ok: true, currentTier: scenario.currentTier, status: scenario.trial ? "active" : "inactive",
      trial: { status: scenario.trial ? "active" : "inactive", expiresAt: scenario.trial ? "2026-11-10T14:13:16Z" : null }, history: [], requests: [] };
    return new Response(JSON.stringify(data));
  };
  const saved = new Map(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const root = createRoot(dom.window.document.getElementById("root")!);
  const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); }); };
  try {
    await build({
      stdin: { contents: "export { default } from './client/src/pages/settings.tsx';", resolveDir: repo, loader: "ts" },
      absWorkingDir: repo, outfile: join(temp, "settings.mjs"), bundle: true,
      platform: "node", format: "esm", packages: "external", jsx: "automatic",
      plugins: [{ name: "settings-session-fixture", setup(b) {
        b.onResolve({ filter: /contexts\/UserContext$|hooks\/use-toast$/ }, ({ path }) => ({ path, namespace: "fixture" }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
          contents: path.endsWith("UserContext")
            ? `export const useUser=()=>globalThis.${fixtureKey}.session;`
            : `export const useToast=()=>globalThis.${fixtureKey}.toastApi;`,
          loader: "js", resolveDir: repo,
        }));
      } }],
    });
    const { default: SettingsPage } = await import(pathToFileURL(join(temp, "settings.mjs")).href);
    const render = () => React.createElement(QueryClientProvider, { client }, React.createElement(SettingsPage));
    await act(async () => root.render(render()));
    const tab = (label: string) => [...dom.window.document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(el => el.textContent === label)!;
    const selectTab = async (label: string) => { await act(async () => tab(label).dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }))); await settle(); };
    await selectTab("Subscription");
    await selectTab("Wedding Planner");
    const upgrade = [...dom.window.document.querySelectorAll<HTMLButtonElement>('button')].find(el => el.textContent?.trim() === scenario.action);
    if (scenario.blocked) {
      assert.equal(upgrade, undefined, "an existing or uncertain enrollment must not offer same-tier checkout");
      const current = [...dom.window.document.querySelectorAll<HTMLButtonElement>('button')].find(el => el.textContent?.trim() === "Current Plan");
      assert.ok(current?.disabled);
      assert.equal(cardCreates, 0); assert.equal(tokenizations, 0);
      assert.equal(requests.some(url => url.includes("billing-quote")), false);
      return;
    }
    assert.ok(upgrade && !upgrade.disabled, "the un-enrolled tester must be able to review recurring terms");
    await act(async () => upgrade.click());
    await settle(); await settle();
    const dialog = dom.window.document.querySelector('[role="dialog"]');
    assert.ok(dialog, "verified billing quote should open");
    if (scenario.trial) {
      assert.match(dialog.textContent || "", /2026-11-11/);
      assert.ok((dialog.textContent || "").includes(scenario.targetTier === "elite" ? "49.99" : "24.99"));
    }
    const card = dom.window.document.querySelector<HTMLInputElement>('[aria-label="SDK fixture field"]');
    assert.ok(card, "actual checkout component should attach the SDK fixture");
    card.value = "in-progress test entry";
    assert.equal(cardCreates, 1);
    // A refreshed session object for the same owner must not close checkout.
    const fixture = replacements[fixtureKey] as { session: { user: { id: string; email: string; username: string } } };
    fixture.session.user = { ...fixture.session.user };
    await act(async () => root.render(render()));
    await settle();
    assert.equal(tab("Wedding Planner").getAttribute("aria-selected"), "true", "parent updates must retain the Wedding tab");
    assert.equal(dom.window.document.querySelector('[role="dialog"]'), dialog, "checkout must stay mounted");
    assert.equal(dom.window.document.querySelector('[aria-label="SDK fixture field"]'), card);
    assert.equal(card.value, "in-progress test entry");
    assert.equal(cardCreates, 1);
    assert.equal(cardDestroys, 0);
    assert.equal(tokenizations, 0);
    assert.ok(requests.some(url => url.includes("billing-quote")));
    // Changing account identity must discard the previous owner's checkout.
    fixture.session.user = { id: "another-owner", email: "other@example.test", username: "other" };
    await act(async () => root.render(render()));
    await settle();
    assert.equal(dom.window.document.querySelector('[role="dialog"]'), null);
    assert.equal(dom.window.document.querySelector('[aria-label="SDK fixture field"]'), null);
    assert.equal(cardDestroys, 1);
    assert.equal(tokenizations, 0);
  } finally {
    await act(async () => root.unmount());
    client.clear(); dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    rmSync(temp, { recursive: true, force: true });
  }
});
