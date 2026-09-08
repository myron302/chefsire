import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringFilePageFrom, cateringMessagePageFrom, cateringPageQueryLimit } from "./catering-booking-communication-policy";

/**
 * A `nextCursor` is a promise that an older page exists, and it has to be earned.
 *
 * Reading exactly `limit` rows cannot tell "the page is full and more remain" from "the page is full and that is
 * everything": both look identical from inside the query. Deriving the cursor from a full page alone therefore
 * claims an older page whenever the collection size happens to be a multiple of the page size -- the client fetches
 * it, gets nothing, and either shows a "load older" control that never resolves or renders an empty page.
 *
 * The fix is a `limit + 1` lookahead: the query asks for one row past the page, that row is the evidence, and it is
 * dropped before anything is serialized. These tests cover the whole size lattice around the page boundary, and
 * page through simulated collections the way the routes actually do, using the same keyset rule.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const communicationRoute = fs.readFileSync(path.join(here, "..", "routes", "catering-booking-communication.ts"), "utf8");
const filesRoute = fs.readFileSync(path.join(here, "..", "routes", "catering-booking-files.ts"), "utf8");

type Row = { id: string; createdAt: string };

/** A collection newest-first, exactly as the routes read it: descending `(created_at, id)`. */
function collection(size: number, instant?: string): Row[] {
  return Array.from({ length: size }, (_, index) => {
    const ordinal = size - index;
    return { id: `m${String(ordinal).padStart(3, "0")}`, createdAt: instant ?? new Date(Date.UTC(2026, 8, 1, 0, 0, ordinal)).toISOString() };
  });
}

/**
 * One database read, with the routes' keyset boundary and the routes' row bound. The cursor is the oldest row the
 * previous page served, and the boundary is strictly before it, so the next read starts at the row after it.
 */
function read(all: readonly Row[], cursor: string | null, limit: number): Row[] {
  if (cursor === null) return all.slice(0, cateringPageQueryLimit(limit));
  const at = all.findIndex((row) => row.id === cursor);
  assert.notEqual(at, -1, "a cursor must name a row in the collection");
  return all.slice(at + 1, at + 1 + cateringPageQueryLimit(limit));
}

type Paged = { pages: string[][]; cursors: (string | null)[] };

function pageThrough(all: readonly Row[], limit: number, from: typeof cateringMessagePageFrom | typeof cateringFilePageFrom): Paged {
  const pages: string[][] = [];
  const cursors: (string | null)[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard <= all.length + 2; guard += 1) {
    const { rows, nextCursor } = from(read(all, cursor, limit), limit);
    pages.push(rows.map((row) => row.id));
    cursors.push(nextCursor);
    // The lookahead row is evidence, never content: no page may exceed the limit the client asked for.
    assert.equal(rows.length <= limit, true, `a page served ${rows.length} rows for a limit of ${limit}`);
    if (nextCursor === null) return { pages, cursors };
    cursor = nextCursor;
  }
  throw new Error("pagination did not terminate");
}

/** Every id, exactly once, with no page beyond the last one that carries rows. */
function assertCompleteAndTerminating(paged: Paged, all: readonly Row[], limit: number) {
  const served = paged.pages.flat();
  assert.deepEqual([...served].sort(), all.map((row) => row.id).sort(), "every row must be served exactly once");
  assert.equal(new Set(served).size, served.length, "no row may be served twice");
  assert.equal(paged.cursors[paged.cursors.length - 1], null, "the last page must end pagination");
  const expectedPages = all.length === 0 ? 1 : Math.ceil(all.length / limit);
  assert.equal(paged.pages.length, expectedPages, `expected ${expectedPages} pages for ${all.length} rows at a limit of ${limit}`);
  // No trailing empty page: that is the exact symptom a full-page cursor produces.
  assert.equal(paged.pages.every((page) => all.length === 0 || page.length > 0), true, "no page may come back empty");
}

test("1. the query bound is one row more than the page, and that row is never part of the page", () => {
  assert.equal(cateringPageQueryLimit(1), 2);
  assert.equal(cateringPageQueryLimit(25), 26);
  assert.equal(cateringPageQueryLimit(0), 1);
  // Both list routes ask for it. The bound and the slice come from the same number, so they cannot drift apart.
  assert.equal(communicationRoute.includes(".limit(cateringPageQueryLimit(page.limit));"), true);
  assert.equal(communicationRoute.includes("cateringMessagePageFrom(rows, page.limit)"), true);
  assert.equal(filesRoute.includes(".limit(cateringPageQueryLimit(page.limit));"), true);
  assert.equal(filesRoute.includes("cateringFilePageFrom(rows, page.limit)"), true);
  // And neither route still reads exactly the page size, which is what made a full page indistinguishable.
  assert.equal(communicationRoute.includes(".limit(page.limit);"), false);
  assert.equal(filesRoute.includes(".limit(page.limit);"), false);
});

test("2. an empty collection serves an empty page and no cursor", () => {
  for (const limit of [1, 5, 25]) {
    const { rows, nextCursor } = cateringMessagePageFrom(read(collection(0), null, limit), limit);
    assert.deepEqual(rows, []);
    assert.equal(nextCursor, null, "nothing at all cannot have an older page");
    assert.equal(cateringFilePageFrom(read(collection(0), null, limit), limit).nextCursor, null);
  }
});

