import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isSquareAuthorizeUrl,
  squareCallbackMessage,
  squareConnectionPresentation,
  type SquareConnectionState,
  type SquareConnectionStatus,
} from "./square-connection";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const status = (state: SquareConnectionState, extra: Partial<SquareConnectionStatus> = {}): SquareConnectionStatus => ({
  state, connected: state !== "not_connected" && state !== "configuration_error", paymentReady: state === "active",
  needsReauthorization: state === "needs_reauthorization", merchantDisplayName: "Test Catering Co", locationDisplayName: "Main Kitchen", ...extra,
});

test("each state the server can report has distinct, honest copy and the right actions", () => {
  const cases: Array<[SquareConnectionState, string, string[]]> = [
    ["not_connected", "Not connected", ["connect"]],
    ["active", "Connected", ["disconnect"]],
    ["needs_reauthorization", "Needs reconnect", ["reconnect", "disconnect"]],
    ["no_payment_location", "Connected, but no eligible payment location", ["recheck", "reconnect", "disconnect"]],
    ["verification_unavailable", "Can't confirm right now", ["recheck", "disconnect"]],
    ["configuration_error", "Unavailable", []],
  ];
  const labels = new Set<string>();
  for (const [state, label, actions] of cases) {
    const view = squareConnectionPresentation(status(state));
    assert.equal(view.label, label, state);
    assert.deepEqual([...view.actions], actions, state);
    labels.add(view.label);
  }
  assert.equal(labels.size, cases.length);
  assert.equal(squareConnectionPresentation(null).actions.length, 0);
});

test("a connected account names the merchant and location; a not-connected one shows neither", () => {
  assert.match(squareConnectionPresentation(status("active")).detail, /Test Catering Co/);
  assert.match(squareConnectionPresentation(status("active")).detail, /Main Kitchen/);
  assert.doesNotMatch(squareConnectionPresentation(status("not_connected", { merchantDisplayName: null, locationDisplayName: null })).detail, /Test Catering|Main Kitchen/);
});

test("callback messages are fixed text for known codes and silent for anything else", () => {
  assert.equal(squareCallbackMessage("?connected=true")?.tone, "good");
  for (const code of ["merchant_mismatch", "scopes_insufficient", "square_auth_failed", "callback_failed", "square_not_configured"]) {
    assert.equal(squareCallbackMessage(`?error=${code}`)?.tone, "attention", code);
  }
  assert.equal(squareCallbackMessage("?error=<script>alert(1)</script>"), null);
  assert.equal(squareCallbackMessage(""), null);
});

test("the browser only ever navigates to Square's own authorize URL", () => {
  assert.equal(isSquareAuthorizeUrl("https://connect.squareup.com/oauth2/authorize?client_id=x&state=y"), true);
  assert.equal(isSquareAuthorizeUrl("https://connect.squareupsandbox.com/oauth2/authorize?x=1"), true);
  for (const bad of ["http://connect.squareup.com/oauth2/authorize", "https://evil.example/oauth2/authorize", "https://connect.squareup.com.evil.example/oauth2/authorize", "https://connect.squareup.com/other", "javascript:alert(1)", "", null, undefined, 42]) {
    assert.equal(isSquareAuthorizeUrl(bad), false, String(bad));
  }
});

test("the provider screen has no customer payment, checkout, refund, payout or fee surface and handles no secret", () => {
  const files = ["client/src/pages/square-connection.tsx", "client/src/lib/square-connection.ts"].map((file) => fs.readFileSync(path.join(root, file), "utf8"));
  const code = files.join("\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const forbidden of [">Pay", "Pay now", "Pay online", "Checkout", "paymentLink", "payment-session", "refund", "Refund", "payout dashboard", "platform fee", "Platform fee", "accessToken", "refreshToken", "sqenc", "localStorage", "sessionStorage"]) {
    assert.equal(code.includes(forbidden), false, forbidden);
  }
  // Every call goes to the signed-in user's own connection endpoints: no id of any kind is sent.
  assert.deepEqual([...code.matchAll(/apiRequest\("(GET|POST)", ([A-Z_]+)/g)].map((match) => `${match[1]} ${match[2]}`).sort(),
    ["GET SQUARE_CONNECTION_START_PATH", "GET SQUARE_CONNECTION_STATUS_PATH", "POST SQUARE_CONNECTION_DISCONNECT_PATH", "POST SQUARE_CONNECTION_RECHECK_PATH"]);
  assert.match(files[0], /min-h-11/, "touch-friendly targets for mobile");
});
