/**
 * TRUST_PROXY parsing and the shared trusted-peer decision.
 *
 * Express reads `trust proxy` in surprising ways -- the STRING "1" is compiled as the IP address 0.0.0.1 (trust nobody, silently), "true" throws,
 * 1.5 trusts two hops, Infinity trusts everything -- so the environment value is parsed strictly here and only a number, `false` or an array of
 * vetted strings ever reaches `app.set`. The standalone trust function used by the Socket.IO layer (which has no Express app) is pinned to the
 * real application's, so the two cannot disagree.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { DEFAULT_TRUST_PROXY, isTrustedProxyPeer, resolveTrustProxy, trustFunctionFor, TrustProxyConfigError, type TrustProxySetting } from "./proxy-trust";

const resolve = (value: string | undefined) => resolveTrustProxy(value === undefined ? {} : ({ TRUST_PROXY: value } as NodeJS.ProcessEnv));

test("unset or blank keeps today's behavior: one hop", () => {
  for (const value of [undefined, "", "   ", "\t"]) {
    const resolution = resolve(value);
    assert.equal(resolution.setting, DEFAULT_TRUST_PROXY);
    assert.equal(resolution.setting, 1);
    assert.equal(resolution.source, "default");
  }
});

test("hop counts are passed to Express as NUMBERS, never as strings", () => {
  for (const [raw, expected] of [["1", 1], [" 2 ", 2], ["8", 8]] as const) {
    const resolution = resolve(raw);
    assert.equal(resolution.setting, expected);
    assert.equal(typeof resolution.setting, "number", "the string '1' would be compiled as the IP address 0.0.0.1");
  }
});

test("'false', 'off', 'none' and '0' trust nobody", () => {
  for (const raw of ["false", "FALSE", "off", "no", "none", "0"]) assert.equal(resolve(raw).setting, false, raw);
});

test("address lists become arrays of vetted entries with lowercase keywords", () => {
  assert.deepEqual(resolve("loopback").setting, ["loopback"]);
  assert.deepEqual(resolve("LOOPBACK, 10.0.0.0/8").setting, ["loopback", "10.0.0.0/8"]);
  assert.deepEqual(resolve("203.0.113.7  2001:db8::/32 uniquelocal").setting, ["203.0.113.7", "2001:db8::/32", "uniquelocal"]);
  assert.deepEqual(resolve("linklocal,loopback").setting, ["linklocal", "loopback"]);
});

test("trusting every hop, out-of-range counts and unparsable values refuse to resolve, naming the variable and never echoing a long value", () => {
  for (const raw of [
    "true", "TRUE", "on", "yes", "all", "*",
    "9", "100", "99999999999999999999", "-1", "1.5", "1e3", "NaN", "Infinity",
    "foo", "loopbak", "127.1", "0x7f000001", "1.2.3", "10.0.0.0/0", "10.0.0.0/33", "::/0", "10.0.0.0/255.0.0.0", "10.0.0.0/8/8", "fe80::1%eth0",
    ",", "loopback,,10.0.0.1", ",loopback", "loopback,", "http://127.0.0.1", "127.0.0.1:80", "localhost",
    Array.from({ length: 70 }, (_, i) => `10.0.${i}.1`).join(","),
  ]) {
    assert.throws(() => resolve(raw), (error: unknown) => {
      assert.ok(error instanceof TrustProxyConfigError, raw);
      assert.match((error as Error).message, /TRUST_PROXY/);
      assert.ok((error as Error).message.length < 400);
      return true;
    }, raw.slice(0, 40));
  }
});

test("every resolvable value is accepted by Express and compiles to a function", () => {
  for (const raw of ["1", "3", "false", "loopback", "10.0.0.0/8", "127.0.0.1", "::1", "loopback, linklocal, uniquelocal", "192.168.0.0/16, 2001:db8::/32"]) {
    const { setting } = resolve(raw);
    const app = express();
    assert.doesNotThrow(() => app.set("trust proxy", setting), raw);
    assert.equal(typeof app.get("trust proxy fn"), "function");
  }
});

const ADDRESSES = ["127.0.0.1", "::1", "::ffff:127.0.0.1", "10.1.2.3", "203.0.113.9", "2001:db8::5", undefined] as const;
const SETTINGS: TrustProxySetting[] = [1, 2, false, ["loopback"], ["10.0.0.0/8"], ["127.0.0.1"], ["loopback", "10.0.0.0/8"], ["203.0.113.9"]];

test("the standalone trust function is identical to the one Express compiles for the same setting", () => {
  for (const setting of SETTINGS) {
    const real = express();
    real.set("trust proxy", setting);
    const expressFn = real.get("trust proxy fn") as (a: string | undefined, hop: number) => boolean;
    const ours = trustFunctionFor(setting);
    for (const address of ADDRESSES) for (const hop of [0, 1, 2]) {
      assert.equal(ours(address, hop), expressFn(address, hop), `${JSON.stringify(setting)} ${String(address)} hop ${hop}`);
    }
  }
});

test("the real application and the Socket.IO layer agree on who is a trusted proxy", async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL ||= "postgres://u:p@proxy-trust-tests.invalid/none";
  const { default: app } = await import("../app");
  const appFn = app.get("trust proxy fn") as (a: string | undefined, hop: number) => boolean;
  const env = {} as NodeJS.ProcessEnv; // TRUST_PROXY unset: the application's own default
  for (const address of ADDRESSES) assert.equal(isTrustedProxyPeer(address, env), appFn(address, 0), String(address));
});

test("hop-count trust vouches for any direct peer including a Unix-socket peer with no address; address lists never do", () => {
  const hop = { TRUST_PROXY: "1" } as NodeJS.ProcessEnv;
  for (const address of ADDRESSES) assert.equal(isTrustedProxyPeer(address, hop), true, `hop ${String(address)}`);

  const loopback = { TRUST_PROXY: "loopback" } as NodeJS.ProcessEnv;
  assert.equal(isTrustedProxyPeer("127.0.0.1", loopback), true);
  assert.equal(isTrustedProxyPeer("::1", loopback), true);
  assert.equal(isTrustedProxyPeer("::ffff:127.0.0.1", loopback), true);
  assert.equal(isTrustedProxyPeer("203.0.113.9", loopback), false);
  assert.equal(isTrustedProxyPeer(undefined, loopback), false, "a Unix-socket peer has no address, and an address list cannot vouch for no address");

  assert.equal(isTrustedProxyPeer("127.0.0.1", { TRUST_PROXY: "false" } as NodeJS.ProcessEnv), false);
  assert.equal(isTrustedProxyPeer("10.5.5.5", { TRUST_PROXY: "10.0.0.0/8" } as NodeJS.ProcessEnv), true);
  assert.equal(isTrustedProxyPeer("127.0.0.1", { TRUST_PROXY: "10.0.0.0/8" } as NodeJS.ProcessEnv), false);
});

test("an unusable TRUST_PROXY at request time means 'not trusted' and never throws", () => {
  for (const raw of ["true", "banana", "9"]) {
    assert.doesNotThrow(() => isTrustedProxyPeer("127.0.0.1", { TRUST_PROXY: raw } as NodeJS.ProcessEnv));
    assert.equal(isTrustedProxyPeer("127.0.0.1", { TRUST_PROXY: raw } as NodeJS.ProcessEnv), false);
  }
});
