import test from "node:test";
import assert from "node:assert/strict";
import { competitionLibraryStats } from "./competition-library-stats";
import { fallbackTo, isPlaceholderSrc } from "../../lib/image-fallback";

const rows = (status: string, n: number) => Array.from({ length: n }, () => ({ status }));

test("more than 100 competitions: total comes from the server and status counts are flagged partial", () => {
  const loaded = [...rows("live", 10), ...rows("judging", 20), ...rows("completed", 30), ...rows("upcoming", 40)];
  assert.equal(loaded.length, 100);
  const stats = competitionLibraryStats(loaded, 250);
  assert.equal(stats.total, 250);
  assert.equal(stats.live, 10);
  assert.equal(stats.judging, 20);
  assert.equal(stats.champions, 30);
  assert.equal(stats.partial, true);
});

test("all competitions loaded: counts are complete, not partial", () => {
  const stats = competitionLibraryStats([...rows("live", 2), ...rows("completed", 1)], 3);
  assert.deepEqual(stats, { total: 3, live: 2, judging: 0, champions: 1, partial: false });
});

test("no server total (or a bad one) falls back to the loaded row count", () => {
  assert.equal(competitionLibraryStats(rows("live", 4), null).total, 4);
  assert.equal(competitionLibraryStats(rows("live", 4), Number.NaN).total, 4);
  assert.equal(competitionLibraryStats([], 0).partial, false);
});

function fakeImg(src: string) {
  const img = {
    attrs: { src } as Record<string, string>,
    getAttribute(name: string) { return this.attrs[name] ?? null; },
    set src(value: string) { this.attrs.src = value; },
    get src() { return this.attrs.src; },
  };
  return img;
}

test("image fallback swaps a broken image for the placeholder", () => {
  const onError = fallbackTo("/placeholder.svg");
  const img = fakeImg("/uploads/missing.jpg");
  onError({ currentTarget: img } as any);
  assert.equal(img.getAttribute("src"), "/placeholder.svg");
});

test("image fallback works again after a reused <img> gets a new broken src", () => {
  const onError = fallbackTo("/placeholder.svg");
  const img = fakeImg("/uploads/first.jpg");
  onError({ currentTarget: img } as any);
  img.src = "/uploads/second.jpg"; // React reuses the element for another image
  onError({ currentTarget: img } as any);
  assert.equal(img.getAttribute("src"), "/placeholder.svg");
});

test("image fallback never loops when the placeholder itself fails", () => {
  const onError = fallbackTo("/placeholder.svg");
  const img = fakeImg("/placeholder.svg");
  onError({ currentTarget: img } as any);
  assert.equal(img.getAttribute("src"), "/placeholder.svg");
  assert.equal(isPlaceholderSrc("https://chefsire.com/placeholder.svg", "/placeholder.svg"), true);
  assert.equal(isPlaceholderSrc("/uploads/a.jpg", "/placeholder.svg"), false);
});
