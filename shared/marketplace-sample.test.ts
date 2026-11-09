import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isSampleProduct, SAMPLE_PRODUCT_IDS } from "./marketplace-sample";

test("sample marker is the seeded id pair, not the title", () => {
  assert.equal(SAMPLE_PRODUCT_IDS.size, 12);
  for (let i = 1; i <= 12; i++) assert.equal(SAMPLE_PRODUCT_IDS.has(`prod-${i}`), true);
  assert.equal(isSampleProduct({ id: "prod-1", sellerId: "user-1" }), true);
  assert.equal(isSampleProduct({ id: "prod-12", sellerId: "user-7" }), true);
  // Real products and sellers have UUIDs; a reused seed-style id under a real seller is not a sample.
  assert.equal(isSampleProduct({ id: "523a4e8f-0fb2-4dac-adec-26a53a4e3ff5", sellerId: "f67903f8-6cde-4d88-8287-5e8f0dc832c0" }), false);
  assert.equal(isSampleProduct({ id: "prod-2", sellerId: "f67903f8-6cde-4d88-8287-5e8f0dc832c0" }), false);
  assert.equal(isSampleProduct({ id: "prod-13", sellerId: "user-1" }), false);
  assert.equal(isSampleProduct(null), false);
});

test("every purchase surface labels sample listings and withholds the buy action", () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const productPage = read("../client/src/pages/marketplace/ProductPage.tsx");
  assert.match(productPage, /canCheckout = !!product && !isSample/);
  assert.match(productPage, /Sample listing/);
  assert.match(productPage, /SAMPLE_LISTING_MESSAGE/);
  assert.match(read("../client/src/pages/checkout/CheckoutPage.tsx"), /isSampleProduct\(data\)/);
  assert.match(read("../client/src/components/store/ProductCard.tsx"), /onAddToCart && !isSample/);
  for (const card of ["MarketplaceProductCard.tsx", "MarketplaceProductListItem.tsx"]) {
    assert.match(read(`../client/src/pages/store/components/${card}`), /Sample listing/);
  }
});
