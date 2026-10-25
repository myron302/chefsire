# Unrelated TypeScript baseline

`npm run check` (`tsc`) does not pass on this repository's unchanged `main`
commit `7a46f9d61afd685ff1dac9cd686354f17346e18c`.

An archived copy of that commit, using the same installed dependencies, reports
3,194 diagnostics. The trial implementation reports 3,190. Four existing selector
union-property errors (`popular`/`trialDays`) were fixed while editing that file.
No additional diagnostic locations were introduced in changed files.

Representative unrelated failures:

- `shared/schema.ts`: duplicate adaptive planner and nutrition profile exports.
- `server/routes/drinks.ts`: missing/incompatible schema properties and implicit
  `any` types (1,454 diagnostics); pre-existing undefined shorthand names
  `followersUnlockedAt` and `publicUnlockedAt` at lines 9979–9980.
- `server/routes/drinks/rollout-routes.ts` and `dashboard-routes.ts`: existing
  property/type errors (145 and 136 diagnostics respectively).
- Drink page category unions and old social-feed fixtures incompatible with the
  current user schema.
- `client/src/pages/services/wedding-planning.tsx`: existing ES target/Map iterator
  and readonly vendor-array assignment errors.
- `client/src/pages/settings.tsx`: existing `User.isChef` type mismatch.
- Existing Express `User.id` declaration conflicts in older route handlers.

Diagnostic wording/union ordering varies between incremental and clean runs.
For example, the two undefined drinks shorthand names are reported as TS18004
in the clean baseline and TS2552 with suggestions in the incremental check; the
source locations are unchanged. These are not trial regressions.

Both required bundle builds pass. Bundling is not a substitute for a clean
repository-wide type check; the baseline work remains separate from this PR.
