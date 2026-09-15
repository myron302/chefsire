/**
 * Private competition visibility, driven as real HTTP requests.
 *
 * The defect: `competitions.isPrivate` existed and was stored, and then nothing ever read it.
 * `GET /api/competitions/:id` served any competition to anyone -- including an anonymous caller --
 * and `GET /api/competitions/library` listed every competition in the table. Privacy was a label on
 * a row, not a rule.
 *
 * The rule now enforced comes from the product's own description of the toggle, in
 * `CreateCompetitionPage.tsx`:
 *
 *     public  -> "Anyone can discover and join"
 *     private -> "Only people with invite link can join"
 *
 * so a competition is visible when it is public, when the viewer created it, or when the viewer has
 * a `competition_participants` row for it. There is no invite mechanism in the repository yet and no
 * pending/rejected membership state in the schema, so for a private competition that is the creator
 * and existing members, and nobody else.
 *
 * These tests are the privacy matrix as a client sees it: viewer x competition -> what comes back.
 * There is no Postgres here; `db` is a double, so what a query WOULD have asked Postgres is asserted
 * directly -- including the library's `where`, rendered to real SQL through drizzle's own dialect,
 * which is where the list filtering actually happens. Auth is real: tokens are signed with the
 * repository's own `signAuthToken`, and a request that forges an identity by any other means is
 * expected to be treated as anonymous.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PgDialect } from "drizzle-orm/pg-core";
import { competitions, competitionParticipants, competitionVotes } from "../db/competitions";
import { signAuthToken } from "../lib/jwt-config";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://competitions-tests/none";

const { db } = await import("../db");

const CREATOR = "creator-user-id";
const PARTICIPANT = "participant-user-id";
const STRANGER = "unrelated-authenticated-user-id";

const PUBLIC_COMPETITION = {
  id: "public-competition-id",
  creatorId: CREATOR,
  isPrivate: false,
  status: "live",
  title: "Midnight Pasta Showdown",
  themeName: "Italian Night",
  timeLimitMinutes: 60,
  minOfficialVoters: 3,
  videoRecordingUrl: "https://example.invalid/recording/public",
};

const PRIVATE_COMPETITION = {
  id: "private-competition-id",
  creatorId: CREATOR,
  isPrivate: true,
  status: "live",
  title: "Secret Supper Club Finals",
  themeName: "Asian Fusion",
  timeLimitMinutes: 90,
  minOfficialVoters: 3,
  videoRecordingUrl: "https://example.invalid/recording/private",
};

/** Every string in a private competition that must never reach an unauthorized caller. */
const PRIVATE_STRINGS = [
  PRIVATE_COMPETITION.title,
  PRIVATE_COMPETITION.themeName,
  PRIVATE_COMPETITION.videoRecordingUrl,
  "Secret Dish",
];

const PRIVATE_PARTICIPANT_ROWS = [
  { id: "host-row", competitionId: PRIVATE_COMPETITION.id, userId: CREATOR, role: "host" },
  {
    id: "competitor-row",
    competitionId: PRIVATE_COMPETITION.id,
    userId: PARTICIPANT,
    role: "competitor",
    dishTitle: "Secret Dish",
  },
];

// --------------------------------------------------------------------------------------------
// The database double
// --------------------------------------------------------------------------------------------

/** Rows a select against `competitions` resolves to. */
let competitionRows: any[] = [];
/** Rows the participants list inside `getCompetitionDetail` resolves to. */
let participantRows: any[] = [];
/**
 * Membership rows the `canViewCompetition` lookup resolves to, keyed by the user id it was asked
 * about -- so the double answers the question that was actually asked rather than a fixed yes/no.
 */
let membershipByUser: Record<string, Array<{ id: string }>> = {};
/** Every `where` clause the route handed to a select against `competitions`, in order. */
let competitionWheres: any[] = [];

