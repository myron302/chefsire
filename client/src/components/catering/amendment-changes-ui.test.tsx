import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// The app compiles JSX with the automatic runtime; under tsx the classic factory has to be reachable before the component loads.
(globalThis as { React?: typeof React }).React = React;
const load = async () => (await import("./AmendmentChanges")).AmendmentChanges;

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => fs.readFileSync(path.join(here, relative), "utf8");
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const terms = (over: Record<string, unknown> = {}) => ({ eventDate: "2099-10-10", guestCount: 100, priceCents: null as number | null, currency: "USD", termsNote: null, ...over });

test("what the counterparty reviews: the currency transition is rendered as text, with a null price", async () => {
  const AmendmentChanges = await load();
  const markup = renderToStaticMarkup(<AmendmentChanges amendment={{ changedFields: ["currency"], before: terms(), after: terms({ currency: "EUR" }) }} />);
  assert.match(text(markup), /Currency: USD → EUR/);
  assert.doesNotMatch(text(markup), /Not specified/);
  assert.equal((markup.match(/<li/g) ?? []).length, 1);
});

test("price + currency render two unmistakable rows, and a null-to-priced move reads correctly", async () => {
  const AmendmentChanges = await load();
  const markup = renderToStaticMarkup(<AmendmentChanges amendment={{ changedFields: ["price_cents", "currency"], before: terms(), after: terms({ priceCents: 50000, currency: "EUR" }) }} />);
  assert.match(text(markup), /Agreed price: Not specified → EUR 500\.00/);
  assert.match(text(markup), /Currency: USD → EUR/);
});

test("provider and customer see the identical change text: the renderer takes no role", async () => {
  const AmendmentChanges = await load();
  const amendment = { changedFields: ["currency" as const], before: terms({ priceCents: 50000 }), after: terms({ priceCents: 50000, currency: "EUR" }) };
  assert.equal(renderToStaticMarkup(<AmendmentChanges amendment={amendment} />), renderToStaticMarkup(<AmendmentChanges amendment={amendment} />));
  assert.match(text(renderToStaticMarkup(<AmendmentChanges amendment={amendment} />)), /Agreed price: USD 500\.00 → EUR 500\.00.*Currency: USD → EUR/);
  assert.doesNotMatch(read("AmendmentChanges.tsx"), /role/i);
});

test("the accept / decline dialog shows the change before its action button, and the editor labels the currency control and honours the billing lock", () => {
  const source = read("BookingAmendments.tsx");
  const dialog = source.slice(source.indexOf("<AlertDialogContent>"));
  assert.ok(dialog.indexOf("<AmendmentChanges amendment={pending} />") > -1 && dialog.indexOf("<AmendmentChanges amendment={pending} />") < dialog.indexOf("<AlertDialogFooter>"));
  assert.match(source, /<AmendmentChanges amendment=\{pending\} \/>[\s\S]*Accept amendment/, "the pending panel lists the change above its buttons");
  assert.match(source, /<Label htmlFor=\{`amend-currency-\$\{bookingId\}`\}>Currency<\/Label>/);
  assert.match(source, /id=\{`amend-currency-\$\{bookingId\}`\}[^>]*disabled=\{propose\.isPending \|\| view\.billingTermsLocked\}[^>]*aria-describedby=\{`amend-currency-help-\$\{bookingId\}`\}/);
  assert.match(source, /Billing has started, so the currency can no longer change/);
  assert.match(source, /autoCapitalize="characters"/);
});
