import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The feed's Daily Quests and AI Suggestions widgets once called /api/quests/daily/<userId> and
// /api/suggestions/today/<userId>, which don't exist (the server reads the user from the session), so both widgets
// always failed with 404. They also shared a React Query key with their full pages, which cache a different shape.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("feed widgets call the session-scoped endpoints the server actually serves", () => {
  const quests = read("./DailyQuests.tsx");
  const suggestions = read("./AISuggestions.tsx");
  assert.ok(quests.includes('>("/api/quests/daily")'), "DailyQuests fetches /api/quests/daily");
  assert.ok(suggestions.includes('>("/api/suggestions/today")'), "AISuggestions fetches /api/suggestions/today");
  assert.doesNotMatch(quests + suggestions, /\/api\/(quests\/daily|suggestions\/today)\/\$\{/);

  assert.match(read("../../../server/routes/quests.ts"), /router\.get\("\/daily", requireAuth/);
  assert.match(read("../../../server/routes/suggestions.ts"), /router\.get\("\/today", requireAuth/);
});

test("widgets and full pages never share a cache entry of a different shape", () => {
  assert.match(read("./DailyQuests.tsx"), /queryKey: \["\/api\/quests\/daily", user\?\.id, "feed-widget"\]/);
  assert.match(read("./AISuggestions.tsx"), /queryKey: \["\/api\/suggestions\/today", user\?\.id, "feed-widget"\]/);
  assert.match(read("../pages/QuestsPage.tsx"), /queryKey: \["\/api\/quests\/daily", user\?\.id\]/);
  assert.match(read("../pages/SuggestionsPage.tsx"), /queryKey: \["\/api\/suggestions\/today", user\?\.id\]/);
});
