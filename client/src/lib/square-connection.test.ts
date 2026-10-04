import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isSquareAuthorizeUrl,
  squareCallbackMessage,
  squareConnectionPresentation,
  squareDisconnectNotice,
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

test("after a disconnect the provider is told what happened at SQUARE, not just that ChefSire disconnected", () => {
  const revoked = squareDisconnectNotice({ changed: true, providerRevocation: "revoked", providerRevoked: true });
  assert.equal(revoked?.tone, "good");
  assert.match(revoked!.text, /revoked/);

  const shared = squareDisconnectNotice({ changed: true, providerRevocation: "retained_for_shared_connection", providerRevoked: false });
  assert.equal(shared?.tone, "attention");
  assert.match(shared!.text, /Another ChefSire account uses the same Square account/);
  assert.doesNotMatch(shared!.text, /couldn't confirm/, "a deliberate shared connection is not reported as a failure");

  const unconfirmed = squareDisconnectNotice({ changed: true, providerRevocation: "unconfirmed", providerRevoked: false });
  assert.equal(unconfirmed?.tone, "attention");
  assert.match(unconfirmed!.text, /Disconnected from ChefSire/);
  assert.match(unconfirmed!.text, /couldn't confirm that Square has revoked/);
  assert.match(unconfirmed!.text, /may still be active/);
  assert.match(unconfirmed!.text, /remove ChefSire from the connected apps in your Square account/);

  // Nothing to say when nothing changed; no technical internals or secrets in any copy.
  assert.equal(squareDisconnectNotice({ changed: false, providerRevocation: "not_applicable", providerRevoked: false }), null);
  for (const notice of [revoked, shared, unconfirmed]) assert.doesNotMatch(notice!.text, /token|secret|merchant id|error|status \d|payment_methods/i);
});

test("a response without the new field is judged by providerRevoked, and anything unclear WARNS rather than claims success", () => {
  assert.equal(squareDisconnectNotice({ changed: true, providerRevoked: true })?.tone, "good");
  assert.equal(squareDisconnectNotice({ changed: true, providerRevoked: false })?.tone, "attention");
  assert.equal(squareDisconnectNotice({ changed: true })?.tone, "attention");
  assert.equal(squareDisconnectNotice({ changed: true, providerRevocation: "something-new" as never })?.tone, "attention");
});

test("the screen renders the disconnect notice from the server's providerRevocation and does not discard it", () => {
  const page = fs.readFileSync(path.join(root, "client/src/pages/square-connection.tsx"), "utf8");
  assert.match(page, /as Promise<SquareDisconnectResponse>/);
  assert.match(page, /setDisconnectNotice\(squareDisconnectNotice\(data\)\)/);
  assert.match(page, /data-testid="square-disconnect-notice"/);
  assert.match(page, /role=\{disconnectNotice\.tone === "attention" \? "alert" : "status"\}/);
  // Cleared when the provider acts again (connect / reconnect), not on a timer.
  assert.equal((page.match(/setDisconnectNotice\(null\)/g) ?? []).length, 2);
  assert.equal(squareCallbackMessage("?error=authorization_superseded")?.tone, "attention");
});
