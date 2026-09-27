import test from "node:test";
import assert from "node:assert/strict";
import { isDigitalMarketplaceProduct, resolveMarketplaceShippingCost } from "./marketplace-fulfillment";

test("isDigitalMarketplaceProduct recognizes every digital signal", () => {
  assert.equal(isDigitalMarketplaceProduct({ isDigital: true, productCategory: "physical" }), true);
  assert.equal(isDigitalMarketplaceProduct({ isDigital: false, productCategory: "digital" }), true);
  assert.equal(isDigitalMarketplaceProduct({ isDigital: false, productCategory: "cookbook" }), true);
  assert.equal(isDigitalMarketplaceProduct({ isDigital: false, productCategory: "course" }), true);
  assert.equal(isDigitalMarketplaceProduct({ isDigital: false, productCategory: "physical" }), false);
  assert.equal(isDigitalMarketplaceProduct({}), false);
});

test("resolveMarketplaceShippingCost never charges shipping for a digital product", () => {
  assert.equal(resolveMarketplaceShippingCost({ isDigital: true, shippingCost: "5.00" }, "shipping"), 0);
  assert.equal(resolveMarketplaceShippingCost({ productCategory: "cookbook", shippingCost: "5.00" }, "shipping"), 0);
});

test("resolveMarketplaceShippingCost charges shipping only for a physical shipped order", () => {
  assert.equal(resolveMarketplaceShippingCost({ productCategory: "physical", shippingCost: "5.00" }, "shipping"), 5);
  assert.equal(resolveMarketplaceShippingCost({ productCategory: "physical", shippingCost: "5.00" }, "local_pickup"), 0);
  assert.equal(resolveMarketplaceShippingCost({ productCategory: "physical", shippingCost: null }, "shipping"), 0);
});
