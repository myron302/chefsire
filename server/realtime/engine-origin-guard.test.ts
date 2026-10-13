/**
 * The engine-level origin guard, against a REAL socket.io/engine.io server (no ChefSire code besides the guard itself).
 *
 * engine.io consults `allowRequest` only for a request WITHOUT a `sid`. Everything after the first request of a session -- polling GET/POST,
 * OPTIONS preflights, the polling->websocket probe upgrade -- carries a sid and used to reach the server with no origin decision at all (verified
 * here by the "allowRequest alone" test, which is the behavior the guard exists to close).
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Server } from "socket.io";
import WebSocket from "ws";
import { engineOriginGuard, installEngineOriginGuard } from "./engine-origin-guard";

const OK = "https://ok.example";
const EVIL = "https://evil.example";

type Reply = { status: number; headers: http.IncomingHttpHeaders; text: string };

async function startServer(options: { guard: boolean; allowRequest: boolean; decide?: (origin: string) => boolean }) {
  const httpServer = http.createServer((_req, res) => { res.statusCode = 404; res.end(); });
  const decide = options.decide ?? ((origin: string) => origin === OK);
  const io = new Server(httpServer, {
    path: "/socket.io",
    ...(options.allowRequest
      ? { allowRequest: (req: http.IncomingMessage, callback: (error: string | null | undefined, success: boolean) => void) => {
          const origin = req.headers.origin;
          return origin === undefined || decide(origin) ? callback(null, true) : callback("origin not allowed", false);
        } }
      : {}),
  });
  if (options.guard) installEngineOriginGuard(io, (_req, origin) => decide(origin));
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
  const port = (httpServer.address() as { port: number }).port;

  const request = (method: string, path: string, headers: Record<string, string | string[]> = {}, body?: string) =>
    new Promise<Reply>((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port, method, path, headers: body === undefined ? headers : { ...headers, "content-length": Buffer.byteLength(body) } }, (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { text += chunk; });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, text }));
      });
      req.on("error", reject);
      req.end(body);
    });

  const sidFrom = (reply: Reply) => /"sid":"([^"]+)"/.exec(reply.text)?.[1] ?? null;
  /** `null` sends no Origin header at all (a default parameter would swallow `undefined`). */
  const newSession = async (origin: string | null = OK) => {
    const reply = await request("GET", "/socket.io/?EIO=4&transport=polling", origin === null ? {} : { Origin: origin });
    return { reply, sid: sidFrom(reply) };
  };

  /** Resolves with how a WebSocket attempt ended: opened (101), or refused with the HTTP status the server wrote. */
  const upgrade = (query: string, headers: Record<string, string> = {}) =>
    new Promise<{ opened: boolean; status?: number; body?: string }>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket${query}`, { headers });
      ws.on("open", () => { ws.close(); resolve({ opened: true }); });
      ws.on("unexpected-response", (_req, res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => resolve({ opened: false, status: res.statusCode, body }));
      });
      ws.on("error", () => resolve({ opened: false }));
    });

  return { io, httpServer, port, request, newSession, upgrade, close: async () => { await io.close(); } };
}

const DENIED = { code: 4, message: "origin not allowed" };

test("allowRequest ALONE decides only the first request of a session: every sid-bearing request from a foreign origin gets through (the gap)", async () => {
  const server = await startServer({ guard: false, allowRequest: true });
  try {
    const { sid } = await server.newSession(OK);
    assert.ok(sid);
    assert.equal((await server.newSession(EVIL)).reply.status, 403, "the first request is checked");
    assert.equal((await server.request("GET", `/socket.io/?EIO=4&transport=polling&sid=${sid}`, { Origin: EVIL })).status, 200);
    assert.equal((await server.request("POST", `/socket.io/?EIO=4&transport=polling&sid=${sid}`, { Origin: EVIL }, "40")).status, 200);
    assert.equal((await server.upgrade(`&sid=${sid}`, { Origin: EVIL })).opened, true, "the probe upgrade is never shown to allowRequest");
  } finally {
    await server.close();
  }
});

for (const withAllowRequest of [true, false]) {
  test(`the guard puts the same decision in front of every engine request (allowRequest ${withAllowRequest ? "also present" : "absent"})`, async () => {
    const server = await startServer({ guard: true, allowRequest: withAllowRequest });
    try {
      // A legitimate session from the allowed origin.
      const { reply, sid } = await server.newSession(OK);
      assert.equal(reply.status, 200);
      assert.ok(sid);

      // The first request from anywhere else.
      for (const origin of [EVIL, "http://ok.example", "capacitor://ok.example", "", "null", `${OK}/`, `${OK}, ${EVIL}`, "OK.example", "https://ok.example:444"]) {
        const first = await server.newSession(origin);
        assert.equal(first.reply.status, 403, JSON.stringify(origin));
        assert.deepEqual(JSON.parse(first.reply.text), DENIED);
        assert.equal(first.sid, null, "no session is established");
        assert.equal(first.reply.headers["access-control-allow-origin"], undefined);
      }

      // Every kind of follow-up request that carries the sid, from a foreign origin.
      const url = `/socket.io/?EIO=4&transport=polling&sid=${sid}`;
      for (const [method, body] of [["GET", undefined], ["POST", "40"], ["OPTIONS", undefined]] as const) {
        const refused = await server.request(method, url, method === "OPTIONS" ? { Origin: EVIL, "Access-Control-Request-Method": "POST" } : { Origin: EVIL }, body);
        assert.equal(refused.status, 403, `${method} with sid from a foreign origin`);
        assert.deepEqual(JSON.parse(refused.text), DENIED);
      }
      const probe = await server.upgrade(`&sid=${sid}`, { Origin: EVIL });
      assert.deepEqual({ opened: probe.opened, status: probe.status }, { opened: false, status: 403 }, "the probe upgrade is refused with a 403, not engine.io's 400");
      assert.deepEqual(JSON.parse(probe.body ?? "null"), DENIED);

      // Direct WebSocket handshakes.
      assert.equal((await server.upgrade("", { Origin: EVIL })).status, 403);
      assert.equal((await server.upgrade("", { Origin: "" })).opened, false);

      // The legitimate session was not harmed, and its own origin still works on every path.
      assert.equal((await server.request("GET", url, { Origin: OK })).status, 200);
      assert.equal((await server.upgrade("", { Origin: OK })).opened, true);
      assert.equal((await server.upgrade(`&sid=${sid}`, { Origin: OK })).opened, true);
    } finally {
      await server.close();
    }
  });
}

test("a request with no Origin is not a browser CORS/WebSocket request and proceeds, on every path", async () => {
  const server = await startServer({ guard: true, allowRequest: true });
  try {
    const { reply, sid } = await server.newSession(null);
    assert.equal(reply.status, 200);
    assert.ok(sid);
    assert.equal((await server.request("GET", `/socket.io/?EIO=4&transport=polling&sid=${sid}`)).status, 200);
    assert.equal((await server.upgrade("")).opened, true);
  } finally {
    await server.close();
  }
});

test("a duplicated Origin header (Node joins the lines with a comma) is refused, not split", async () => {
  const server = await startServer({ guard: true, allowRequest: false });
  try {
    const reply = await server.request("GET", "/socket.io/?EIO=4&transport=polling", { Origin: [OK, EVIL] });
    assert.equal(reply.status, 403);
  } finally {
    await server.close();
  }
});

test("a decision function that throws fails closed on polling and on upgrades, and does not crash the process", async () => {
  const uncaught: unknown[] = [];
  const onUncaught = (error: unknown) => { uncaught.push(error); };
  process.on("uncaughtException", onUncaught);
  const server = await startServer({
    guard: true,
    allowRequest: false,
    decide: () => { throw new Error("policy bug"); },
  });
  try {
    const polling = await server.newSession(OK);
    assert.equal(polling.reply.status, 403);
    const upgrade = await server.upgrade("", { Origin: OK });
    assert.deepEqual({ opened: upgrade.opened, status: upgrade.status }, { opened: false, status: 403 });
    assert.equal((await server.newSession(null)).reply.status, 200, "and the server is still serving");
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(uncaught, []);
  } finally {
    process.off("uncaughtException", onUncaught);
    await server.close();
  }
});

test("a logging hook that throws cannot change the answer or crash", async () => {
  const guard = engineOriginGuard(() => false, () => { throw new Error("logger bug"); });
  const calls: string[] = [];
  const res = new http.ServerResponse(new http.IncomingMessage(null as never));
  (res as unknown as { writeHead: unknown }).writeHead = () => { calls.push("writeHead"); return res; };
  (res as unknown as { end: unknown }).end = () => { calls.push("end"); return res; };
  guard({ headers: { origin: EVIL } } as never, res, () => calls.push("next"));
  assert.deepEqual(calls, ["writeHead", "end"]);
});

test("installing the guard on a server with no engine fails loudly instead of guarding nothing", () => {
  assert.throws(() => installEngineOriginGuard({}, () => true), /engine is not attached/);
  assert.throws(() => installEngineOriginGuard({ engine: {} as never }, () => true), /engine is not attached/);
});
