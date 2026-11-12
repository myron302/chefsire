import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

test("seller dashboard discards another owner's private state and pending reads, retaining same-owner drafts", async () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const cache = join(repo, "node_modules/.cache"); mkdirSync(cache, { recursive: true });
  const temp = mkdtempSync(join(cache, "seller-owner-"));
  const session: { user: { id: string } | null; loading: boolean; updateUser: () => void } = {
    user: { id: "seller-a" }, loading: false, updateUser() {},
  };
  const calls: string[] = [];
  let resolveSlow!: (response: Response) => void;
  let slowSignal: AbortSignal | undefined;
  const store = (id: string) => ({ store: { id: `store-${id}`, name: `Private store ${id}`, handle: id, published: false }, socialProof: { marker: `Private proof ${id}` } });
  const globals = {
    window: { location: new URL("https://chefsire.test/store/dashboard") },
    __sellerDashboardTest: { session },
    fetch: async (url: string, options?: RequestInit) => {
      assert.ok(!options?.method || options.method === "GET", "this regression must never mutate data");
      calls.push(url);
      if (url === "/api/stores/user/seller-b") return Response.json({ error: "No store" }, { status: 404 });
      if (url === "/api/stores/user/slow") {
        slowSignal = options?.signal as AbortSignal;
        return new Promise<Response>(resolve => { resolveSlow = resolve; });
      }
      if (url.startsWith("/api/stores/user/")) return Response.json(store(url.split("/").pop()!));
      if (url.includes("/products")) return Response.json({ products: [{ id: url, name: `Private products ${url}`, isActive: true }] });
      if (url.endsWith("/stats")) return Response.json({ stats: { totalViews: 1, totalSales: 1, totalRevenue: 10 } });
      if (url === "/api/subscriptions/my-tier") return Response.json({ currentTier: "free" });
      if (url.startsWith("/api/orders/my-sales")) return Response.json({ sales: [] });
      throw Error(`Unexpected request: ${url}`);
    },
  };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true });
  let view: ReactTestRenderer | undefined;
  try {
    await build({
      entryPoints: [join(repo, "client/src/pages/store/StoreDashboard.tsx")], outfile: join(temp, "dashboard.mjs"),
      absWorkingDir: repo, bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic",
      plugins: [{ name: "seller-session-fixtures", setup(b) {
        b.onResolve({ filter: /^wouter$|contexts\/UserContext$|hooks\/use-toast$|components\/ui\/tabs$|StoreDashboard[^/]*$|StoreReadinessPanel$|StoreDropsTab$|SubscriptionPlansModal$|UnifiedStoreCustomizer$/ }, ({ path }) => {
          if (path.endsWith("StoreDashboard.tsx")) return;
          return { path, namespace: "fixture" };
        });
        b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ loader: "js", resolveDir: repo, contents:
          path === "wouter" ? "export const useLocation=()=>['/store/dashboard',()=>{}];" :
          path.endsWith("UserContext") ? "export const useUser=()=>globalThis.__sellerDashboardTest.session;" :
          path.endsWith("use-toast") ? "export const useToast=()=>({toast(){}});" :
          path.endsWith("tabs") ? `import React from 'react';${["Tabs", "TabsContent", "TabsList", "TabsTrigger"].map(name => `export const ${name}=React.forwardRef(({children,...p},ref)=>React.createElement('div',{...p,ref},children));`).join("\n")}` :
          path.endsWith("UnifiedStoreCustomizer") ? `import React from 'react';export default function Editor(p){const [value,setValue]=React.useState('');return React.createElement('input',{'data-store':p.store.id,value,onChange:e=>setValue(e.target.value)});}` :
          path.endsWith("StoreDashboardLoadingState") ? "import React from 'react';export default ()=>React.createElement('p',null,'Loading seller dashboard');" :
          path.endsWith("StoreDashboardEmptyState") ? "import React from 'react';export default ()=>React.createElement('p',null,'Create your store');" :
          `import React from 'react';export default p=>React.createElement('section',null,JSON.stringify(p));`,
        }));
      } }],
    });
    const { default: Dashboard } = await import(pathToFileURL(join(temp, "dashboard.mjs")).href);
    await act(async () => { view = create(React.createElement(Dashboard)); });
    const text = () => JSON.stringify(view!.toJSON());
    const rerender = async () => { await act(async () => view!.update(React.createElement(Dashboard))); };
    assert.match(text(), /Private store seller-a/);
    await act(async () => view!.root.findByType("input").props.onChange({ target: { value: "unsaved storefront draft" } }));
    session.user = { id: "seller-a" }; await rerender();
    assert.equal(view!.root.findByType("input").props.value, "unsaved storefront draft");

    session.user = { id: "seller-b" }; await rerender();
    assert.doesNotMatch(text(), /seller-a|unsaved storefront draft/, "a new seller without a store must not inherit the previous seller's store");
    assert.match(text(), /Create your store/);

    session.user = { id: "slow" }; await rerender();
    session.user = { id: "seller-d" }; await rerender();
    await act(async () => resolveSlow(Response.json(store("slow"))));
    assert.match(text(), /Private store seller-d/);
    assert.doesNotMatch(text(), /Private store slow|Private proof slow/);
    assert.equal(slowSignal?.aborted, true);
    assert.ok(!calls.includes("/api/marketplace/sellers/slow/products"), "an obsolete store read must not continue loading its downstream data");

    session.user = null; await rerender();
    assert.match(text(), /Sign in to manage your store/);
    assert.doesNotMatch(text(), /Private store|Private products/);
  } finally {
    if (view) await act(async () => view!.unmount());
    rmSync(temp, { recursive: true, force: true });
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
