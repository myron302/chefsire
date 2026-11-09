import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Launch-journey audit: signed out, /store/dashboard sat on "Loading your store..." forever (its loader only runs for
// a signed-in user) and /messages showed "Error: Failed to load threads (401)". Both now offer a sign-in link.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("store dashboard offers sign-in instead of loading forever when signed out", () => {
  const src = read("./store/StoreDashboard.tsx");
  assert.match(src, /loading: authLoading \} = useUser\(\)/);
  const prompt = src.indexOf("if (!authLoading && !user)");
  assert.ok(prompt > 0 && prompt < src.indexOf("return <StoreDashboardLoadingState />"), "checked before the loading state");
  assert.match(src, /\/login\?next=\$\{encodeURIComponent\("\/store\/dashboard"\)\}/);
});

test("messages don't request threads or show an error when signed out", () => {
  const src = read("./dm/InboxPage.tsx");
  assert.match(src, /queryKey: \["dm", "threads", meId\],\s*queryFn: fetchThreads,\s*enabled: Boolean\(meId\)/);
  assert.match(src, /if \(!authLoading && !user\) \{/);
  assert.match(src, /\/login\?next=\$\{encodeURIComponent\("\/messages"\)\}/);
});
