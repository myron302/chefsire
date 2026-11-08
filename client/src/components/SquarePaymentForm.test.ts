import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

test("Marketplace awaits the Square SDK, mounts the card once, and accepts only completed capture", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://chefsire.test/checkout" });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string, options?: RequestInit) => {
      if (url === "/api/payments/square-config") {
        return Response.json({ config: { applicationId: "sandbox-sq0idb-fixture", locationId: "test-location" } });
      }
      assert.equal(url, "/api/payments/create-payment");
      assert.equal(options?.method, "POST");
      assert.deepEqual(JSON.parse(String(options?.body)), { orderId: "order-fixture", sourceId: "fixture-token" });
      calls++;
      return Response.json({ ok: true, payment: { status: calls === 1 ? "APPROVED" : "COMPLETED" } });
    },
  };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true });
  let calls = 0;
  let attachments = 0;
  let destroys = 0;
  let successes = 0;
  Object.assign(dom.window, {
    Square: {
      payments(applicationId: string) {
        assert.equal(applicationId, "sandbox-sq0idb-fixture");
        return {
          async card() {
            return {
              async attach(element: HTMLElement) {
                assert.ok(element.isConnected, "the SDK must receive a mounted container");
                attachments++;
                element.append(dom.window.document.createElement("input"));
              },
              async tokenize() { return { status: "OK", token: "fixture-token" }; },
              async destroy() { destroys++; },
            };
          },
        };
      },
    },
  });
  const root = createRoot(dom.window.document.querySelector("#root")!);
  try {
    const { default: SquarePaymentForm } = await import("./SquarePaymentForm");
    await act(async () => root.render(React.createElement(SquarePaymentForm, {
      orderId: "order-fixture", amount: 10, onPaymentSuccess: () => successes++,
    })));
    for (let i = 0; i < 30 && attachments === 0; i++) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
    }
    assert.equal(attachments, 1);
    const pay = dom.window.document.querySelector("button")!;
    assert.equal(pay.disabled, false);
    await act(async () => { pay.click(); pay.click(); });
    assert.equal(calls, 1);
    assert.equal(successes, 0);
    await act(async () => pay.click());
    assert.equal(calls, 2);
    assert.equal(successes, 1);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
  assert.equal(destroys, 1);
});
