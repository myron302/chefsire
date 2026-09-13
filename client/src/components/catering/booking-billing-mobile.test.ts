import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * MOBILE FIRST, asserted rather than asserted-to.
 *
 * Financial controls are the worst place for a desktop-only affordance: a caterer recording a payment is often
 * standing in a venue with a phone. There is no DOM harness in this suite, so these are source-level checks of the
 * properties that actually break at 320px -- touch target height, single-column stacking, wrapping, and no
 * fixed-width or dialog-only control.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "BookingBilling.tsx"), "utf8");

test("every interactive control is at least a 44px touch target", () => {
  const controls = [...component.matchAll(/<(Button|Input|select)\b[^>]*>/g)].map((match) => match[0]);
  assert.ok(controls.length >= 10, `expected the whole surface: ${controls.length}`);
  for (const control of controls) {
    assert.ok(control.includes("min-h-11"), control.replace(/\s+/g, " ").slice(0, 120));
  }
});

test("every grid stacks to ONE column on a phone and only widens from `sm`", () => {
  for (const grid of [...component.matchAll(/className="[^"]*\bgrid\b[^"]*"/g)].map((match) => match[0])) {
    // Unprefixed, so `sm:grid-cols-2` is fine and a bare `grid-cols-2` -- two columns at 320px -- is not.
    assert.equal(/(?<![:\w-])grid-cols-[2-9]\b/.test(grid), false, `a fixed multi-column grid: ${grid}`);
    if (/grid-cols/.test(grid)) assert.ok(/\bsm:grid-cols-/.test(grid), grid);
  }
});

test("rows wrap instead of overflowing when a long currency meets a long amount", () => {
  // Every flex row that holds a value and a badge wraps, and every text container may shrink below its content.
  const rows = [...component.matchAll(/className="[^"]*\bflex\b[^"]*"/g)].map((match) => match[0])
    .filter((row) => row.includes("justify-between") || row.includes("gap-2"));
  assert.ok(rows.length >= 5);
  for (const row of rows) assert.ok(row.includes("flex-wrap"), row);
  assert.ok((component.match(/min-w-0/g) ?? []).length >= 4, "so a long value can shrink rather than push the row wide");
});

test("amounts are tabular and allowed to break, so they line up and never overflow", () => {
  assert.ok((component.match(/tabular-nums/g) ?? []).length >= 6);
  assert.ok((component.match(/break-words/g) ?? []).length >= 5);
});

test("no fixed pixel width, no horizontal scroll and no viewport-wide minimum anywhere", () => {
  for (const forbidden of ["w-[", "min-w-[", "overflow-x", "whitespace-nowrap"]) {
    assert.equal(component.includes(forbidden), false, forbidden);
  }
});

test("the payment form is an inline form, not a dialog or drawer", () => {
  // A dialog would be one more thing to get right on a small screen, and there is nothing here that needs one.
  for (const forbidden of ["Dialog", "Drawer", "Sheet", "Popover", "Modal"]) {
    assert.equal(component.includes(forbidden), false, forbidden);
  }
  assert.ok(component.includes("<form onSubmit={submitPayment}"));
});

test("every input is labelled, and the private field says it is private", () => {
  const inputs = [...component.matchAll(/<(?:Input|select) id="([\w-]+)"/g)].map((match) => match[1]);
  assert.ok(inputs.length >= 6, inputs.join(", "));
  for (const id of inputs) {
    assert.ok(component.includes(`htmlFor="${id}"`), `no label for ${id}`);
  }
  assert.ok(component.includes("Only you can see this."));
});

test("loading, error and pending states are all rendered rather than left blank", () => {
  assert.ok(component.includes('<p role="status">Loading payment details…</p>'));
  assert.ok(component.includes('role="alert"'));
  assert.ok(component.includes("Retry loading payments"));
  // Every control is disabled while a write is in flight, so nothing can be fired twice by an impatient tap.
  assert.ok((component.match(/disabled=\{pending\}/g) ?? []).length >= 4);
});

test("the amount fields ask for a numeric keypad", () => {
  assert.ok((component.match(/inputMode="decimal"/g) ?? []).length >= 3);
  // And the dates use the platform's own date control rather than a custom picker.
  assert.ok((component.match(/type="date"/g) ?? []).length >= 2);
});

test("a destructive action is confirmed before it is taken", () => {
  assert.ok(component.includes('window.confirm("Withdraw this request?'));
  assert.ok(component.includes('window.confirm("Take back this recorded payment?'));
});
