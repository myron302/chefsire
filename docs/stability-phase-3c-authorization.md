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

## Running the new suites

They use a real local PostgreSQL, like the other `*.postgres.test.ts` suites, and recreate the tables they need. Run them one file at a time (they share table names):

    CS_TEST_PG_URL=postgres://postgres@127.0.0.1:5432/chefsire_test npx tsx --test server/routes/meal-plan-access.postgres.test.ts