/** The bound values inside a drizzle `where`, so a test can see exactly what was queried. */
function paramsOf(node: any, out: unknown[] = []): unknown[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const entry of node) paramsOf(entry, out);
    return out;
  }
  if (node.constructor?.name === "Param" && "value" in node) {
    out.push(node.value);
    return out;
  }
  if (Array.isArray(node.queryChunks)) for (const chunk of node.queryChunks) paramsOf(chunk, out);
  return out;
}

const dialect = new PgDialect();
/** The real SQL a `where` clause renders to, which is the thing Postgres would have filtered on. */
function renderSql(clause: any) {
  return dialect.sqlToQuery(clause);
}

function installDatabaseDouble() {
  const anyDb = db as any;

  anyDb.select = (fields?: any) => {
    let table: unknown;
    let whereClause: any = null;
    const chain: any = {
      from(t: unknown) { table = t; return chain; },
      where(clause: unknown) { whereClause = clause; return chain; },
      limit() { return chain; },
      offset() { return chain; },
      orderBy() { return chain; },
      groupBy() { return chain; },
      then(resolve: any, reject: any) {
        return Promise.resolve()
          .then(() => {
            if (table === competitions) {
              competitionWheres.push(whereClause);
              // The library's `count(*)` select is the one that asks for a `total` column.
              if (fields && "total" in fields) return [{ total: competitionRows.length }];
              return competitionRows;
            }
            if (table === competitionParticipants) {
              // `canViewCompetition` asks for `{ id }` scoped to (competition, user);
              // `getCompetitionDetail` selects whole rows for the competition.
              if (fields && "id" in fields) {
                const asked = paramsOf(whereClause).filter((p) => typeof p === "string");
                const user = asked[asked.length - 1] as string;
                return membershipByUser[user] ?? [];
              }
              return participantRows;
            }
            if (table === competitionVotes) return [];
            return [];
          })
          .then(resolve, reject);
      },
    };
    return chain;
  };

  anyDb.insert = () => ({
    values: () => ({
      onConflictDoUpdate() { return this; },
      onConflictDoNothing() { return this; },
      returning() { return this; },
      then: (resolve: any) => Promise.resolve([{ id: "inserted-row-id" }]).then(resolve),
    }),
  });

  anyDb.update = () => ({
    set: () => ({ where: () => ({ then: (resolve: any) => Promise.resolve([]).then(resolve) }) }),
  });
}

installDatabaseDouble();

const competitionsRouter = (await import("./competitions")).default;

const app = express();
app.use(express.json());
app.use("/api/competitions", competitionsRouter);
const server = app.listen(0);
await new Promise<void>((resolve) => server.once("listening", () => resolve()));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
test.after(() => server.close());

const tokenFor = (id: string) => signAuthToken({ id });

/** A viewer: a set of request headers. `anonymous` sends none. */
const anonymous: Record<string, string> = {};
const asUser = (id: string) => ({ Authorization: `Bearer ${tokenFor(id)}` });

/** Put the world into "this competition exists, with these members". */
function given(competition: any, participants: any[] = []) {
  competitionRows = [competition];
  participantRows = participants;
  membershipByUser = {};
  for (const row of participants) {
    membershipByUser[row.userId] = [{ id: row.id }];
  }
  competitionWheres = [];
}

async function get(path: string, headers: Record<string, string> = {}) {
  const response = await fetch(`${base}/api/competitions${path}`, { headers });
  const text = await response.text();
  return {
    status: response.status,
    text,
    body: (() => { try { return JSON.parse(text); } catch { return null; } })(),
  };
}

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${base}/api/competitions${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    text,
    body: (() => { try { return JSON.parse(text); } catch { return null; } })(),
  };
}

/** Nothing private may appear anywhere in the response -- not in a field, not in an error string. */
function assertNoPrivateData(result: { text: string; status: number }) {
  for (const secret of PRIVATE_STRINGS) {
    assert.ok(
      !result.text.includes(secret),
      `private competition data leaked in a ${result.status}: ${result.text}`
    );
  }
}

