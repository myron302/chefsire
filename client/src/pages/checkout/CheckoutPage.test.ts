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

test("checkout isolates orders by buyer/product/quantity and ignores obsolete product responses", async () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const cache = join(repo, "node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  const temp = mkdtempSync(join(cache, "marketplace-checkout-"));
  const dom = new JSDOM('<div id="root"></div>', { url: "https://chefsire.test/checkout?productId=first&quantity=1" });
  const session = { user: { id: "buyer-one" } };
  const orders: any[] = [];
  let resolveSlow!: (response: Response) => void;
  let slowSignal: AbortSignal | undefined;
  let resolveOrder!: (response: Response) => void;
  const product = (id: string) => ({ id, name: `Product ${id}`, price: "10.00", inventory: 20, localPickupEnabled: true });
  const globals: Record<string, unknown> = {
    window: dom.window, document: dom.window.document, location: dom.window.location, history: dom.window.history,
    Event: dom.window.Event,
    addEventListener: dom.window.addEventListener.bind(dom.window),
    removeEventListener: dom.window.removeEventListener.bind(dom.window),
    dispatchEvent: dom.window.dispatchEvent.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
    __marketplaceCheckoutTest: { session },
    fetch: async (url: string, options?: RequestInit) => {
      if (url === "/api/orders/checkout") {
        const body = JSON.parse(String(options?.body));
        orders.push(body);
        if (body.productId === "pending-order") return new Promise<Response>(resolve => { resolveOrder = resolve; });
        return Response.json({ ok: true, order: { id: `order-${orders.length}`, totalAmount: "10.00" } });
      }
      const id = url.split("/").pop()!;
      if (id === "slow") {
        slowSignal = options?.signal as AbortSignal;
        return new Promise<Response>(resolve => { resolveSlow = resolve; });
      }
      return Response.json(product(id));
    },
  };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true });
  const root = createRoot(dom.window.document.querySelector("#root")!);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    await build({
      entryPoints: [join(repo, "client/src/pages/checkout/CheckoutPage.tsx")], outfile: join(temp, "checkout.mjs"),
      absWorkingDir: repo, bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic",
      plugins: [{ name: "checkout-fixtures", setup(b) {
        b.onResolve({ filter: /contexts\/UserContext$|hooks\/use-toast$|components\/SquarePaymentForm$|components\/ui\// }, ({ path }) => ({ path, namespace: "fixture" }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ loader: "js", resolveDir: repo, contents:
          path.endsWith("UserContext") ? "export const useUser=()=>globalThis.__marketplaceCheckoutTest.session;" :
          path.endsWith("use-toast") ? "export const useToast=()=>({toast(){}});" :
          path.endsWith("SquarePaymentForm") ? `import React from 'react'; export default p=>React.createElement('div',{'data-payment-order':p.orderId});` :
          `import React from 'react'; ${["Card", "CardContent", "CardHeader", "CardTitle", "Button", "Input", "Label", "RadioGroup", "RadioGroupItem"].map(name => `export const ${name}=({children,onValueChange,...p})=>React.createElement('${name === "Button" ? "button" : name === "Input" ? "input" : "div"}',p,children);`).join("\n")}`,
        }));
      } }],
    });
    const { default: Checkout } = await import(pathToFileURL(join(temp, "checkout.mjs")).href);
    const render = () => React.createElement(QueryClientProvider, { client }, React.createElement(Checkout));
    const advance = async () => {
      const button = [...dom.window.document.querySelectorAll("button")].find(el => el.textContent === "Continue to Payment");
      assert.ok(button, "new purchase must begin at details instead of reusing a prior payment form");
      await act(async () => button.click());
    };
    const navigate = async (search: string) => {
      await act(async () => dom.window.history.pushState(null, "", `/checkout?${search}`));
    };
    const payment = () => dom.window.document.querySelector("[data-payment-order]");
    await act(async () => root.render(render()));
    await advance();
    assert.equal(payment()?.getAttribute("data-payment-order"), "order-1");
    await act(async () => root.render(render()));
    assert.equal(payment()?.getAttribute("data-payment-order"), "order-1", "ordinary rerenders preserve the current order");

    await navigate("productId=first&quantity=2");
    assert.ok(!payment(), "quantity navigation must discard the prior payment form immediately");
    await advance();
    assert.equal(orders[1].quantity, 2);
    assert.notEqual(orders[1].checkoutIdempotencyKey, orders[0].checkoutIdempotencyKey);
    await navigate("productId=second&quantity=1");
    assert.ok(!payment());
    assert.match(dom.window.document.body.textContent!, /Product second/);
    await advance();
    session.user = { id: "buyer-two" };
    await act(async () => root.render(render()));
    assert.ok(!payment(), "another buyer must never inherit a payment form");
    await advance();
    assert.notEqual(orders[3].checkoutIdempotencyKey, orders[2].checkoutIdempotencyKey);

    await navigate("productId=slow&quantity=1");
    await navigate("productId=current&quantity=1");
    await act(async () => resolveSlow(Response.json(product("slow"))));
    assert.match(dom.window.document.body.textContent!, /Product current/);
    assert.doesNotMatch(dom.window.document.body.textContent!, /Product slow/);
    assert.equal(slowSignal?.aborted, true, "obsolete product GET is canceled");
    assert.equal(orders.length, 4, "navigation never creates or pays for another order");

    await navigate("productId=pending-order&quantity=1");
    await advance();
    await navigate("productId=last&quantity=1");
    await act(async () => resolveOrder(Response.json({ ok: true, order: { id: "obsolete-order", totalAmount: "10.00" } })));
    assert.ok(!payment(), "a late order response cannot reopen a previous checkout");
    assert.match(dom.window.document.body.textContent!, /Product last/);
    assert.equal(orders.length, 5, "the uncertain order request is never automatically replayed");
  } finally {
    await act(async () => root.unmount());
    client.clear(); dom.window.close(); rmSync(temp, { recursive: true, force: true });
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
