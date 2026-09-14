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
  assert.ok(votes.includes("eq(competitionParticipants.id, String(participantId ?? \"\"))"), votes);
  assert.ok(votes.includes("eq(competitionParticipants.competitionId, compId)"), votes);
  assert.ok(votes.includes("is not an entrant in this competition."), votes);
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
