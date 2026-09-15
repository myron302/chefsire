/**
 * The competition request schemas, exercised directly.
 *
 * `server/routes/competitions-vote-participant-id.test.ts` proves the vote route's behaviour end to
 * end. These are the same rules at the unit level, and they cover the other two mutations and the
 * library read, where the same defect class lived: a value checked in one form and used in another.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  castCompetitionVoteBody,
  competitionLibraryQuery,
  createCompetitionBody,
  firstIssueMessage,
  submitCompetitionEntryBody,
} from "./competition-requests";

/** Every shape that is not a string, including the two that `String()` would have quietly resolved. */
const NOT_A_STRING: Array<[string, unknown]> = [
  ["array", ["valid-id"]],
  ["nested array", [["valid-id"]]],
  ["deeply nested array", [[["valid-id"]]]],
  ["object with a toString key", { toString: "valid-id" }],
  ["ordinary object", { id: "valid-id" }],
  ["empty object", {}],
  ["number", 42],
  ["zero", 0],
  ["boolean true", true],
  ["boolean false", false],
  ["null", null],
];

test("a vote participantId must be a string", () => {
  for (const [label, participantId] of NOT_A_STRING) {
    assert.equal(castCompetitionVoteBody.safeParse({ participantId }).success, false, label);
  }
  for (const blank of ["", " ", "\t", "\n  "]) {
    assert.equal(castCompetitionVoteBody.safeParse({ participantId: blank }).success, false, JSON.stringify(blank));
  }
  assert.equal(castCompetitionVoteBody.safeParse({}).success, false, "absent");
  assert.equal(castCompetitionVoteBody.safeParse({ participantId: undefined }).success, false, "undefined");
});

test("the two array forms that String() resolves are rejected, not coerced", () => {
  // The bypass, stated as an assertion: these stringify to a real id.
  assert.equal(String(["valid-id"]), "valid-id");
  assert.equal(String([["valid-id"]]), "valid-id");
  for (const participantId of [["valid-id"], [["valid-id"]]]) {
    const result = castCompetitionVoteBody.safeParse({ participantId });
    assert.equal(result.success, false);
    // And nothing string-shaped is handed back that a caller could go on to use.
    assert.equal((result as { data?: unknown }).data, undefined);
  }
});

test("a valid participantId is returned trimmed and unchanged otherwise", () => {
  const parsed = castCompetitionVoteBody.parse({ participantId: "  valid-id  ", presentation: 9 });
  assert.equal(parsed.participantId, "valid-id");
  assert.equal(typeof parsed.participantId, "string");
  // Scores pass through untouched; the route clamps them and stores the clamped number.
  assert.equal(parsed.presentation, 9);
});

test("create validates the value it returns, so the checked and stored values cannot differ", () => {
  // The old bounds check coerced for the comparison (`"60" < 15` is false) and then stored the raw
  // field. A numeric string is still accepted -- as a NUMBER.
  const parsed = createCompetitionBody.parse({ timeLimitMinutes: "90", minOfficialVoters: "5" });
  assert.equal(parsed.timeLimitMinutes, 90);
  assert.equal(parsed.minOfficialVoters, 5);
  assert.equal(typeof parsed.timeLimitMinutes, "number");

  // `null` used to pass the bounds check outright (`null < 15` is false) and reach a NOT NULL column.
  assert.equal(createCompetitionBody.safeParse({ timeLimitMinutes: null }).success, false);
  for (const bad of [[60], "abc", "", true, {}, 14, 121, 60.5]) {
    assert.equal(createCompetitionBody.safeParse({ timeLimitMinutes: bad }).success, false, JSON.stringify(bad));
  }
  assert.equal(
    firstIssueMessage(createCompetitionBody.safeParse({ timeLimitMinutes: 500 }).error!),
    "timeLimitMinutes must be between 15 and 120",
    "the message existing clients read is preserved"
  );
});

test("create keeps its defaults and its permissive isPrivate", () => {
  const parsed = createCompetitionBody.parse({});
  assert.deepEqual(parsed, {
    title: null,
    themeName: null,
    recipeId: null,
    isPrivate: false,
    timeLimitMinutes: 60,
    minOfficialVoters: 3,
  });
  // Previously `!!isPrivate`, and it is still the BOOLEAN that comes back, never the raw value.
  for (const [input, expected] of [[1, true], ["yes", true], [0, false], [null, false], [[], true]] as const) {
    assert.equal(createCompetitionBody.parse({ isPrivate: input }).isPrivate, expected, JSON.stringify(input));
  }
});

test("create and submit take text, not arrays or objects", () => {
  for (const [label, value] of NOT_A_STRING) {
    if (value === null) continue; // an explicit null is a legitimate "no value"
    assert.equal(createCompetitionBody.safeParse({ title: value }).success, false, `title ${label}`);
    assert.equal(submitCompetitionEntryBody.safeParse({ dishTitle: value }).success, false, `dishTitle ${label}`);
  }
  const parsed = submitCompetitionEntryBody.parse({ dishTitle: "  Braised short rib  ", dishDescription: "" });
  assert.equal(parsed.dishTitle, "Braised short rib");
  assert.equal(parsed.dishDescription, null);
  assert.equal(parsed.finalDishPhotoUrl, null);
});

test("the library query survives what Express actually puts in req.query", () => {
  // `?theme=a&theme=b` is an array and `?theme[x]=1` is an object; the old cast to
  // Record<string, string> simply asserted otherwise.
  assert.equal(competitionLibraryQuery.safeParse({ theme: ["a", "b"] }).success, false);
  assert.equal(competitionLibraryQuery.safeParse({ creator: ["a"] }).success, false);
  assert.equal(competitionLibraryQuery.safeParse({ q: { $ne: "" } }).success, false);

  // An unparseable date used to reach `timestamp.toISOString()` and throw a RangeError, answering
  // an unauthenticated request with a 500.
  for (const bad of ["not-a-date", ["2020-01-01"], 20200101, {}]) {
    assert.equal(competitionLibraryQuery.safeParse({ dateFrom: bad }).success, false, JSON.stringify(bad));
  }

  const parsed = competitionLibraryQuery.parse({ dateFrom: "2026-01-01", limit: "50", offset: "10", theme: "Brunch" });
  assert.equal(parsed.dateFrom?.toISOString(), new Date("2026-01-01").toISOString());
  assert.equal(parsed.limit, 50);
  assert.equal(parsed.offset, 10);
  assert.equal(parsed.theme, "Brunch");

  // Defaults and bounds match what the route used to compute with Math.max/Math.min.
  assert.deepEqual(
    { ...competitionLibraryQuery.parse({}) },
    { q: null, theme: null, creator: null, dateFrom: null, dateTo: null, limit: 30, offset: 0 }
  );
  assert.equal(competitionLibraryQuery.safeParse({ limit: "500" }).success, false);
  assert.equal(competitionLibraryQuery.safeParse({ offset: "-1" }).success, false);
});
