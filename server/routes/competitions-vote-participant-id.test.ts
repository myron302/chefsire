/**
 * The vote route, driven as a real HTTP request, against the participant-id defect Codex found.
 *
 * The bug was not that a bad id was accepted -- it was that the id the server CHECKED and the id the
 * server STORED were allowed to be different values. `String(["valid-id"])` is `"valid-id"`, so the
 * lookup matched a real participant, and then the untouched array went to the driver, which
 * serialised it as the Postgres array literal `{"valid-id"}`. `[["valid-id"]]` stringifies the same
 * way and serialises to `{{"valid-id"}}`. Every representation is a distinct stored value, so every
 * one of them slips past `uniq_vote_per_voter_participant` -- unbounded ballots from one voter, each
 * pointing at a participant row that does not exist.
 *
 * So these tests assert the property, not the code: what reaches `db.insert(competitionVotes)`.
 * There is no Postgres here; `db` is a recording double, and the participant lookup answers with a
 * row whose id is deliberately NOT the string the request sent. A handler that reused the request
 * value would therefore persist the request value and fail -- which is exactly the regression guard
 * this finding needs. Auth is real: tokens are signed with the repository's own `signAuthToken`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { competitions, competitionParticipants, competitionVotes } from "../db/competitions";
import { signAuthToken } from "../lib/jwt-config";

// `import` is hoisted, so these have to be set before anything that reads them is loaded -- and
// `server/db` is read at module scope: it exports `null` without a DATABASE_URL, leaving nothing to
// stand a double on. Hence the dynamic imports below. No connection is ever opened.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://competitions-tests/none";

const { db } = await import("../db");

const VOTER = "voter-user-id";
const COMPETITION = "competition-row-id";
/**
 * The canonical participant row id, and the whole point of the harness: it is what the lookup
 * returns, and it is NOT what any request below sends. Only a handler that persists the value it
 * read back from the database can produce it.
 */
const CANONICAL_PARTICIPANT = "canonical-participant-row-id";
/** What a request sends. Resolves to the row above; never equal to it. */
const REQUESTED_PARTICIPANT = "requested-participant-id";

type Recorded = { kind: "select" | "insert" | "update"; table: unknown; values?: any; params: unknown[] };

let recorded: Recorded[] = [];
/** Rows the participant lookup answers with. Empty models "no such entrant in this competition". */
let participantRows: Array<{ id: string }> = [];
/** Rows the "is the voter already a participant" guard answers with. */
let voterParticipantRows: Array<{ id: string }> = [];

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

/** Which rows a select against `table` resolves to. */
function rowsFor(table: unknown, selectIndex: number): any[] {
  if (table === competitions) {
    return [{ id: COMPETITION, creatorId: "someone-else", status: "judging", timeLimitMinutes: 60, minOfficialVoters: 3 }];
  }
  if (table === competitionParticipants) {
    // The route makes two selects against this table, in order: the voter guard, then the target.
    return selectIndex === 0 ? voterParticipantRows : participantRows;
  }
  return [];
}

function installDatabaseDouble() {
  let participantSelects = 0;
  const anyDb = db as any;

  anyDb.select = (_fields?: unknown) => {
    const call: Recorded = { kind: "select", table: undefined, params: [] };
    const chain: any = {
      from(table: unknown) { call.table = table; return chain; },
      where(clause: unknown) { call.params = paramsOf(clause); return chain; },
      limit() { return chain; },
      offset() { return chain; },
      orderBy() { return chain; },
      groupBy() { return chain; },
      then(resolve: any, reject: any) {
        recorded.push(call);
        const index = call.table === competitionParticipants ? participantSelects++ : -1;
        return Promise.resolve().then(() => rowsFor(call.table, index)).then(resolve, reject);
      },
    };
    return chain;
  };

  anyDb.insert = (table: unknown) => ({
    values(values: any) {
      const call: Recorded = { kind: "insert", table, values, params: [] };
      const chain: any = {
        onConflictDoUpdate() { return chain; },
        onConflictDoNothing() { return chain; },
        returning() { return chain; },
        then(resolve: any, reject: any) {
          recorded.push(call);
          return Promise.resolve([{ id: "inserted-row-id" }]).then(resolve, reject);
        },
      };
      return chain;
    },
  });

  anyDb.update = (table: unknown) => ({
    set(values: any) {
      const call: Recorded = { kind: "update", table, values, params: [] };
      const chain: any = {
        where(clause: unknown) { call.params = paramsOf(clause); return chain; },
        then(resolve: any, reject: any) { recorded.push(call); return Promise.resolve([]).then(resolve, reject); },
      };
      return chain;
    },
  });

  return () => { participantSelects = 0; };
}