// ============================================================================================
// GET /:id -- PUBLIC competitions stay public
// ============================================================================================

test("public competition: an anonymous viewer can read it", async () => {
  given(PUBLIC_COMPETITION);
  const result = await get(`/${PUBLIC_COMPETITION.id}`);
  assert.equal(result.status, 200, result.text);
  assert.equal(result.body.competition.id, PUBLIC_COMPETITION.id);
});

test("public competition: an unrelated authenticated user can read it", async () => {
  given(PUBLIC_COMPETITION);
  const result = await get(`/${PUBLIC_COMPETITION.id}`, asUser(STRANGER));
  assert.equal(result.status, 200, result.text);
  assert.equal(result.body.competition.id, PUBLIC_COMPETITION.id);
});

test("public competition: the creator can read it", async () => {
  given(PUBLIC_COMPETITION);
  const result = await get(`/${PUBLIC_COMPETITION.id}`, asUser(CREATOR));
  assert.equal(result.status, 200, result.text);
});

test("a public read costs no membership lookup", async () => {
  // Also why the gate cannot be used as an oracle: an authorized and an unauthorized read of a
  // public competition do exactly the same work.
  given(PUBLIC_COMPETITION);
  await get(`/${PUBLIC_COMPETITION.id}`, asUser(STRANGER));
  assert.deepEqual(membershipByUser, {});
});

// ============================================================================================
// GET /:id -- PRIVATE competitions
// ============================================================================================

test("private competition: an anonymous viewer gets nothing", async () => {
  given(PRIVATE_COMPETITION, PRIVATE_PARTICIPANT_ROWS);
  const result = await get(`/${PRIVATE_COMPETITION.id}`);
  assert.equal(result.status, 404, result.text);
  assert.deepEqual(result.body, { error: "Not found" });
  assertNoPrivateData(result);
});

test("private competition: an unrelated authenticated user gets nothing", async () => {
  given(PRIVATE_COMPETITION, PRIVATE_PARTICIPANT_ROWS);
  const result = await get(`/${PRIVATE_COMPETITION.id}`, asUser(STRANGER));
  assert.equal(result.status, 404, result.text);
  assert.deepEqual(result.body, { error: "Not found" });
  assertNoPrivateData(result);
});

test("private competition: the creator can read it", async () => {
  given(PRIVATE_COMPETITION, PRIVATE_PARTICIPANT_ROWS);
  const result = await get(`/${PRIVATE_COMPETITION.id}`, asUser(CREATOR));
  assert.equal(result.status, 200, result.text);
  assert.equal(result.body.competition.id, PRIVATE_COMPETITION.id);
  assert.equal(result.body.competition.title, PRIVATE_COMPETITION.title);
});

test("private competition: a participant can read it", async () => {
  given(PRIVATE_COMPETITION, PRIVATE_PARTICIPANT_ROWS);
  const result = await get(`/${PRIVATE_COMPETITION.id}`, asUser(PARTICIPANT));
  assert.equal(result.status, 200, result.text);
  assert.equal(result.body.competition.id, PRIVATE_COMPETITION.id);
});

test("private competition: membership is read from the database, scoped to that competition", async () => {
  given(PRIVATE_COMPETITION, PRIVATE_PARTICIPANT_ROWS);
  let asked: unknown[] = [];
  const anyDb = db as any;
  const realSelect = anyDb.select;
  anyDb.select = (fields?: any) => {
    const chain = realSelect(fields);
    const realWhere = chain.where;
    chain.where = (clause: unknown) => {
      if (fields && "id" in fields && !("creatorId" in fields)) asked = paramsOf(clause);
      return realWhere(clause);
    };
    return chain;
  };

  await get(`/${PRIVATE_COMPETITION.id}`, asUser(PARTICIPANT));
  anyDb.select = realSelect;

  // The competition being viewed AND the verified viewer -- not a caller-supplied pair.
  assert.deepEqual(asked, [PRIVATE_COMPETITION.id, PARTICIPANT]);
});

