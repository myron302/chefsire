/**
 * `GET /api/competitions/library`, driven as a real HTTP request.
 *
 * The defect: Express matches routes in DECLARATION order and `/:id` matches any single segment, so
 * a `/library` declared after `router.get("/:id")` is never reached. `GET /api/competitions/library`
 * ran the DETAIL handler with `id = "library"`, found no competition with that id and answered
 * `404 {"error":"Not found"}`. The endpoint was not broken -- it was unreachable, and it answered
 * plausibly enough to look like an empty archive rather than a routing bug.
 *
 * So these tests assert reachability from the OUTSIDE: which handler answers, judged by the shape of
 * the body, because that is the only thing a client can actually observe. They would have failed on
 * the previous ordering and they fail again if a future static route is added below `/:id`.
 *
 * There is no Postgres here; `db` is a recording double. Auth is real, signed with the repository's
 * own `signAuthToken`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { competitions, competitionParticipants, competitionVotes } from "../db/competitions";

// `import` is hoisted and `server/db` is read at module scope, so these have to be set before
// anything that reads them loads. No connection is ever opened.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://competitions-tests/none";

const { db } = await import("../db");

/** A public competition whose id is a normal uuid-ish string -- nothing like "library". */
const PUBLIC_COMPETITION = {
  id: "competition-row-id",
  creatorId: "creator-user-id",
  isPrivate: false,
  status: "live",
  title: "Midnight Pasta Showdown",
  timeLimitMinutes: 60,
  minOfficialVoters: 3,
};

/** Rows a select against `competitions` resolves to. */
let competitionRows: any[] = [PUBLIC_COMPETITION];
/** How many rows the library's `count(*)` reports. */
let libraryTotal = 0;

function installDatabaseDouble() {
  const anyDb = db as any;

  anyDb.select = (fields?: any) => {
    let table: unknown;
    const chain: any = {
      from(t: unknown) { table = t; return chain; },
      where() { return chain; },
      limit() { return chain; },
      offset() { return chain; },
      orderBy() { return chain; },
      groupBy() { return chain; },
      then(resolve: any, reject: any) {
        return Promise.resolve()
          .then(() => {
            if (table === competitions) {
              // The library's `count(*)` select is the one that asks for a `total` column.
              return fields && "total" in fields ? [{ total: libraryTotal }] : competitionRows;
            }
            // `canViewCompetition` asks for `{ id }`; `getCompetitionDetail` selects whole rows.
            if (table === competitionParticipants) return [];
            if (table === competitionVotes) return [];
            return [];
          })
          .then(resolve, reject);
      },
    };
    return chain;
  };
}

installDatabaseDouble();

// Imported only now, so the router runs against the double from its very first request.
const competitionsRouter = (await import("./competitions")).default;

const app = express();
app.use(express.json());
app.use("/api/competitions", competitionsRouter);
const server = app.listen(0);
await new Promise<void>((resolve) => server.once("listening", () => resolve()));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
test.after(() => server.close());

async function get(path: string) {
  const response = await fetch(`${base}/api/competitions${path}`);
  return { status: response.status, body: await response.json().catch(() => null) };
}

/**
 * Which handler answered, judged only by the response body.
 *
 * The library answers `{items,total,limit,offset}`; the detail handler answers
 * `{competition,participants,voteTallies,media}`. A 404 from the detail handler is exactly what the
 * shadowed `/library` used to produce, so "404" is itself a meaningful verdict here.
 */
function handlerOf(body: any): "library" | "detail" | "detail-404" | "health" | "unknown" {
  if (!body || typeof body !== "object") return "unknown";
  if ("items" in body && "limit" in body && "offset" in body) return "library";
  if ("competition" in body && "participants" in body) return "detail";
  if ("scope" in body) return "health";
  if (body.error === "Not found") return "detail-404";
  return "unknown";
}

// --------------------------------------------------------------------------------------------
// The finding
// --------------------------------------------------------------------------------------------

test("GET /library reaches the library handler, not the detail handler", async () => {
  competitionRows = [];
  libraryTotal = 0;

  const { status, body } = await get("/library");

  assert.equal(status, 200, JSON.stringify(body));
  // The whole finding as one assertion: before the fix this was `detail-404`.
  assert.equal(handlerOf(body), "library", JSON.stringify(body));
  assert.deepEqual(body, { items: [], total: 0, limit: 30, offset: 0 });
});

