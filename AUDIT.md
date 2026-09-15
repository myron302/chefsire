# ChefSire — Broken / Dead UI Audit

**Date:** 2026-08-27
**Scope:** `client/` ↔ `server/` cross-reference, read-only. No code was changed.
**Method:** Static extraction of every `/api/*` string literal in `client/src` (967 occurrences across 197 files), classified by call kind (`fetch`, `apiRequest`, `useQuery`/`queryFn`, React-Query cache key), then cross-referenced against all 677 Express routes reachable through `server/routes/index.ts` (multi-line route declarations and sub-router registration included). Navigation targets were matched against the 212 `<Route path>` declarations in `App.tsx`, `DrinksRoutes.tsx`, and `DrinksCategorySections.tsx`.

Every finding below was confirmed by reading **both** sides of the reference. Anything that could not be confirmed is in [NEEDS MANUAL CHECK](#needs-manual-check) rather than asserted as broken.

---

## Summary

| Category | P1 | P2 | P3 | Total |
|---|---|---|---|---|
| 1. Frontend calls to missing endpoints | 3 | 10 | 1 | 14 |
| 2. Dead routes / broken navigation | 3 | 3 | 4 | 10 |
| 3. Non-functional buttons | 5 | 14 | 8 | 27 |
| 4. Orphaned backend routes (INFO) | — | — | — | 50 routes + 10 unmounted modules |
| 5. Placeholder / unfinished UI | 2 | 4 | 4 | 10 |

Counts are *findings*, not affected sites: e.g. finding 3.1 is one row covering four dead Save buttons, and finding 2.1 is one row covering 25 dead links.

### Root causes worth noting first

1. **Ten server route modules are never mounted.** `server/routes/index.ts` imports 60+ routers but never imports these:
   `ocr.ts`, `restaurants.ts`, `square.ts`, `grocery-list.ts`, `comments.ts`, `likes.ts`, `health.ts`, `debug.ts`, `dev.mailcheck.ts`, `auth.verification.ts`.
   Three of them define endpoints the client actively calls (`ocr`, `restaurants`, `square`), so those features 404 in production.
2. **`/square` is mounted to the wrong module.** `server/routes/index.ts:172` does `r.use("/square", squareRouter)` where `squareRouter` is imported from `./stores` — and `server/routes/stores.ts` is an **empty 8-line router with no routes**. The real Square router (`server/routes/square.ts`, which defines `POST /subscription-link` and `GET /locations`) is never imported.
3. **`/auth/login` and `/auth` are used as the sign-in destination in 33 places but neither route exists.** The router only defines `/login` and `/signup`.

---

## 1. Frontend calls to missing endpoints

### P1

#### 1.1 Store subscription checkout posts to an unmounted router
- **File:** `client/src/pages/store/StoreDashboard.tsx:254`
```js
const resp = await fetch("/api/square/subscription-link", {
  method: "POST",
```
- **What's wrong:** No route exists at `/api/square/*`. `server/routes/index.ts:172` mounts `./stores` (an empty router) at `/square`; the module that actually defines `POST /subscription-link` is `server/routes/square.ts:54`, which is never imported anywhere. The request 404s, `resp.json()` fails or returns the API-404 body, and the user is shown the "Coming soon — Subscription service is being configured" toast (`StoreDashboard.tsx:266`) on every upgrade attempt. Store monetization is fully dead.
- **Severity:** P1 — checkout/monetization dead end.

#### 1.2 Pantry "Add item" premium gate always resolves to false
- **File:** `client/src/pages/pantry/components/AddItemForm.tsx:25`
```js
const { data: userData } = useQuery({
  queryKey: ["/api/user"],
});
const isPremium = userData?.nutritionPremium || false;
```
- **What's wrong:** This `useQuery` has no `queryFn`, so the default one in `client/src/lib/queryClient.ts:33` fetches `queryKey.join("/")` → `GET /api/user`. The server has no `/api/user` route (only `/api/users/...`). The query throws, `isPremium` is permanently `false`, and the "also add to shopping list" branch (`AddItemForm.tsx:33`) can never run for a paying user.
- **Severity:** P1 — core pantry flow silently degraded for premium users.

#### 1.3 Custom drink save posts to the wrong prefix (4 sites)
- **Files:**
  - `client/src/pages/drinks/caffeinated/index.tsx:307` (`createDrink`)
  - `client/src/pages/drinks/caffeinated/index.tsx:359` (`makePremadeRecipe`)
  - `client/src/pages/drinks/smoothies/index.tsx:306`
  - `client/src/pages/drinks/smoothies/index.tsx:358`
```js
const response = await fetch('/api/custom-drinks', {
  method: 'POST',
```
- **What's wrong:** The route is `POST /api/drinks/custom-drinks` (`server/routes/drinks.ts:28320`) — mounted under the `/drinks` prefix at `server/routes/index.ts:139`. The client omits `/drinks`, so every save 404s and the user gets `alert('Failed to save drink. Please try again.')` (`caffeinated/index.tsx:355`).
- **Severity:** P1 — the drink builder's save action, the primary conversion of both drink category pages.

### P2

#### 1.4 Receipt OCR endpoint is never mounted
- **File:** `client/src/components/ReceiptScanner.tsx:37`
```js
const res = await fetch("/api/ocr/receipt", { method: "POST", body: fd });
```
- **What's wrong:** `server/routes/ocr.ts:13` defines `router.post("/receipt", ...)` but `ocr.ts` is not imported in `server/routes/index.ts`. Cloud OCR always throws `"Cloud OCR request failed"`.
- **Severity:** P2 — the component falls back to local Tesseract, so it degrades rather than hard-fails.

#### 1.5 Restaurant place-details endpoint is never mounted
- **File:** `client/src/hooks/usePlaceDetails.ts:57`
```js
const res = await fetch(`/api/restaurants/${id}/details?tipsLimit=8`);
```
- **What's wrong:** `server/routes/restaurants.ts:91` defines `router.get("/:id/details", ...)`, but `restaurants.ts` is not imported in `server/routes/index.ts`. BiteMap place detail panels never load.
- **Severity:** P2.

#### 1.6 Daily Quests widget calls a path with an extra segment
- **File:** `client/src/components/DailyQuests.tsx:47`
```js
queryFn: () => fetchJSON<{ quests: ... }>(`/api/quests/daily/${user?.id}`),
```
- **What's wrong:** The server route is `GET /daily` with **no** path parameter (`server/routes/quests.ts:26`) — it reads the user from `req.user!.id`. Express will not match `/daily/<uuid>` against `/daily`, so the widget always 404s.
- **Severity:** P2.

#### 1.7 AI Suggestions widget calls a path with an extra segment
- **File:** `client/src/components/AISuggestions.tsx:64`
```js
queryFn: () => fetchJSON<{ suggestions: AISuggestion[] }>(`/api/suggestions/today/${user?.id}`),
```
- **What's wrong:** Same shape as 1.6 — the route is `GET /today` with no param (`server/routes/suggestions.ts:11`), reading `req.user!.id`. Always 404s.
- **Severity:** P2.

#### 1.8 Pantry recipe-suggestions call is missing the `/pantry` prefix
- **File:** `client/src/pages/pantry/recipe-matches.tsx:34`
```js
const res = await fetch(`/api/users/${user.id}/pantry/recipe-suggestions?maxMissingIngredients=3&limit=20`, {
```
- **What's wrong:** The route is declared as `r.get("/users/:id/pantry/recipe-suggestions", ...)` in `server/routes/pantry.ts:234`, and `pantryRouter` is mounted at `/pantry` (`server/routes/index.ts:126`). The real URL is therefore `/api/pantry/users/:id/pantry/recipe-suggestions`. The whole Recipe Matches page renders empty.
- **Severity:** P2.

#### 1.9 Barcode product lookup endpoint does not exist
- **File:** `client/src/pages/pantry/shopping-list.tsx:199`
```js
const response = await fetch(`/api/products/barcode/${barcode}`, {
```
- **What's wrong:** No `/api/products/*` route exists anywhere in `server/`. The nearest real routes are `GET /api/lookup/:barcode` (`server/routes/lookup.ts`) and `POST /api/allergies/check-barcode/:barcode`.
- **Severity:** P2.

#### 1.10 Competition video room — both endpoints missing
- **File:** `client/src/pages/competitions/CompetitionRoomPage.tsx:46`
```js
const response = await fetch(`/api/competitions/${id}/video-room`, {
```
- **File:** `client/src/pages/competitions/CompetitionRoomPage.tsx:66`
```js
const response = await fetch(`/api/video/room`, {
```
- **What's wrong:** `server/routes/competitions.ts` defines no `video-room` route, and there is no `/api/video/*` router at all. The first call is swallowed by `catch { console.log('No existing room found') }`; the second surfaces a thrown error to the user when they press "Join Video".
- **Severity:** P2 (×2 findings).

#### 1.11 Wedding subscription trial endpoint does not exist
- **File:** `client/src/pages/settings.tsx:1138`
```js
// Wedding trial endpoint (works if you've added it; if not, server will return 404 and we'll show the toast).
const res = await fetch(`/api/wedding/subscription/trial`, {
  method: "POST",
```
- **What's wrong:** `server/routes/wedding-subscription.ts` defines `tiers`, `/`, `change`, `cancel`, and `history` — no `trial`. The in-code comment confirms this was known and left unresolved.
- **Severity:** P2.

#### 1.12 Premium vendor messaging endpoint does not exist
- **File:** `client/src/hooks/use-wedding.ts:172`
```js
const { data: responseData } = await fetchWeddingWithFallback([
  '/api/wedding/vendor-message',
], { method: 'POST', ... });
```
- **What's wrong:** No `/api/wedding/vendor-message` route exists. Unlike the sibling hooks in this file, this `fetchWeddingWithFallback` array has a **single** entry, so there is no fallback to absorb the 404. The premium gate at `use-wedding.ts:166` passes for premium users and then the request fails.
- **Severity:** P2.

### P3

#### 1.13 Adaptive planner persistence is stubbed to localStorage with open API contracts
- **File:** `client/src/components/meal-planner/planner-adaptation/adaptivePersistenceAdapter.ts:39-43`
```js
// TODO(neon-api-contract): profile contract => GET/POST /api/adaptive-planner/profile
// TODO(neon-api-contract): objective contract => GET/POST /api/adaptive-planner/objectives
// TODO(neon-api-contract): relationship contract => GET/POST /api/adaptive-planner/relationships
```
- **What's wrong:** `GET/POST /api/adaptive-planner/profile` **does** exist server-side (`server/routes/adaptive-planner.ts:31-32`) but no client code calls it — the adapter persists to `localStorage` only. Not a broken call; an unfinished integration. See also §4.
- **Severity:** P3 — informational.

---

## 2. Dead routes / broken navigation

All targets below were matched against the 212 declared `<Route path>` values. Each falls through to `<Route component={NotFound} />` (`App.tsx:417`).

### P1

#### 2.1 `/auth/login` — 25 sign-in links across the app
- **What's wrong:** No `/auth/login` route exists. The login page is registered at `/login` (`App.tsx:189`). Every "Sign in" affordance on the drinks and nutrition surfaces lands on Not Found.
- **Sites:**

| File | Line | Kind |
|---|---|---|
| `client/src/components/drinks/CampaignFollowButton.tsx` | 94 | `<Link href>` |
| `client/src/components/drinks/DropRsvpButton.tsx` | 88 | `<Link href>` |
| `client/src/components/nutrition/social/MealPlannerSocial.tsx` | 74, 171, 223, 276 | `setLocation()` |
| `client/src/pages/drinks/campaign-following.tsx` | 70 | `<Link href>` |
| `client/src/pages/drinks/collection-detail.tsx` | 881, 1073 | `<Link href>` |
| `client/src/pages/drinks/creator-public.tsx` | 676, 1157 | `<Link href>` |
| `client/src/pages/drinks/drops.tsx` | 90 | `<Link href>` |
| `client/src/pages/drinks/feed.tsx` | 99, 112 | `<Link href>` |
| `client/src/pages/drinks/gift-claim.tsx` | 112 | `<Link href>` |
| `client/src/pages/drinks/gifts.tsx` | 81 | `<Link href>` |
| `client/src/pages/drinks/memberships.tsx` | 116 | `<Link href>` |
| `client/src/pages/drinks/notifications.tsx` | 150 | `<Link href>` |
| `client/src/pages/drinks/orders.tsx` | 101 | `<Link href>` |
| `client/src/pages/drinks/purchased-collections.tsx` | 104 | `<Link href>` |
| `client/src/pages/drinks/roadmap.tsx` | 113 | `<Link href>` |
| `client/src/pages/drinks/wishlist.tsx` | 131 | `<Link href>` |
| `client/src/pages/nutrition/MealPlanDetailsPage.tsx` | 362 | `setLocation()` |
| `client/src/pages/nutrition/MealPlannerSharedBrowsePage.tsx` | 508 | `<a href>` |
| `client/src/pages/nutrition/MealPlannerSharedWeekPage.tsx` | 461 | `<a href>` |
| `client/src/pages/drinks/hooks/usePrimaryOfferCheckout.ts` | 58 | `window.location.href = \`/auth/login?next=${...}\`` |

Representative snippet — `client/src/pages/drinks/hooks/usePrimaryOfferCheckout.ts:58`:
```js
window.location.href = `/auth/login?next=${encodeURIComponent(next)}`;
```
- **Severity:** P1 — auth entry point; also breaks the drinks checkout redirect at `usePrimaryOfferCheckout.ts:58`.

#### 2.2 `/auth` — 8 sign-in links
- **What's wrong:** No `/auth` route exists.
- **Sites:** `client/src/pages/QuestsPage.tsx:102`, `client/src/pages/RemixesPage.tsx:126`, `client/src/pages/SuggestionsPage.tsx:139`, `client/src/pages/social/feed.tsx:178, 185, 389, 409, 512`
```jsx
<Link href="/auth">
```
- **Severity:** P1 — the logged-out main feed's "Join free" / "Log In" CTAs (`feed.tsx:178, 185`) are the app's front door.

#### 2.3 Post-checkout redirect goes nowhere
- **File:** `client/src/pages/checkout/CheckoutPage.tsx:180`
```jsx
onClick={() => navigate("/orders/my-purchases")}
```
- **What's wrong:** No `/orders/my-purchases` client route. The declared purchase routes are `/nutrition/my-purchases` and `/meal-planner/my-purchases`. Note that the **API** route `GET /api/orders/my-purchases` does exist (`server/routes/orders.ts:194`) but has no page bound to it — the data is there and unreachable.
- **Severity:** P1 — the user is dropped on Not Found immediately after paying.

### P2

#### 2.4 Cook-together session pages don't exist
- **Sites:** `client/src/components/CookTogether.tsx:201`, `:208`, `:328`
```js
window.location.href = `/cook-together/${session.id}`;
```
- **What's wrong:** Only `/cook-together` is declared; there is no `/cook-together/:id`. Creating a session (`:328`) and joining one (`:201`) both land on Not Found.
- **Severity:** P2.

#### 2.5 Seasonal event detail pages don't exist
- **File:** `client/src/components/SeasonalEvents.tsx:185`
```jsx
<Link href={`/events/${event.slug}`}>
```
- **What's wrong:** Only `/events` is declared; no `/events/:slug`.
- **Severity:** P2.

#### 2.6 Recipe link uses the singular path
- **File:** `client/src/pages/pantry/recipe-matches.tsx:295`
```jsx
<Link href={`/recipe/${recipe.id}`}>
```
- **What's wrong:** Routes are under `/recipes` (plural). `/recipe/:id` matches nothing. (This page is already blank because of finding 1.8, so the link is only reachable if that is fixed first.)
- **Severity:** P2.

### P3

#### 2.7 Legal / marketing footer links have no routes
| Target | File:line | Snippet |
|---|---|---|
| `/terms` | `client/src/pages/auth/signup.tsx:896` | `<a href="/terms" ...>Royal Decree</a>` |
| `/privacy` | `client/src/pages/auth/signup.tsx:897`, `:977` | `<a href="/privacy" ...>Kingdom Privacy</a>` |
| `/about` | `client/src/pages/auth/signup.tsx:975` | `<a href="/about" ...>About the Kingdom</a>` |
| `/contact` | `client/src/pages/auth/signup.tsx:976`, `client/src/pages/auth/verify-email.tsx:178` | `<a href="/contact" ...>Contact Royal Court</a>` |

- **What's wrong:** None of these four routes are declared. They sit on the signup page directly beside the Terms-acceptance checkbox, so a user cannot read the terms they are agreeing to.
- **Severity:** P3 (cosmetic routing) — though the Terms link next to a consent checkbox may carry compliance weight.

---

## 3. Non-functional buttons

Method: every `<Button>`/`<button>` in `client/src` (excluding `components/ui/` primitives) was checked for `onClick`, `type="submit"`, `asChild`, spread props, a wrapping `<Link>`/`<a>`, a clickable ancestor with `onClick`, or an enclosing `<form onSubmit>`. Only elements with **none** of these are listed. Buttons whose clicks bubble to a clickable `Card` (e.g. `client/src/pages/drinks/potent-potables/index.tsx:682`, `client/src/pages/store/components/MarketplaceProductListItem.tsx:66`) were verified as functional and excluded.

### P1

#### 3.1 All four Settings "Save" buttons are inert
`client/src/pages/settings.tsx` contains **no `<form>` element at all** — verified by grep. These four buttons have no `onClick`:

| Line | Label |
|---|---|
| 2872 | Save Account Settings |
| 3043 | Save Privacy Settings |
| 3109 | Save Notification Settings |
| 3150 | Save Interests |

```jsx
<Button className="bg-orange-500 hover:bg-orange-600">
  <Save size={16} className="mr-2" />
  Save Account Settings
</Button>
```
- **What's wrong:** Clicking any of them does nothing — no handler, no form submission, no toast. The user believes their settings were saved.
- **Severity:** P1 — profile/settings core flow; silent data loss from the user's point of view.

#### 3.2 Main feed "Load More Posts" does nothing
- **File:** `client/src/pages/social/feed.tsx:379`
```jsx
<Button variant="outline" className="px-6 py-3" data-testid="button-load-more">
  Load More Posts
</Button>
```
- **What's wrong:** No `onClick`. The feed is capped at the first page permanently.
- **Severity:** P1 — core feed.

#### 3.3 Suggested-chefs "Follow" button does nothing
- **File:** `client/src/pages/social/feed.tsx:455`
```jsx
<Button size="sm" className="bg-primary text-primary-foreground hover:opacity-90" data-testid={`button-follow-${u.id}`}>
  Follow
</Button>
```
- **What's wrong:** No `onClick`, despite `POST /api/follows/:targetId` existing (`server/routes/follows.ts:61`). The `data-testid` suggests it was intended to be wired.
- **Severity:** P1 — core social action.

#### 3.4 Profile "Message" button does nothing
- **File:** `client/src/pages/social/profile.tsx:449`
```jsx
<Button>
  <MessageCircle className="w-4 h-4 mr-2" />
  Message
</Button>
```
- **What's wrong:** No `onClick`. The adjacent Follow button on the same profile header *is* wired, making this a clear omission. A full DM API (`/api/dm/*`) and a `/dm` route both exist.
- **Severity:** P1 — profile core flow.

#### 3.5 "Download Now" for purchased digital products does nothing
- **File:** `client/src/pages/marketplace/ProductPage.tsx:343`
```jsx
{product.isDigital && product.digitalDownloadUrl && (
  <Button className="w-full" size="lg" variant="outline">
    <Download className="w-5 h-5 mr-2" />
    Download Now
  </Button>
)}
```
- **What's wrong:** No `onClick` and no `href`, even though `product.digitalDownloadUrl` is in scope and guarded on. A buyer of a digital product cannot retrieve it.
- **Severity:** P1 — order fulfilment dead end.

### P2

| # | File:line | Label | Note |
|---|---|---|---|
| 3.6 | `client/src/components/AnalyticsDashboard.tsx:106` | Export Report | No `onClick`. |
| 3.7 | `client/src/components/NutritionMealPlanner.tsx:1836` | Learn More | Sibling "Start 30-Day Free Trial" (`:1829`, `onClick={startNutritionTrial}` at `:1832`) is wired; this one is not. |
| 3.8 | `client/src/components/NutritionMealPlanner.tsx:3714` | Create Prep Session | No `onClick`. |
| 3.9 | `client/src/components/meal-planner/sections/GroceryTabSection.tsx:466` | Add to Favorites | Both siblings on `:464`/`:465` have `onClick={checkPantryFirst}` / `onClick={shareWithFamily}`; this third one has none. |
| 3.10 | `client/src/pages/RemixesPage.tsx:297` | *N* Saves | Sibling "Likes" button has `onClick={() => handleLikeRemix(remix.id)}` at `:291`. |
| 3.11 | `client/src/pages/competitions/LiveBattlesPage.tsx:199` | Get Ready | No `onClick`. |
| 3.12 | `client/src/pages/competitions/CompetitionRoomPage.tsx:209` | Share (icon) | No `onClick`. |
| 3.13 | `client/src/pages/competitions/CompetitionLibraryPage.tsx:208` | Search | No `onClick` — **and** the `q` state it sits beside is never read (only `useState` at `:48` and `value={q}` at `:202`). The entire search box is decorative. |
| 3.14 | `client/src/components/store/ProductForm.tsx:196` | Upload (icon) | `type="button"` with no `onClick`; the file has no `<form>` element. Product image upload is unreachable. |
| 3.15 | `client/src/pages/drinks/detoxes/juice/index.tsx:329` | Share Page | No `onClick`. |
| 3.16 | `client/src/pages/drinks/detoxes/juice/index.tsx:905` | Share | Sibling "Start Cleanse" is wired. |
| 3.17 | `client/src/pages/drinks/detoxes/tea/index.tsx:276` | Share Page | Same pattern. |
| 3.18 | `client/src/pages/drinks/detoxes/water/index.tsx:271` | Share Page | Same pattern. |
| 3.19 | `client/src/pages/drinks/protein-shakes/index.tsx:712` | Share Recipe | Sibling "Save Recipe (+10 XP)" is wired. |

Representative snippet — `client/src/components/meal-planner/sections/GroceryTabSection.tsx:464-466`:
```jsx
<Button ... onClick={checkPantryFirst}><Package className="w-4 h-4 mr-2" />Check Pantry First</Button>
<Button ... onClick={shareWithFamily}><Users className="w-4 h-4 mr-2" />Share with Family</Button>
<Button variant="outline" className="w-full justify-start" size="sm"><Star className="w-4 h-4 mr-2" />Add to Favorites</Button>
```

### P3

| # | File:line | Label | Note |
|---|---|---|---|
| 3.20 | `client/src/pages/pet-food/index.tsx:214`, `:218` | Explore Recipes / Safety Guidelines | Both hero CTAs have no `onClick`. |
| 3.21 | `client/src/pages/pet-food/index.tsx:184`, `birds/index.tsx:494`, `cats/index.tsx:505`, `dogs/index.tsx:496`, `small-pets/index.tsx:494` | Heart / favorite (icon) | Repeated pattern: the adjacent Share button has `onClick={handleSharePage}`, the Heart button next to it has no handler on all 5 pages. |
| 3.22 | `client/src/pages/recipes/baby-food/index.tsx:475`, `purees/index.tsx:639`, `mashed/index.tsx:630`, `finger-foods/index.tsx:655`, `toddler/index.tsx:643` | View Recipe | No `onClick`, no wrapping `<Link>`, parent `<Card>` has no `onClick`. |
| 3.23 | `client/src/pages/recipes/baby-food/purees/index.tsx:603`, `mashed/index.tsx:586`, `finger-foods/index.tsx:611`, `toddler/index.tsx:599` | Heart / favorite (icon) | No handler. |
| 3.24 | `client/src/pages/drinks/potent-potables/rum/index.tsx:473`, `scotch-irish-whiskey/index.tsx:452`, `tequila-mezcal/index.tsx:473` | More Filters | No `onClick` on all three. |
| 3.25 | `client/src/pages/drinks/potent-potables/index.tsx:627` | Make Again | In the "Your Favorite Cocktails" strip; no handler. |
| 3.26 | `client/src/pages/drinks/protein-shakes/index.tsx:529` | Make Again | Same pattern. |
| 3.27 | `client/src/pages/drinks/protein-shakes/index.tsx:729` | + (add supplement) | No handler. |

---

## 4. Orphaned backend routes — INFO ONLY

These are reachable server routes with no matching client reference. Many are legitimately used by OAuth callbacks, webhooks, cron, or admin tooling — **none of these are bugs on their own.** Listed for inventory.

### 4.1 Route modules that are never mounted (dead server code)

`server/routes/index.ts` never imports these files, so nothing they define is reachable:

| Module | Routes defined | Client impact |
|---|---|---|
| `server/routes/ocr.ts` | `POST /receipt` | **Yes** — see finding 1.4 |
| `server/routes/restaurants.ts` | `GET /search`, `GET /:id/details` | **Yes** — see finding 1.5 |
| `server/routes/square.ts` | `POST /subscription-link`, `GET /locations` | **Yes** — see finding 1.1 |
| `server/routes/grocery-list.ts` | 8 routes | No — duplicated by `meal-planner-advanced.ts` |
| `server/routes/comments.ts` | 3 routes | No — duplicated by `posts.ts` |
| `server/routes/likes.ts` | 3 routes | No — duplicated by `posts.ts` |
| `server/routes/health.ts` | 1 route | No — `app.ts:63` serves `/healthz` directly |
| `server/routes/debug.ts` | 5 routes | No |
| `server/routes/dev.mailcheck.ts` | 1 route | No |
| `server/routes/auth.verification.ts` | 3 routes | No — `auth.ts` handles verification |

### 4.2 Mounted but uncalled routes (50)

Grouped by module. Expected-to-be-uncalled categories are annotated.

- **`adaptive-planner.ts`** — `GET/POST /api/adaptive-planner/profile` *(client persists to localStorage instead; see 1.13)*
- **`allergies.ts`** — `POST /check-recipe/:recipeId`, `POST /check-barcode/:barcode`, `POST /product-allergens`, `GET/POST /substitutions`, `DELETE /substitutions/:id`
- **`auth.ts`** — `GET /verify-email` *(email link target — expected)*, `GET /instagram` *(OAuth entry — expected)*
- **`catering.ts`** — `POST /users/:id/enable`, `POST /users/:id/disable`, `PUT /users/:id/settings`, `GET /users/:id/status` *(the client uses the `/api/users/:id/catering/*` equivalents in `users.ts` instead)*
- **`duets.ts`** — `GET /feed`, `POST /create`, `GET /trending`
- **`google.ts`** — `GET /search` *(called via a computed prefix in `useNearbyBites.ts:109` — not truly orphaned)*, `GET /staticmap`
- **`index.ts`** — `GET /_routes` *(dev-only introspection — expected)*
- **`marketplace.ts`** — `GET /storefront/:username`, `GET /categories`, `GET /sellers/:sellerId/analytics`
- **`meal-nutrition-ai.ts`** — `GET /ai/debug-status` *(debug — expected)*
- **`meal-planner-advanced.ts`** — `POST/GET /family-profiles`, `PATCH /family-profiles/:id`
- **`nutrition.ts`** — `PUT /users/:id/goals`, `POST /log`, `GET /users/:id/daily/:date`, `GET /users/:id/logs` *(client uses the `users.ts` duplicates)*
- **`orders.ts`** — `GET /my-purchases` *(no client page — the only navigation to it is the dead route in finding 2.3)*
- **`pantry.ts`** — `GET/POST /users/:id/pantry`, `GET /users/:id/pantry/expiring`, `GET /users/:id/pantry/recipe-suggestions` *(the last one is the correct target of the broken call in finding 1.8)*
- **`payments.ts`** — `POST /refund` *(admin — expected)*
- **`payouts.ts`** — `POST /process-seller-payout`, `GET /my-payouts`, `GET /pending-balance`, `GET /connect-square`, `GET /square-callback` *(callback is an OAuth target — expected; the rest match the "payout automation is not implemented yet" note at `creator-dashboard.tsx:2861`)*
- **`quests.ts`** — `GET /` , `POST /create`, `POST /seed` *(create/seed are admin-gated — expected)*
- **`streaks.ts`** — `POST /checkin`, `GET /status`, `GET /rewards`
- **`subscriptions.ts`** — `GET /calculate-commission`
- **`suggestions.ts`** — `POST /generate`

---

## 5. Placeholder / unfinished UI

### P1

#### 5.1 Store subscription upgrade shows a "Coming soon" toast for a real 404
- **File:** `client/src/pages/store/StoreDashboard.tsx:266`
```js
toast({
  title: "Coming soon",
  description: "Subscription service is being configured. Please check back later.",
  variant: "destructive",
});
```
- **What's wrong:** This is the error branch for the broken call in finding 1.1. Because `/api/square/subscription-link` 404s (wrong router mounted), the upgrade flow is presented to users as "not built yet" rather than as the misconfiguration it is.
- **Severity:** P1 — blocks monetization and masks the root cause.

#### 5.2 Profile page renders hardcoded mock data in four sections
- **File:** `client/src/pages/social/profile.tsx`
```js
// Custom drinks (mock)
const { data: drinksData, ... } = useQuery({
  queryKey: ["/api/custom-drinks/user", profileUserId],
  queryFn: async () => {
    return { drinks: [ { id: "1", name: "Tropical Sunrise", category: "Smoothie", ... } ] };
  },
```
| Line | Section | Behaviour |
|---|---|---|
| 164-196 | Custom drinks | Returns a hardcoded array (`"Tropical Sunrise"`, etc.) |
| 198-217 | Drink stats | Returns hardcoded stats |
| 219-223 | Saved drinks | `queryFn: async () => ({ drinks: [] })` — permanently empty |
| 226-274 | Competitions / cookoffs | Returns hardcoded entries (`"Midnight Pasta Showdown"`) |
- **What's wrong:** Real endpoints exist for the first two (`GET /api/drinks/custom-drinks/user/:userId` at `server/routes/drinks.ts:28274`, `GET /api/drinks/custom-drinks/saved/:userId` at `:28551`), so every visitor to any profile sees the same four fake drinks and fake competition history presented as that user's real activity.
- **Severity:** P1 — user-visible fabricated data on a core page.

### P2

#### 5.3 Competitions surface is entirely mock data
| File | Line | Detail |
|---|---|---|
| `client/src/pages/competitions/CompetitionLibraryPage.tsx` | 65-77 | `// Mock data for demo` → `const mockItems = [...8 hardcoded competitions...]`, pushed into state via `useEffect(() => { setItems(mockItems); }, [])` at `:79` |
| `client/src/pages/competitions/LiveBattlesPage.tsx` | 14-22 | `// Mock live battles` → `mockLive`, `mockStarting` |
| `client/src/pages/competitions/CompetitionRoomPage.tsx` | 19, 26 | `mockParticipants`, `mockChat` |

- **What's wrong:** A real competitions API exists (`server/routes/competitions.ts`: `GET /api/competitions/library`, `GET /api/competitions/:id`, etc.) and is never called by these three pages. Combined with 3.13 (dead search) and 1.10 (missing video-room endpoints), the whole competitions feature is a non-functional shell.
- **Severity:** P2.

#### 5.4 Wedding premium checkout is a fake two-step toast
- **File:** `client/src/pages/services/wedding-planning.tsx:1643-1652`
```js
toast({ title: "Upgrade to Premium", description: "Redirecting to subscription page..." });
setTimeout(() => {
  toast({ title: "Coming Soon", description: "Premium subscription checkout will be available soon!" });
}, 1000);
```
- **What's wrong:** Simulates a redirect that never happens, then admits it is unbuilt.
- **Severity:** P2.

#### 5.5 Drink photo capture is a placeholder that still awards points
- **File:** `client/src/pages/drinks/caffeinated/index.tsx:425-437`
```js
const handleTakePhoto = async () => {
  setShowCamera(true);
  setTimeout(async () => {
    setShowCamera(false);
    if (customDrink.ingredients.length >= 2) {
      alert('Photo feature coming soon! This would upload your drink photo.');
      addPoints(50);
```
- **What's wrong:** Shows a fake 2-second camera state, then an `alert()` placeholder — but still grants 50 XP for an action that did not occur.
- **Severity:** P2 — awards real gamification currency for a no-op.

#### 5.6 Store analytics tabs are placeholders
- `client/src/pages/store/components/StoreDashboardAnalyticsTab.tsx:29` — `<p className="font-medium">Detailed analytics coming soon</p>`
- `client/src/pages/store/components/StoreDashboardQuickActions.tsx:38` — `Analytics and customer behaviour — coming soon`
- `client/src/pages/store/StoreDashboard.tsx:424` — Customer Insights click handler fires a `"Coming Soon"` toast.
- **Severity:** P2 — a whole dashboard tab is empty; `GET /api/marketplace/sellers/:sellerId/analytics` exists server-side and is uncalled (see §4.2).

### P3

#### 5.7 Nutrition campaigns "View all" is a disabled placeholder
- **File:** `client/src/pages/nutrition/campaigns/NutritionCampaignFeedPage.tsx:56`
```jsx
<Button variant="ghost" ... disabled title="Expanded campaign collections are coming soon.">
  View all — Coming soon <ArrowRight className="h-4 w-4" />
</Button>
```
- **What's wrong:** Honest placeholder — explicitly `disabled` and labelled. Listed for completeness, not a defect.
- **Severity:** P3.

#### 5.8 Catering package gallery placeholder
- **File:** `client/src/components/catering/PackageGallery.tsx:54` — `Additional gallery images coming soon`
- **Severity:** P3.

#### 5.9 Creator payouts explicitly unimplemented
- **File:** `client/src/pages/drinks/creator-dashboard.tsx:2861`
```
Square checkout sales are tracked here so creator payouts can be added later, but payout automation is not implemented yet.
```
- **What's wrong:** Consistent with the 5 uncalled `payouts.ts` routes in §4.2. Disclosed to the user, so not a dead end.
- **Severity:** P3.

#### 5.10 Unused mock modules (dead code, not user-visible)
- `client/src/lib/store/stores.ts:3` — `// Mock data for development`; an in-memory store/product CRUD implementation. **No file imports it.**
- `client/src/components/MediaGalleryWithModal.tsx:105-106` — `// Replace 'mockMedia' with your actual media data array from your profile component.` / `const mockMedia: MediaItem[] = [`. **The component is never imported.**
- **Severity:** P3 — dead code; flagged so it is not mistaken for live behaviour.

---

## NEEDS MANUAL CHECK

Items where one side of the reference could not be resolved statically, or where the runtime behaviour is genuinely ambiguous. **None of these are asserted as broken.**

1. **`client/src/components/RecipeReviews.tsx:426` — "Add Photo" button inside a `<label>`.**
   The `<Button>` has no `onClick` but is wrapped in a `<label>` containing a hidden file `<input>`. Because shadcn's `Button` renders a real `<button>` (`client/src/components/ui/button.tsx:44`), a click on it may be swallowed rather than forwarded to the input, depending on browser. Needs a manual click test.
   *(Note: the endpoint it posts to, `POST /api/reviews/:reviewId/photos`, **does** exist at `server/routes/reviews.ts` — verified.)*

2. **`client/src/components/store/StoreBuilder.tsx:37` and `:62` — buttons with no handler.**
   These live inside Craft.js resolver components (`ProductCardBlock`, toolbox item). The "Add to Cart" at `:37` is a design-canvas preview element and is probably intentionally inert; `:62` uses `connectors.create` via a `ref`, which my analysis cannot resolve. Verify against the Craft.js integration.

3. **`client/src/hooks/use-wedding.ts:137` — `POST /api/wedding/saved-vendors/${vendorId}`.**
   This path does not exist on the server, but the call uses `fetchWeddingWithFallback([primary, fallback])` with `'/api/wedding/vendor-quotes'` as the fallback — which does exist (`server/routes/wedding-vendor-quotes.ts`). So "save vendor" silently falls through to creating a *vendor quote* instead. Not a dead end, but likely a semantic mismatch. Confirm the intended behaviour.

4. **`client/src/hooks/use-wedding.ts:97, 124` — `/api/wedding/quotes`.**
   Same fallback mechanism; the primary `'/api/wedding/vendor-quotes'` exists, so `/api/wedding/quotes` is a deliberate legacy fallback. Confirm it can be retired rather than treating it as broken.

5. **`client/src/pages/clubs/index.tsx:60` — computed query string.**
   ``return `/api/clubs${params.toString() ? `?${params.toString()}` : ""}`;`` — the nested template literal defeats static extraction. `GET /api/clubs` exists (`server/routes/clubs.ts:25`), so this is very likely fine; the query-parameter contract was not verified.

6. **`client/src/pages/nutrition/MealPlannerSharedBrowsePage.tsx:164` — computed query string.**
   ``fetch(`/api/meal-planner/week/shared${query ? `?${query}` : ''}`)`` — same nested-template issue. `GET /api/meal-planner/week/shared` exists (`server/routes/meal-planner-week.ts`). Query-parameter contract not verified.

7. **`client/src/pages/store/StoreDropsTab.tsx:30` — computed query string.**
   ``const url = `/api/stores/${storeId}/drops${before ? `?before=${encodeURIComponent(before)}` : ""}`;`` — `GET /api/stores/:id/drops` exists (`server/routes/store-drops.ts`). Pagination parameter not verified.

8. **`client/src/pages/allergies/index.tsx:139` — `queryKey: ["/api/allergies/profiles", selectedMember?.id]`.**
   The query has a custom `queryFn`, so the key is not the URL. The server has `POST /api/allergies/profiles` and `DELETE /api/allergies/profiles/:id` but no `GET`. Whether the `queryFn` targets a real GET path was not traced end-to-end.

9. **Method detection for dynamically-chosen verbs.**
   A small number of call sites choose the HTTP verb at runtime, e.g. `client/src/components/nutrition/social/MealPlannerSocial.tsx:282`:
   ```js
   const res = await fetch(`/api/follows/${encodeURIComponent(creatorId)}`, { method: active ? "DELETE" : "POST", ... });
   ```
   Both `POST` and `DELETE /api/follows/:targetId` exist, so this specific one is fine. Other conditional-verb sites were resolved where both branches matched, but a runtime-only verb cannot be fully proven statically.

10. **`server/routes/drinks.ts` is ~28,500 lines with 124 route declarations.**
    Route extraction there was regex-based and multi-line aware, but a file of that size may contain conditionally-registered or programmatically-built routes that this pass did not model. Drinks-domain findings should be spot-checked against a running server.

---

## Appendix — how to reproduce

- Server route inventory: all `router.<verb>(` / `r.<verb>(` declarations across `server/**/*.ts`, resolved through the prefix map in `server/routes/index.ts` (including the four `registerXRoutes()` helpers that attach to the drinks router at `server/routes/drinks.ts:120-123`).
- Client call inventory: all `/api/...` string and template literals in `client/src/**/*.{ts,tsx}`, classified as `fetch` / `apiRequest` / `queryKey` / cache-key operation. React-Query cache keys (`invalidateQueries`, `setQueryData`, etc. — 201 occurrences) were excluded from endpoint matching, as were `useQuery` keys accompanied by a custom `queryFn`. `useQuery` keys **without** a `queryFn` were resolved through the default `queryFn` in `client/src/lib/queryClient.ts:33`, which fetches `queryKey.join("/")`.
- Path matching is segment-wise, treating `:param` as a wildcard on the server side and `${...}` as a wildcard on the client side.