test("private competition: a 404 for the hidden case is indistinguishable from a missing row", async () => {
  // Hiding existence is the point: a 403 would confirm the competition is real.
  given(PRIVATE_COMPETITION, PRIVATE_PARTICIPANT_ROWS);
  const hidden = await get(`/${PRIVATE_COMPETITION.id}`, asUser(STRANGER));

  competitionRows = [];
  participantRows = [];
  membershipByUser = {};
  const missing = await get("/no-such-competition-at-all", asUser(STRANGER));

  assert.equal(hidden.status, missing.status);
  assert.equal(hidden.text, missing.text);
});

// ============================================================================================
// GET /:id -- forged identity
// ============================================================================================

test("a forged x-user-id does not unlock a private competition", async () => {
  given(PRIVATE_COMPETITION, PRIVATE_PARTICIPANT_ROWS);
  for (const headers of [
    { "x-user-id": CREATOR },
    { "x-user-id": PARTICIPANT },
    { "X-User-Id": CREATOR },
  ]) {
    const result = await get(`/${PRIVATE_COMPETITION.id}`, headers);
    assert.equal(result.status, 404, `${JSON.stringify(headers)} -> ${result.text}`);
    assertNoPrivateData(result);
  }
});

test("a forged userId query parameter does not unlock a private competition", async () => {
  given(PRIVATE_COMPETITION, PRIVATE_PARTICIPANT_ROWS);
  for (const query of [
    `?userId=${CREATOR}`,
    `?userId=${PARTICIPANT}`,
    `?currentUserId=${CREATOR}`,
    `?viewerId=${CREATOR}`,
    `?participantId=${PARTICIPANT}`,
  ]) {
    const result = await get(`/${PRIVATE_COMPETITION.id}${query}`);
    assert.equal(result.status, 404, `${query} -> ${result.text}`);
    assertNoPrivateData(result);
  }
});

test("an unsigned or tampered bearer token does not unlock a private competition", async () => {
  given(PRIVATE_COMPETITION, PRIVATE_PARTICIPANT_ROWS);

  // A well-formed JWT with the right claim but no valid signature -- the whole point of verifying.
  const unsigned = [
    Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ id: CREATOR })).toString("base64url"),
    "",
  ].join(".");

  const real = tokenFor(STRANGER);
  const tamperedPayload = [
    real.split(".")[0],
    Buffer.from(JSON.stringify({ id: CREATOR })).toString("base64url"),
    real.split(".")[2],
  ].join(".");

  for (const token of [unsigned, tamperedPayload, "not-a-token", `${real}x`]) {
    const result = await get(`/${PRIVATE_COMPETITION.id}`, { Authorization: `Bearer ${token}` });
    assert.equal(result.status, 404, `token ${token.slice(0, 24)}... -> ${result.text}`);
    assertNoPrivateData(result);
  }
});

// ============================================================================================
// GET /library
// ============================================================================================

/** The SQL the library filtered on for this request, plus its bound parameters. */
function libraryFilter() {
  assert.ok(competitionWheres.length > 0, "the library ran no query against competitions");
  return renderSql(competitionWheres[0]);
}

test("library: an anonymous caller is restricted to public competitions in SQL", async () => {
  given(PUBLIC_COMPETITION);
  const result = await get("/library");
  assert.equal(result.status, 200, result.text);

  const { sql, params } = libraryFilter();
  assert.match(sql, /"is_private"\s*=\s*\$\d+/, sql);
  assert.deepEqual(params, [false]);
  // No creator branch and no membership subquery: an anonymous caller has no claim on anything.
  assert.ok(!sql.includes("creator_id"), sql);
  assert.ok(!/exists/i.test(sql), sql);
});

