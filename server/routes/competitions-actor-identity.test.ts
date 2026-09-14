/**
 * Competitions identity, kept as a test.
 *
 * The defect was a habit, not a single endpoint: `requireUserId` accepted `req.headers["x-user-id"]`
 * whenever no session was present, and no competition route mounted an auth middleware. Anyone who
 * could reach the API could therefore create, start, end, submit to, vote in and finalize a
 * competition as any user id they cared to type.
 *
 * These assertions are structural, over the source of the router, so a route added later that picks
 * the habit back up fails here rather than in production.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => fs.readFileSync(path.join(here, ...p), "utf8");

const route = read("competitions.ts");
const routeIndex = read("index.ts");

/** The router source with comment lines stripped -- these rules are about code, not prose. */
const code = route
  .split("\n")
  .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
  .join("\n");

/** Every `router.<method>("path"` declaration with the middleware name that follows it. */
function declarations(source: string) {
  return [
    ...source.matchAll(/router\.(get|post|put|patch|delete)\(\s*("[^"]+")\s*,\s*([A-Za-z_]+)/g),
  ].map((m) => ({ method: m[1], path: m[2], middleware: m[3] }));
}

test("every competition mutation is authenticated", () => {
  const mutations = declarations(route).filter((d) => d.method !== "get");
  assert.deepEqual(
    mutations.map((d) => `${d.method} ${d.path}`),
    [
      'post "/"',
      'post "/:id/start"',
      'post "/:id/end"',
      'post "/:id/submit"',
      'post "/:id/votes"',
      'post "/:id/complete"',
    ]
  );
  for (const d of mutations) {
    assert.equal(d.middleware, "requireAuth", `${d.method} ${d.path}`);
  }
});

test("the router never accepts a caller-supplied identity", () => {
  for (const forbidden of [
    'headers["x-user-id"]',
    "x-user-id",
    "req.body.userId",
    "body.userId",
    "req.query.userId",
    "query.currentUserId",
    "currentUserId",
  ]) {
    assert.ok(!code.includes(forbidden), `identity taken from ${forbidden}`);
  }
  // The helper that used to read the header is gone, not merely unused.
  assert.ok(!route.includes("requireUserId"), "requireUserId still present");
});

test("the actor is resolved in exactly one place, from the session", () => {
  const identitySources = [
    ...code.matchAll(/(?:const|let)\s+\w*(?:[Uu]serId|voterId|actorId|creatorId)\s*=\s*([^;]+);/g),
  ].map((m) => m[1].trim());
  assert.ok(identitySources.length >= 6, identitySources.join(" | "));
  for (const source of identitySources) {
    assert.equal(source, "actorId(req)", `actor derived from ${source}`);
  }

  // `actorId` itself reads the verified session and nothing else, and fails closed.
  const helper = route.slice(route.indexOf("function actorId"), route.indexOf("function clamp1to10"));
  assert.ok(helper.includes("(req.user as { id?: string } | undefined)?.id"), helper);
  assert.ok(helper.includes("throw new ApiError(401"), helper);
  assert.ok(!helper.includes("headers"), helper);
});

test("a ballot may only name an entrant in the competition being voted on", () => {
  // `participantId` is caller-supplied and is the id `/complete` later writes placements back onto,
  // so an unchecked one would let a vote steer another competition's scoring.
  const votes = route.slice(route.indexOf('router.post("/:id/votes"'), route.indexOf('router.post("/:id/complete"'));
  assert.ok(votes.includes("eq(competitionParticipants.id, body.participantId)"), votes);
  assert.ok(votes.includes("eq(competitionParticipants.competitionId, comp.id)"), votes);
  assert.ok(votes.includes("is not an entrant in this competition."), votes);
});

test("the vote route persists the canonical participant row id, never the request value", () => {
  // The defect this closes: the lookup was done on `String(participantId ?? "")` -- which resolves
  // `["id"]` and `[["id"]]` to the same real participant -- while the insert stored the ORIGINAL
  // value, which the driver serialises as `{"id"}` / `{{"id"}}`. Checked value and stored value
  // have to be the same value, and the only way to guarantee that is to store what came back.
  const votes = code.slice(code.indexOf('router.post("/:id/votes"'), code.indexOf('router.post("/:id/complete"'));
  assert.ok(votes.includes("participantId: target.id,"), votes);
  assert.ok(!votes.includes("String(participantId"), "String() coercion is back");
  // `body.participantId` appears exactly once -- inside the lookup -- and never again once the
  // participant has been resolved.
  assert.equal((votes.match(/body\.participantId/g) ?? []).length, 1);
  const afterLookup = votes.slice(votes.indexOf("const pv = clamp1to10"));
  // Downstream of the lookup, `participantId` only ever appears as the column being written or the
  // canonical value being written into it -- never as anything derived from the request.
  for (const line of afterLookup.split("\n").filter((l) => l.includes("participantId"))) {
    assert.ok(
      line.trim() === "participantId: target.id," || line.trim() === "competitionVotes.participantId,",
      `request value reused after validation: ${line.trim()}`
    );
  }
});

test("every client-supplied body and query is parsed by a schema before use", () => {
  // Each mutation that takes a body, and the one read that takes a query, goes through `parsed(...)`
  // -- so no handler holds an un-narrowed copy of the request to reach for by mistake.
  for (const call of [
    "parsed(createCompetitionBody, req.body ?? {}, res)",
    "parsed(submitCompetitionEntryBody, req.body ?? {}, res)",
    "parsed(castCompetitionVoteBody, req.body ?? {}, res)",
    "parsed(competitionLibraryQuery, req.query ?? {}, res)",
  ]) {
    assert.ok(route.includes(call), call);
  }
  // The old destructure-then-use shapes are gone, including the bounds check that coerced for the
  // comparison and then stored the raw field.
  for (const forbidden of [
    "} = req.body || {}",
    "req.query as Record<string, string>",
    "if (timeLimitMinutes < 15",
    "isPrivate: !!isPrivate",
    "dishTitle ?? null",
  ]) {
    assert.ok(!route.includes(forbidden), forbidden);
  }
});

test("a mutation addresses its competition by the row it loaded, not the path segment", () => {
  // `req.params.id` is what FINDS the competition; everything downstream of that lookup -- updates,
  // inserts, the vote scoping, the detail re-read -- uses `comp.id` from the row itself.
  const uses = code.split("\n").filter((line) => line.includes("compId"));
  for (const line of uses) {
    assert.ok(
      /const compId = req\.params\.id;$/.test(line.trim()) ||
        /^\.where\(eq\(competitions\.id, compId\)\)$/.test(line.trim()),
      `compId used somewhere other than the lookup it feeds: ${line.trim()}`
    );
  }
  // Five mutations load a competition by path segment; each then works from `comp.id`.
  assert.equal(uses.filter((l) => l.includes("req.params.id")).length, 5);
  assert.equal(uses.filter((l) => l.includes("eq(competitions.id, compId)")).length, 5);
  assert.ok(code.includes("eq(competitionVotes.competitionId, comp.id)"), code);
  assert.ok(code.includes("getCompetitionDetail(comp.id)"), code);
});

test("every handler binds the error it reports on", () => {
  // The file previously caught `error` and then read `err`, so any failure inside a competition
  // handler raised a ReferenceError instead of the intended 404/409 -- including the auth failure.
  const caught = [...route.matchAll(/catch \((\w+)(?::\s*any)?\)/g)].map((m) => m[1]);
  assert.ok(caught.length >= 9, caught.join(", "));
  for (const name of caught) {
    assert.equal(name, "err", `catch (${name}) -- handlers reference \`err\``);
  }
  assert.ok(!route.includes("catch (error)"), "catch (error) with an `err` body");
});

test("the competitions router is still mounted under /competitions", () => {
  assert.ok(routeIndex.includes('r.use("/competitions", competitionsRouter);'), routeIndex);
});