test("3. a collection shorter than one page serves everything and offers no cursor", () => {
  const all = collection(3);
  const { rows, nextCursor } = cateringMessagePageFrom(read(all, null, 5), 5);
  assert.equal(rows.length, 3);
  assert.equal(nextCursor, null);
  assert.deepEqual(cateringFilePageFrom(read(all, null, 5), 5).rows.map((row) => row.id), ["m003", "m002", "m001"]);
  assert.equal(cateringFilePageFrom(read(all, null, 5), 5).nextCursor, null);
});

test("4. a collection of exactly one page offers no cursor -- the regression this fix is about", () => {
  for (const limit of [1, 2, 5, 25]) {
    const all = collection(limit);
    const page = cateringMessagePageFrom(read(all, null, limit), limit);
    assert.equal(page.rows.length, limit);
    assert.equal(page.nextCursor, null, `a full page with nothing behind it must not claim an older page (limit ${limit})`);
    assert.equal(cateringFilePageFrom(read(all, null, limit), limit).nextCursor, null);
    // The client's "load older" is driven by that cursor, so it is now closed rather than left open forever.
    assertCompleteAndTerminating(pageThrough(all, limit, cateringMessagePageFrom), all, limit);
    assertCompleteAndTerminating(pageThrough(all, limit, cateringFilePageFrom), all, limit);
  }
});

test("5. one row past a page offers a cursor, and that cursor is the oldest row actually served", () => {
  const limit = 4;
  const all = collection(limit + 1);
  const page = cateringMessagePageFrom(read(all, null, limit), limit);
  assert.equal(page.rows.length, limit);
  // Rendered oldest-to-newest; the oldest served is m002, and m001 is the row the lookahead saw.
  assert.deepEqual(page.rows.map((row) => row.id), ["m002", "m003", "m004", "m005"]);
  assert.equal(page.nextCursor, "m002");
  assert.equal(page.rows.some((row) => row.id === "m001"), false, "the lookahead row must not be served");
  const second = cateringMessagePageFrom(read(all, page.nextCursor, limit), limit);
  assert.deepEqual(second.rows.map((row) => row.id), ["m001"]);
  assert.equal(second.nextCursor, null);
  assertCompleteAndTerminating(pageThrough(all, limit, cateringMessagePageFrom), all, limit);
});

test("6. exactly two pages' worth pages twice and stops -- no empty third page", () => {
  for (const limit of [1, 3, 10]) {
    const all = collection(limit * 2);
    const paged = pageThrough(all, limit, cateringMessagePageFrom);
    assert.equal(paged.pages.length, 2);
    assertCompleteAndTerminating(paged, all, limit);
    assertCompleteAndTerminating(pageThrough(all, limit, cateringFilePageFrom), all, limit);
  }
});

test("7. two pages plus one row pages three times, the last carrying the single remaining row", () => {
  for (const limit of [1, 3, 10]) {
    const all = collection(limit * 2 + 1);
    const paged = pageThrough(all, limit, cateringMessagePageFrom);
    assert.equal(paged.pages.length, 3);
    assert.equal(paged.pages[2].length, 1);
    assertCompleteAndTerminating(paged, all, limit);
    assertCompleteAndTerminating(pageThrough(all, limit, cateringFilePageFrom), all, limit);
  }
});

test("8. messages are always returned oldest-first and files newest-first, at every page size", () => {
  const all = collection(9);
  for (const limit of [1, 2, 4, 9, 20]) {
    for (const page of pageThrough(all, limit, cateringMessagePageFrom).pages) {
      assert.deepEqual(page, [...page].sort(), "a message page renders chronologically");
    }
    for (const page of pageThrough(all, limit, cateringFilePageFrom).pages) {
      assert.deepEqual(page, [...page].sort().reverse(), "a file page stays newest-first");
    }
  }
});

test("9. rows sharing a created_at still page deterministically against the lookahead", () => {
  // Every row carries the same instant, so the id is the whole tiebreak -- the case the (created_at, id) keyset
  // exists for. Paging must still cover the collection exactly once and stop.
  const all = collection(7, "2026-09-01T12:00:00.000Z");
  for (const limit of [1, 3, 7]) {
    assertCompleteAndTerminating(pageThrough(all, limit, cateringMessagePageFrom), all, limit);
    assertCompleteAndTerminating(pageThrough(all, limit, cateringFilePageFrom), all, limit);
  }
  // Seven rows at a page size of seven is an exact fit: no cursor, even though every timestamp is identical.
  assert.equal(cateringMessagePageFrom(read(all, null, 7), 7).nextCursor, null);
});

test("10. a caller that reads only `limit` rows fails closed rather than inventing a cursor", () => {
  // The helpers are the last line of defence: handed a page-sized read with no lookahead they under-offer the
  // cursor. That can only ever hide an older page, never fabricate one -- the safe direction of the two.
  const all = collection(10);
  assert.equal(cateringMessagePageFrom(all.slice(0, 5), 5).nextCursor, null);
  assert.equal(cateringFilePageFrom(all.slice(0, 5), 5).nextCursor, null);
});