test('GET /library is never interpreted as a competition whose id is "library"', async () => {
  // The detail handler is made to answer with a real competition for ANY id it is given. If
  // `/library` still reached it, this request would come back with that competition -- which is the
  // sharper version of the bug: not a 404, but another user's competition served under `/library`.
  competitionRows = [PUBLIC_COMPETITION];
  libraryTotal = 1;

  const { status, body } = await get("/library");

  assert.equal(status, 200);
  assert.equal(handlerOf(body), "library");
  assert.ok(!("competition" in body), "the detail handler answered /library");
  assert.equal(body.total, 1);
});

test("the library still accepts its own filters once it is reachable", async () => {
  competitionRows = [];
  libraryTotal = 0;

  const filtered = await get("/library?theme=italian&q=pasta&limit=5&offset=10");
  assert.equal(filtered.status, 200);
  assert.equal(handlerOf(filtered.body), "library");
  assert.equal(filtered.body.limit, 5);
  assert.equal(filtered.body.offset, 10);

  // And still rejects a malformed one with the library's own 400 rather than a detail 404.
  const bad = await get("/library?limit=999");
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /limit must be between 1 and 100/);
});

// --------------------------------------------------------------------------------------------
// ...without breaking the parameterized route it used to be swallowed by
// --------------------------------------------------------------------------------------------

test("GET /:id still reaches the detail handler", async () => {
  competitionRows = [PUBLIC_COMPETITION];

  const { status, body } = await get(`/${PUBLIC_COMPETITION.id}`);

  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(handlerOf(body), "detail");
  assert.equal(body.competition.id, PUBLIC_COMPETITION.id);
});

test("GET /:id for an id that does not exist still answers 404", async () => {
  competitionRows = [];

  const { status, body } = await get("/no-such-competition");

  assert.equal(status, 404);
  assert.deepEqual(body, { error: "Not found" });
});

test("GET /health still reaches the health handler", async () => {
  competitionRows = [PUBLIC_COMPETITION];

  const { status, body } = await get("/health");

  assert.equal(status, 200);
  assert.equal(handlerOf(body), "health");
  assert.deepEqual(body, { ok: true, scope: "competitions" });
});

// --------------------------------------------------------------------------------------------
// The ordering rule itself, so the next static route cannot repeat the mistake
// --------------------------------------------------------------------------------------------

test("every static route is declared before the first /:id route", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const source = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "competitions.ts"),
    "utf8"
  );

  const declared = [
    ...source.matchAll(/router\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g),
  ].map((m, index) => ({ order: index, method: m[1], path: m[2] }));

  // Sanity: the routes this rule is about are actually present.
  const paths = declared.map((d) => d.path);
  assert.ok(paths.includes("/library"), paths.join(", "));
  assert.ok(paths.includes("/health"), paths.join(", "));
  assert.ok(paths.includes("/:id"), paths.join(", "));

  const firstParameterized = declared.find((d) => d.path.startsWith("/:"));
  assert.ok(firstParameterized, "no parameterized route found");

  // A static route is one with no `:` segment and something after the leading slash. `POST /` is
  // the collection itself and cannot be shadowed by `/:id`, so it is not part of this rule.
  const shadowed = declared.filter(
    (d) => d.path.length > 1 && !d.path.includes(":") && d.order > firstParameterized!.order
  );
  assert.deepEqual(
    shadowed.map((d) => `${d.method} ${d.path}`),
    [],
    "static route declared after /:id -- it will be matched as an :id value"
  );
});

test("the fix is route ordering, not an id special case in the detail handler", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const source = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "competitions.ts"),
    "utf8"
  );

  // Comment lines stripped -- this rule is about code, not the prose that explains the rule.
  const code = source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");

  // A guard like `if (id === "library")` would make this pass for `/library` alone and leave the
  // next static route to rediscover the whole finding.
  for (const forbidden of ['=== "library"', "=== 'library'", '!== "library"']) {
    assert.ok(!code.includes(forbidden), `detail handler special-cases an id: ${forbidden}`);
  }
});