const resetSelectCounter = installDatabaseDouble();

// Imported only now, so the router runs against the double from its very first request.
const competitionsRouter = (await import("./competitions")).default;

const app = express();
app.use(express.json());
app.use("/api/competitions", competitionsRouter);
const server = app.listen(0);
await new Promise<void>((resolve) => server.once("listening", () => resolve()));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
test.after(() => server.close());

const token = signAuthToken({ id: VOTER });

async function castVote(body: unknown, headers: Record<string, string> = {}) {
  recorded = [];
  resetSelectCounter();
  participantRows = [{ id: CANONICAL_PARTICIPANT }];
  voterParticipantRows = [];
  const response = await fetch(`${base}/api/competitions/${COMPETITION}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...headers },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

const votesWritten = () => recorded.filter((c) => c.kind === "insert" && c.table === competitionVotes);

// --------------------------------------------------------------------------------------------
// The accepted case, and what it persists
// --------------------------------------------------------------------------------------------

test("a valid string participant id is accepted and persists the CANONICAL row id", async () => {
  const { status, body } = await castVote({
    participantId: REQUESTED_PARTICIPANT,
    presentation: 8,
    creativity: 9,
    technique: 7,
  });
  assert.equal(status, 200, JSON.stringify(body));

  const writes = votesWritten();
  assert.equal(writes.length, 1);
  const values = writes[0].values;

  // The whole finding, as one assertion: the stored id came from the database row, not the request.
  assert.equal(values.participantId, CANONICAL_PARTICIPANT);
  assert.notEqual(values.participantId, REQUESTED_PARTICIPANT);
  assert.equal(typeof values.participantId, "string");

  // ...and the rest of the ballot is canonical or session-derived too.
  assert.equal(values.competitionId, COMPETITION);
  assert.equal(values.voterId, VOTER);
  assert.deepEqual([values.presentation, values.creativity, values.technique], [8, 9, 7]);
});

test("the participant lookup queries the validated string, scoped to this competition", async () => {
  await castVote({ participantId: REQUESTED_PARTICIPANT });
  const lookups = recorded.filter((c) => c.kind === "select" && c.table === competitionParticipants);
  const target = lookups[lookups.length - 1];
  // A plain string, exactly as sent -- not a coerced copy of some other shape -- and the
  // competition row's own id alongside it.
  assert.deepEqual(target.params, [REQUESTED_PARTICIPANT, COMPETITION]);
  for (const param of target.params) assert.equal(typeof param, "string");
});

// --------------------------------------------------------------------------------------------
// Every malformed representation Codex named
// --------------------------------------------------------------------------------------------

const rejected: Array<[string, unknown]> = [
  ["array", [REQUESTED_PARTICIPANT]],
  ["nested array", [[REQUESTED_PARTICIPANT]]],
  ["object with a toString key", { toString: REQUESTED_PARTICIPANT }],
  ["ordinary object", { id: REQUESTED_PARTICIPANT }],
  ["empty object", {}],
  ["number", 42],
  ["boolean true", true],
  ["boolean false", false],
  ["null", null],
  ["empty string", ""],
  ["whitespace-only string", "   "],
];

for (const [label, participantId] of rejected) {
  test(`a participantId given as a ${label} is rejected and writes no vote`, async () => {
    const { status } = await castVote({ participantId });
    assert.equal(status, 400, label);
    assert.equal(votesWritten().length, 0, label);
    // Rejected before the database is consulted for a participant at all.
    assert.equal(recorded.filter((c) => c.kind === "insert").length, 0, label);
  });
}

test("a missing participantId is rejected and writes no vote", async () => {
  const { status } = await castVote({ presentation: 5 });
  assert.equal(status, 400);
  assert.equal(votesWritten().length, 0);
});

test("`[\"valid-id\"]` is rejected even though String() would have resolved it", async () => {
  // The precise bypass: String(["requested-participant-id"]) === "requested-participant-id".
  assert.equal(String([REQUESTED_PARTICIPANT]), REQUESTED_PARTICIPANT);
  assert.equal(String([[REQUESTED_PARTICIPANT]]), REQUESTED_PARTICIPANT);
  for (const shape of [[REQUESTED_PARTICIPANT], [[REQUESTED_PARTICIPANT]]]) {
    const { status } = await castVote({ participantId: shape });
    assert.equal(status, 400);
    assert.equal(votesWritten().length, 0);
  }
});

// --------------------------------------------------------------------------------------------
// Uniqueness integrity: the stuffing attack the finding describes
// --------------------------------------------------------------------------------------------

test("one voter cannot stuff ballots with alternate JSON spellings of one participant", async () => {
  const spellings: unknown[] = [
    [REQUESTED_PARTICIPANT],
    [[REQUESTED_PARTICIPANT]],
    [[[REQUESTED_PARTICIPANT]]],
    { toString: REQUESTED_PARTICIPANT },
  ];
  const persisted: unknown[] = [];
  for (const participantId of spellings) {
    const { status } = await castVote({ participantId });
    assert.equal(status, 400);
    persisted.push(...votesWritten().map((c) => c.values.participantId));
  }
  // Not "they collapse to one row" -- none of them reaches the database at all, so there is no
  // second value for the unique index to have to catch.
  assert.deepEqual(persisted, []);

  // The one well-formed spelling writes one row, and it is the canonical id.
  const { status } = await castVote({ participantId: REQUESTED_PARTICIPANT });
  assert.equal(status, 200);
  assert.deepEqual(votesWritten().map((c) => c.values.participantId), [CANONICAL_PARTICIPANT]);
});

// --------------------------------------------------------------------------------------------
// The rest of the ballot rules, unchanged by this correction
// --------------------------------------------------------------------------------------------

test("a participant that is not an entrant in this competition is rejected", async () => {
  recorded = [];
  resetSelectCounter();
  participantRows = []; // the lookup is scoped to this competition, so a foreign entrant returns nothing
  voterParticipantRows = [];
  const response = await fetch(`${base}/api/competitions/${COMPETITION}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ participantId: "entrant-in-another-competition" }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /not an entrant in this competition/);
  assert.equal(votesWritten().length, 0);
});

test("an entrant in this competition still cannot vote", async () => {
  recorded = [];
  resetSelectCounter();
  voterParticipantRows = [{ id: "the-voter-is-competing" }];
  participantRows = [{ id: CANONICAL_PARTICIPANT }];
  const response = await fetch(`${base}/api/competitions/${COMPETITION}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ participantId: REQUESTED_PARTICIPANT }),
  });
  assert.equal(response.status, 403);
  assert.equal(votesWritten().length, 0);
});

// --------------------------------------------------------------------------------------------
// The PR's original repair, still standing
// --------------------------------------------------------------------------------------------

test("a forged x-user-id with no token is refused, and writes nothing", async () => {
  recorded = [];
  resetSelectCounter();
  participantRows = [{ id: CANONICAL_PARTICIPANT }];
  const response = await fetch(`${base}/api/competitions/${COMPETITION}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": "someone-else" },
    body: JSON.stringify({ participantId: REQUESTED_PARTICIPANT }),
  });
  assert.equal(response.status, 401);
  assert.equal(recorded.filter((c) => c.kind === "insert").length, 0);
});

test("a forged x-user-id alongside a real token does not change the voter", async () => {
  const { status } = await castVote({ participantId: REQUESTED_PARTICIPANT }, { "x-user-id": "someone-else" });
  assert.equal(status, 200);
  assert.equal(votesWritten()[0].values.voterId, VOTER);
});

test("voterId and userId in the body are ignored", async () => {
  const { status } = await castVote({
    participantId: REQUESTED_PARTICIPANT,
    voterId: "someone-else",
    userId: "someone-else",
  });
  assert.equal(status, 200);
  assert.equal(votesWritten()[0].values.voterId, VOTER);
});