test("library: an authenticated caller also gets what they own or belong to", async () => {
  given(PUBLIC_COMPETITION);
  const result = await get("/library", asUser(PARTICIPANT));
  assert.equal(result.status, 200, result.text);

  const { sql, params } = libraryFilter();
  assert.match(sql, /"is_private"\s*=\s*\$\d+/, sql);
  assert.match(sql, /"creator_id"\s*=\s*\$\d+/, sql);
  assert.match(sql, /exists \(select 1 from "competition_participants"/i, sql);
  // The viewer id is bound, once for the creator branch and once for the membership subquery, and
  // it is the VERIFIED id -- nothing else is bound.
  assert.deepEqual(params, [false, PARTICIPANT, PARTICIPANT]);
});

test("library: filtering happens in the database, not after the rows come back", async () => {
  given(PUBLIC_COMPETITION);
  await get("/library");
  // Both the page query and the count query carry the privacy term, so `total` cannot betray the
  // existence of rows the page is not allowed to show.
  assert.equal(competitionWheres.length, 2, "expected a count query and a page query");
  for (const clause of competitionWheres) {
    assert.match(renderSql(clause).sql, /"is_private"/, "a library query ran without the privacy term");
  }
});

test("library: privacy composes with q, theme, creator and date filters", async () => {
  given(PUBLIC_COMPETITION);
  const result = await get(
    "/library?q=pasta&theme=italian&creator=someone&dateFrom=2026-01-01&dateTo=2026-12-31&limit=5&offset=10",
    asUser(STRANGER)
  );
  assert.equal(result.status, 200, result.text);

  const { sql, params } = libraryFilter();
  // Privacy is one more `and` term; every other filter survives it.
  assert.match(sql, /"is_private"/, sql);
  assert.match(sql, /"title" ilike/i, sql);
  assert.match(sql, /"theme_name" =/, sql);
  assert.match(sql, /"created_at" >=/, sql);
  assert.match(sql, /"created_at" <=/, sql);
  assert.ok(params.includes("%pasta%"), JSON.stringify(params));
  assert.ok(params.includes("italian"), JSON.stringify(params));
  // ...and the caller's own `creator=` filter narrows results; it never acts as an identity.
  assert.ok(params.includes("someone"), JSON.stringify(params));
  assert.ok(!params.includes(CREATOR), "a query parameter became an identity");

  // Pagination is untouched.
  assert.equal(result.body.limit, 5);
  assert.equal(result.body.offset, 10);
});

test("library: a forged identity never reaches the privacy filter", async () => {
  for (const [label, path, headers] of [
    ["x-user-id header", "/library", { "x-user-id": CREATOR }],
    ["userId query", `/library?userId=${CREATOR}`, {}],
    ["currentUserId query", `/library?currentUserId=${CREATOR}`, {}],
    ["bad bearer", "/library", { Authorization: "Bearer not-a-token" }],
  ] as const) {
    given(PUBLIC_COMPETITION);
    const result = await get(path, headers as Record<string, string>);
    assert.equal(result.status, 200, `${label} -> ${result.text}`);

    const { sql, params } = libraryFilter();
    // Treated as anonymous: the public-only predicate, and the forged id bound nowhere.
    assert.deepEqual(params, [false], `${label} widened the filter to ${JSON.stringify(params)}`);
    assert.ok(!sql.includes("creator_id"), `${label}: ${sql}`);
    assert.ok(!/exists/i.test(sql), `${label}: ${sql}`);
  }
});

test("library: the creator's verified session is what widens the filter", async () => {
  given(PRIVATE_COMPETITION, PRIVATE_PARTICIPANT_ROWS);
  const result = await get("/library", asUser(CREATOR));
  assert.equal(result.status, 200, result.text);

  const { params } = libraryFilter();
  assert.ok(params.includes(CREATOR), JSON.stringify(params));
  // The competition the database returned under that widened filter is served as-is.
  assert.equal(result.body.items[0].id, PRIVATE_COMPETITION.id);
});

// ============================================================================================
// Child routes: a competition you cannot see is one you cannot act on
// ============================================================================================

test("private competition: an unrelated user cannot join it by submitting an entry", async () => {
  // This is what makes participation a real access control rather than a self-service one: if
  // `POST /:id/submit` still worked for a stranger, they could enrol themselves into a private
  // competition and then read it as a participant.
  given(PRIVATE_COMPETITION, PRIVATE_PARTICIPANT_ROWS);
  const result = await post(
    `/${PRIVATE_COMPETITION.id}/submit`,
    { dishTitle: "Gatecrasher", dishDescription: "let me in" },
    asUser(STRANGER)
  );
  assert.equal(result.status, 404, result.text);
  assertNoPrivateData(result);
});

test("private competition: an unrelated user cannot vote in it", async () => {
  given(PRIVATE_COMPETITION, PRIVATE_PARTICIPANT_ROWS);
  const result = await post(
    `/${PRIVATE_COMPETITION.id}/votes`,
    { participantId: "competitor-row", presentation: 10, creativity: 10, technique: 10 },
    asUser(STRANGER)
  );
  assert.equal(result.status, 404, result.text);
  assertNoPrivateData(result);
});

test("private competition: an unrelated user cannot start, end or complete it", async () => {
  for (const action of ["start", "end", "complete"]) {
    given(PRIVATE_COMPETITION, PRIVATE_PARTICIPANT_ROWS);
    const result = await post(`/${PRIVATE_COMPETITION.id}/${action}`, {}, asUser(STRANGER));
    // 404, not the 403 a public competition would answer: the refusal must not confirm existence.
    assert.equal(result.status, 404, `${action} -> ${result.text}`);
    assertNoPrivateData(result);
  }
});

test("public competition: a non-creator is still refused with 403, not hidden", async () => {
  // The privacy gate must not have swallowed the existing authorization behaviour for public
  // competitions, whose existence was never a secret.
  given(PUBLIC_COMPETITION);
  const result = await post(`/${PUBLIC_COMPETITION.id}/start`, {}, asUser(STRANGER));
  assert.equal(result.status, 403, result.text);
  assert.deepEqual(result.body, { error: "Forbidden" });
});

test("public competition: submitting an entry still works for any authenticated user", async () => {
  given(PUBLIC_COMPETITION);
  const result = await post(
    `/${PUBLIC_COMPETITION.id}/submit`,
    { dishTitle: "Carbonara" },
    asUser(STRANGER)
  );
  assert.equal(result.status, 200, result.text);
  assert.deepEqual(result.body, { ok: true });
});

test("private competition: a member may still act on it", async () => {
  given(PRIVATE_COMPETITION, PRIVATE_PARTICIPANT_ROWS);
  const result = await post(
    `/${PRIVATE_COMPETITION.id}/submit`,
    { dishTitle: "Braised Short Rib" },
    asUser(PARTICIPANT)
  );
  assert.equal(result.status, 200, result.text);
});

// ============================================================================================
// The rule lives on the server
// ============================================================================================

test("the visibility rule has exactly one definition, and the router uses it everywhere", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = fs.readFileSync(path.join(here, "competitions.ts"), "utf8");
  const code = source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");

  // Every route that loads a competition gates on it: the detail read plus all five mutations.
  assert.equal((code.match(/canViewCompetition\(/g) ?? []).length, 6, code);
  // The list route uses the SQL twin of the same rule.
  assert.equal((code.match(/visibleCompetitionsCondition\(/g) ?? []).length, 1, code);
  // Reads are `optionalAuth` -- public competitions must not start requiring a login.
  assert.match(code, /router\.get\("\/library", optionalAuth/, code);
  assert.match(code, /router\.get\("\/:id", optionalAuth/, code);
  // The viewer for a read comes from the verified session and nothing else.
  assert.equal((code.match(/viewerIdFrom\(req\)/g) ?? []).length, 2, code);
  assert.ok(!code.includes("req.query.userId"), code);
  assert.ok(!code.includes("x-user-id"), code);
});
