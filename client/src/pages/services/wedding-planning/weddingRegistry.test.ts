import assert from "node:assert/strict";
import test, { after } from "node:test";
import React, { createElement, StrictMode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Render the actual workspace, registry section, subscription hook, and persistence
// hook. Replace only browser integrations and unrelated presentational components.
// No registry state machine or request handler is reimplemented by this harness.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const dir = mkdtempSync(join(cache, "wedding-registry-"));
after(() => rmSync(dir, { recursive: true, force: true }));
const fixtureKey = "__chefsireRegistryValidation";
await build({
  stdin: { contents: `export { WeddingPlanningWorkspace } from './client/src/pages/services/wedding-planning.tsx'; export { WeddingPlanningRegistrySection } from './client/src/pages/services/wedding-planning/components/WeddingPlanningRegistrySection.tsx';`, resolveDir: root, loader: "ts" },
  absWorkingDir: root, outfile: join(dir, "workspace.mjs"), bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic",
  plugins: [{ name: "registry-browser-fixtures", setup(b) {
    b.onResolve({ filter: /contexts\/UserContext$|hooks\/useGoogleMaps$|hooks\/use-toast$|components\/WeddingTrialSelector$|^wouter$/ }, ({ path }) => ({ path, namespace: "browser-fixture" }));
    b.onLoad({ filter: /.*/, namespace: "browser-fixture" }, ({ path }) => ({ contents:
      path.endsWith("UserContext") ? `export const useUser=()=>globalThis.${fixtureKey}.session;` :
      path.endsWith("useGoogleMaps") ? `export const useGoogleMaps=()=>false;` :
      path.endsWith("use-toast") ? `export const useToast=()=>globalThis.${fixtureKey}.toastApi;` :
      path === "wouter" ? `import React from 'react'; export const Link=({children,...p})=>React.createElement('a',p,children);` : `export default function TrialSelector(){return null;}`, loader: "js", resolveDir: root }));
    b.onResolve({ filter: /wedding-planning\/components\/WeddingPlanning[^/]+$/ }, ({ path }) => /WeddingPlanningRegistrySection(?:\.tsx)?$/.test(path) ? undefined : ({ path, namespace: "unrelated-view" }));
    b.onLoad({ filter: /.*/, namespace: "unrelated-view" }, ({ path }) => ({ contents: `export function ${path.split('/').at(-1)}(){return null;}`, loader: "js", resolveDir: root }));
    b.onResolve({ filter: /components\/ui\// }, ({ path }) => ({ path, namespace: "ui-fixture" }));
    b.onLoad({ filter: /.*/, namespace: "ui-fixture" }, () => ({ contents: `import React from 'react'; const tag=(name)=>React.forwardRef(({children,...props},ref)=>React.createElement(name,{...props,ref},children)); export const Card=tag('section'), CardContent=tag('div'), CardHeader=tag('header'), CardTitle=tag('h2'), CardDescription=tag('p'), Button=tag('button'), Input=tag('input'), Badge=tag('span'), Select=tag('select'), Slider=tag('input'), Alert=tag('aside'), AlertDescription=tag('p'), ToastAction=tag('button');`, loader: "js", resolveDir: root }));
  } }],
});
const { WeddingPlanningWorkspace, WeddingPlanningRegistrySection } = await import(pathToFileURL(join(dir, "workspace.mjs")).href);
const link = (id: number) => ({ id, name: `Registry ${id}`, url: `https://example.test/${id}`, icon: "🎁" });
const json = (registryLinks: unknown, status = 200) => new Response(JSON.stringify({ ok: status === 200, registryLinks, error: status === 200 ? undefined : "Database unavailable" }), { status });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

async function setup(tier: "free" | "premium" = "free", strict = false) {
  const savedGlobals = new Map(["window", fixtureKey, "fetch"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const events = new EventTarget();
  const notices: any[] = [];
  const fixture = { session: { user: { id: "a", username: "a" } as any }, toastApi: { toast: (value: any) => notices.push(value) } };
  Object.defineProperty(globalThis, fixtureKey, { configurable: true, value: fixture });
  Object.defineProperty(globalThis, "window", { configurable: true, value: Object.assign(events, {
    location: new URL("https://chefsire.test/services/wedding-planning/registry"),
    setTimeout(fn: (...args: any[]) => void, ms: number) { const timer = setTimeout(fn, ms); timers.add(timer); return timer; }, clearTimeout,
  }) });
  const saved = new Map([["a", [link(1), link(2)]], ["b", [link(9)]]]);
  const deletes: { owner: string; url: string; response: ReturnType<typeof deferred<Response>> }[] = [];
  const reads: { owner: string; response: ReturnType<typeof deferred<Response>> }[] = [];
  const writes: string[] = [];
  let delayReads = false;
  let registryGetCount = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input), owner = fixture.session.user?.id;
    if (init?.method === "DELETE") {
      assert.equal(init.credentials, "include");
      const response = deferred<Response>(); deletes.push({ owner, url, response }); return response.promise;
    }
    if (url === "/api/wedding/registry-links") {
      assert.equal(init?.credentials, "include");
      if (init?.method === "POST") { writes.push(url); return json(saved.get(owner) || []); }
      registryGetCount += 1;
      if (delayReads) { const response = deferred<Response>(); reads.push({ owner, response }); return response.promise; }
      return json(saved.get(owner) || []);
    }
    if (url === "/api/wedding/subscription") return new Response(JSON.stringify({ ok: true, currentTier: tier, status: tier === "free" ? "inactive" : "active", onboardingCompleted: true }));
    if (init?.method === "POST") writes.push(url);
    return new Response(JSON.stringify({ ok: true, guests: [], events: [], tasks: [], tips: [], actions: [], quotes: [] }));
  };
  let view: ReactTestRenderer | undefined;
  const element = () => strict ? createElement(StrictMode, {}, createElement(WeddingPlanningWorkspace, { mode: "registry" })) : createElement(WeddingPlanningWorkspace, { mode: "registry" });
  const mount = async () => { await act(async () => { view = create(element()); }); };
  const unmount = async () => { await act(async () => view?.unmount()); view = undefined; };
  await mount();
  return {
    deletes, reads, notices, writes, saved, fixture,
    getCount: () => registryGetCount,
    props: () => view!.root.findByType(WeddingPlanningRegistrySection).props,
    view: () => view!,
    delayReads: () => { delayReads = true; },
    async switchTo(id: string) { fixture.session.user = { id, username: id }; await act(async () => view!.update(element())); },
    async remove(...ids: number[]) { await act(async () => { for (const id of ids) view!.root.findByType(WeddingPlanningRegistrySection).props.onRemoveRegistry(id); }); },
    async reply(index: number, links: unknown, status = 200) { await act(async () => deletes[index].response.resolve(json(links, status))); },
    mount, unmount,
    async close() {
      await unmount(); for (const timer of timers) clearTimeout(timer);
      for (const [key, descriptor] of savedGlobals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    },
  };
}

test("Free registry UI allows deletion but disables adding, editing and saving", async () => {
  const s = await setup();
  try {
    assert.equal(s.props().canEditRegistry, false);
    const buttons = s.view().root.findByType(WeddingPlanningRegistrySection).findAllByType("button");
    assert.equal(buttons.find((b: any) => b.children.includes("Edit"))!.props.disabled, true);
    assert.equal(buttons.find((b: any) => b.children.includes("Add Another Registry"))!.props.disabled, true);
    await act(async () => { s.props().onAddRegistry(); await s.props().onSaveRegistryLinks(); });
    assert.equal(s.writes.filter((url) => url === "/api/wedding/registry-links").length, 0);
    await s.remove(1); assert.equal(s.deletes.length, 1); await s.reply(0, [link(2)]);
    assert.deepEqual(s.props().registryLinks, [link(2)]);
  } finally { await s.close(); }
});

test("rapid and sequential registry deletions are serialized and preserve the final empty list on reload", async () => {
  const s = await setup();
  try {
    await s.remove(1, 2);
    assert.equal(s.deletes.length, 1, "second request waits for first response");
    await s.reply(0, [link(2)]);
    assert.equal(s.deletes.length, 2);
    assert.deepEqual(s.deletes.map((d) => d.url), ["/api/wedding/registry-links/1", "/api/wedding/registry-links/2"]);
    await s.reply(1, []);
    assert.deepEqual(s.props().registryLinks, []); assert.deepEqual(s.props().registryDraft, []);
    s.saved.set("a", []); await s.unmount(); await s.mount();
    assert.deepEqual(s.props().registryLinks, [], "empty saved array must not revive default registries");
  } finally { await s.close(); }
});

test("account switches discard stale deletion responses and cancel queued requests, including A to B to A", async () => {
  const s = await setup();
  try {
    await s.remove(1, 2); await s.switchTo("b");
    assert.deepEqual(s.props().registryLinks, [link(9)]);
    await s.reply(0, []);
    assert.deepEqual(s.props().registryLinks, [link(9)]); assert.equal(s.deletes.length, 1);
    await s.switchTo("a"); await s.remove(1, 2); await s.switchTo("b"); await s.switchTo("a");
    await s.reply(1, []);
    assert.deepEqual(s.props().registryLinks, [link(1), link(2)]); assert.equal(s.deletes.length, 2, "old queue is never revived");
  } finally { await s.close(); }
});

test("unmount cancels pending registry queue; StrictMode remount starts an independent live queue", async () => {
  const s = await setup("free", true);
  try {
    await s.remove(1, 2); await s.unmount(); await s.mount();
    await s.reply(0, []); assert.equal(s.deletes.length, 1);
    assert.deepEqual(s.props().registryLinks, [link(1), link(2)]);
    await s.remove(2); assert.equal(s.deletes.length, 2);
    await s.reply(1, [link(1)]); assert.deepEqual(s.props().registryLinks, [link(1)]);
  } finally { await s.close(); }
});

test("failed or malformed deletion responses preserve content and do not stall subsequent removals", async () => {
  const s = await setup();
  try {
    await s.remove(1, 2); await s.reply(0, [], 500);
    assert.deepEqual(s.props().registryLinks, [link(1), link(2)]);
    assert.equal(s.notices.at(-1).title, "Remove Failed");
    assert.equal(s.deletes.length, 2); await s.reply(1, [link(1)]);
    await s.remove(1);
    await act(async () => s.deletes[2].response.resolve(new Response("not JSON", { status: 200 })));
    assert.deepEqual(s.props().registryLinks, [link(1)]);
  } finally { await s.close(); }
});

test("late registry GET responses cannot overwrite another account or a remounted component", async () => {
  const s = await setup();
  try {
    s.delayReads(); await s.switchTo("b"); await s.switchTo("a");
    await act(async () => s.reads[1].response.resolve(json([link(4)])));
    await act(async () => s.reads[0].response.resolve(json([link(9)])));
    assert.deepEqual(s.props().registryLinks, [link(4)]);
    await s.switchTo("b"); await s.unmount(); await s.mount();
    await act(async () => s.reads[3].response.resolve(json([link(8)])));
    await act(async () => s.reads[2].response.resolve(json([link(7)])));
    assert.deepEqual(s.props().registryLinks, [link(8)]);
  } finally { await s.close(); }
});

// React Test Renderer 18 does not replay StrictEffects. Use the real DOM renderer
// here to verify cleanup/setup on the SAME mounted instance, not just a new one.
test("React DOM StrictMode effect replay keeps the live deletion queue and cancels obsolete queued requests", async () => {
  const s = await setup();
  const previous = new Map(["window", "document", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://chefsire.test/services/wedding-planning/registry' });
  let root: ReturnType<typeof createRoot> | undefined;
  try {
    await s.unmount();
    Object.defineProperty(globalThis, "window", { configurable: true, value: dom.window });
    Object.defineProperty(globalThis, "document", { configurable: true, value: dom.window.document });
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
    const before = s.getCount();
    root = createRoot(dom.window.document.getElementById("root")!);
    await act(async () => root!.render(createElement(StrictMode, {}, createElement(WeddingPlanningWorkspace, { mode: "registry" }))));
    assert.equal(s.getCount() - before, 2, "StrictMode must actually replay the mount effects");
    const removeButtons = () => [...dom.window.document.querySelectorAll('button[title="Remove"]')];
    await act(async () => {
      for (const button of removeButtons()) button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
    assert.equal(s.deletes.length, 1, "replayed setup must create a usable queue");
    await s.reply(0, [link(2)]);
    assert.equal(s.deletes.length, 2, "queue remains serialized after StrictMode replay");
    await s.reply(1, []);
    assert.equal(removeButtons().length, 0);
    await act(async () => root!.unmount()); root = undefined;
  } finally {
    if (root) await act(async () => root!.unmount());
    // Cancel browser-only persistence timers before closing the temporary DOM.
    dom.window.close();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    await s.close();
  }
});
