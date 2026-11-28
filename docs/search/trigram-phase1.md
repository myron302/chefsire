# Phase 1 trigram search — draft #1552

Scope: recipe titles, user/chef display names and usernames, Marketplace product names and seller names. Existing recipe ingredient/instruction, user bio/specialty and product-description partial matching remains. Drink handlers, premium-collection gates, generated canonical catalogs, Places, UI and semantic search are outside this PR. Existing categories and response shapes are unchanged. #1488 already merged; its cancellation code is not duplicated.

## Verified schema and switch

Read-only Neon catalog inspection on 2026-11-28 verified `public.recipes(title)`, `public.users(username, display_name)` and `public.products(name)`, plus recipe club origins and seller/active fields. Existing indexes are B-tree. `pg_trgm` 1.6 is available but not installed. No production schema or member data was changed.

Only `SEARCH_TRIGRAM_ENABLED=true` selects the new path. Missing/false/other values retain the previous query predicates and ordering without needing the extension. The new path bounds normalized input to 160 characters, rejects structured/control input at HTTP boundaries and treats wildcard characters literally. Exact names rank before prefixes, substrings and fuzzy candidates; score ties prefer whole-name similarity then existing popularity/recency and a stable id. Terms under three characters and queries containing LIKE wildcard/escape characters use literal substring matching only. A literal listing/decoy regression fails if fuzzy punctuation matching is restored.

GIN candidates use lower(column) LIKE, `%`, and `%>`; the expression matches the index definition. PostgreSQL default thresholds are not changed on pooled sessions. For terms at least six characters long, indexed first/last trigrams also preselect candidates before a fixed word_similarity >= 0.5 check. This catches `wiskey` in `Bourbon Whiskey`, where whole-string similarity is only .278, without an unindexed all-row word-similarity scan. This is bounded typo tolerance, not a guarantee for arbitrary edits, transliterations or every multiword query. Ingredient/instruction/bio/description searches remain partial-only and may scan rows; the four indexes do not promise every combined query will use an index. Benchmark actual full-query plans on an approved development copy before production activation.

The existing recipeVisibleToViewer SQL predicate remains in candidate selection. Product active/category/location/hidden-seller conditions remain in force. New-mode user discovery also excludes suspended, deactivated and closed accounts via the existing accountHidden helper. Canonical routing and public serializers are unchanged. No change is made to `server/routes/drinks.ts` or its withheldPremiumSlugsForViewer calls.

## Manual migration and rollback

`docs/sql-pending/search-trigram-phase1.sql.txt` is intentionally outside automatic migration discovery. Do not apply it as part of start/build/CI against production. Owner authorization is required before production execution.

1. Test on a disposable current-schema development database. Check extension privileges and disk/compute headroom.
2. Use a direct, non-pooled connection; execute each statement separately outside a transaction because indexes are concurrent.
3. Confirm all four index definitions and `pg_index.indisvalid`; IF NOT EXISTS does not repair an invalid interrupted index. Run ANALYZE and inspect representative plans and write overhead.
4. Only then opt into the runtime flag. This PR does not activate it or install the production extension.

Rollback: unset the flag and restart before removing indexes. Execute separately, outside a transaction:

```
DROP INDEX CONCURRENTLY IF EXISTS public.search_recipes_title_trgm_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.search_users_username_trgm_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.search_users_display_name_trgm_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.search_products_name_trgm_idx;
```

Leave pg_trgm installed if any other object depends on it. No authoritative data is stored in the indexes; application rollback is safe with the additive indexes left in place. GIN adds storage, write amplification and vacuum/pending-list maintenance costs; the feature adds no paid service.

## Validation

A dedicated CI job provides CS_TEST_PG_URL at job scope and uses `server/scripts/run-ci-batch.mjs`; the new PostgreSQL suite fails explicitly if the variable is absent. The tests run real SQL for migration reruns, exact/fuzzy ranking, wiskey/spagetti, seller discovery, club privacy, hidden/inactive listings, literal wildcards, category/location filters, default-off SQL and flag-off rollback. A 20k-product fixture checks actual candidate index selection with EXPLAIN ANALYZE after vacuum/analyze; this is local fixture evidence, not a production latency claim.

Real HTTP tests mount the actual autocomplete, recipe, user and Marketplace routers and assert typo matches, current category arrays/public projections, the recipe `items` response, category/location filters and verified-session club access. Three mutations (disable fuzzy candidates, remove recipe visibility, detach Marketplace input validation) each fail that HTTP test. The existing autocomplete recipe-privacy and drink-collection-premium-access suites run with the flag enabled. Local Node 24 needs NODE_OPTIONS=--test-reporter=tap when invoking the current TAP-parsing CI wrapper; GitHub uses Node 22. No old Nov 11 test evidence is reused. Updated actual results and review status are recorded on the PR and in docs/ops/launch-campaign.md.

Plesk tracks only main and auto-deploys it; feature-branch pushes are safe. This PR remains draft. No merge, deployment, production migrations or paid activation is authorized.
