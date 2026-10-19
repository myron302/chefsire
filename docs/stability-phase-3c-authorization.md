# Stability Phase 3C — Authorization and private-data protection

Scope: meal plans, private clubs, seller revenue. Facebook/TikTok/Instagram OAuth, payments, hosting and production data are untouched.

## Confirmed on `main` (68436a4) and reproduced by the new suites

| Finding | Reproduction (baseline) |
| --- | --- |
| `GET /api/meal-plans/:id` returned draft plans and `version.mealStructure` of paid plans to anyone, including anonymous callers | meal-plan suite: 5 of 7 access tests fail on baseline |
| Same plan reachable through `GET/POST /meal-plans/:id/comments|like|save`, `GET /me/saved-meal-planner-items`, `POST /meal-planner/events` | included in the same suite |
| `GET /api/clubs/:id` and `GET /api/clubs/:id/posts` served private clubs (details, posts, linked recipes) to guests and non-members; `PATCH /:id/posts/:postId` ignored membership | clubs suite: 3 of 6 fail on baseline |
| `GET /api/marketplace/sellers/:sellerId/analytics` returned `monthlyRevenue`, sales and tier with no authentication | analytics suite: 4 of 7 fail on baseline |
| **Found while testing:** every public product read (`/products`, `/products/:id`, `/sellers/:id/products`, `/storefront/:username`) embedded the seller's full `users` row (password hash, email, `monthlyRevenue`, provider ids) | public-read test fails on baseline |

## Rules now enforced

Meal plans (`server/lib/meal-plan-access.ts`)
- creator: full access, any status.
- holder of a `verified_paid` / `free_acquired` entitlement: full access (kept if the creator later unpublishes — they paid for it).
- anyone else, published plan: storefront preview (`version: null`, `access.contentLocked: true`).
- anyone else, draft/unpublished plan: 404 identical to a missing id.
- `legacy_unverified` rows, likes, saves and comments are not entitlements. Free plans need the existing one-click free acquisition (`POST /meal-plans/:id/purchase`).
- Social actions, comments, analytics events and the saved-items list apply the same visibility rule.

Clubs: `is_public = true` clubs are unchanged. Otherwise (including NULL) details and posts require a `club_memberships` row or being the creator; others get `403 {code: "CLUB_PRIVATE"}` with no club data. Pending join requests are not memberships. Editing a post requires current access.

Seller analytics: `requireAuth`; only the seller (session id === `:sellerId`) or a current administrator (`hasCurrentAdminAuthority`) may read. Other callers get the same 403 whether or not the seller exists. Public product/storefront responses embed `serializePublicUser(seller)` only.

## Recipe visibility (review follow-up)

Codex noted that excluding "any recipe a private-club post references" from search hides public recipes that were merely shared into a private club (reproduced: a public recipe shared by a member vanished from search), and lets any member suppress someone else's recipe by referencing its id.

Model: `recipes.origin_club_id` (migration `server/migrations/20261019_recipe_origin_club.sql`, additive and idempotent, passes the Phase 3B destructive-SQL guard) records the club a recipe was **created for**. It is written once, when `POST /clubs/:id/posts` creates a recipe from an inline template, and never by referencing an existing recipe.
- `origin_club_id IS NULL`: ordinary recipe, never restricted, however many club posts share it.
- set: visible to everyone while that club is public; otherwise only to the club's creator and members.
- Sharing an existing recipe only links it. The id is validated (unknown or unreadable: 404), and a recipe private to another club cannot be pushed into this one (403).
- One rule (`server/lib/recipe-visibility.ts`) is applied by public search, club posts, recipe saves and saved lists, suggestions, duets, cook-together, remixes (create and lists) and the meal planner (pool, add entry, AI plan).
- Legacy backfill touches only rows with no post and no external source that a club post references. The club of the earliest referencing post is taken as the creating club; ties or missing timestamps resolve to a private referencing club, never to public. Unreferenced or post-linked recipes are left untouched.
- Apply the migration before (or with) the deploy: recipe reads select the new column.

## Meal-planner recipe references and shared weeks (review follow-up)

Two further findings: `POST /week/entry` rejected external provider recipes (`sourceRecipeId: "mealdb_123"`) because it treated every reference as a local id, and a shared week could carry private-club recipe data to people who were never entitled to it.

- **Local vs external** is decided by the recipes table (`classifyLocalRecipeRefs`), not by how an id looks. `recipeId` (the foreign key) must be a local recipe the actor can see (else the same 404 `Recipe not found`). `sourceRecipeId` is provenance text: if it matches a local recipe that recipe must be visible; otherwise it is stored as external metadata. A private recipe cannot be disguised as external, because its real id always matches its row. `assistant-apply` follows the same rules and now accepts external provenance (it used to demand a local row).
- **Reads re-check access every time** (`redactUnavailableRecipes`): own week, shared preview, copy responses, generate response and the public summary totals. A reader who is not currently entitled gets the slot with the recipe row, recipe link, recipe-derived name and item list removed (`recipeUnavailable: true`, name `Recipe unavailable`). This also covers a member who later leaves the club. Nothing is snapshotted in the share row.
- **Copying** omits entries whose local recipe the receiver cannot see and reports `skippedUnavailableRecipesCount` (also in `copy-impact`). If nothing is copyable the request is refused with `SHARED_WEEK_NOTHING_COPYABLE` before the target week is touched. Public, external and custom entries are copied as before; a share grants no membership.
- Recommendation generation and the stored-recommendation list in `meal-planner-advanced.ts` use the same visibility rule. Week generation's recipe pool already did.
- No migration beyond the one above.

## Running the new suites

They use a real local PostgreSQL, like the other `*.postgres.test.ts` suites, and recreate the tables they need. Run them one file at a time (they share table names):

    CS_TEST_PG_URL=postgres://postgres@127.0.0.1:5432/chefsire_test npx tsx --test server/routes/meal-plan-access.postgres.test.ts
