# ChefSire original drink images — IMG-001 onward

Status: partial implementation for review, not full campaign completion. Prepared October 27, 2026. No new image-generation request or charge was made. No production deployment or merge is authorized by this branch.

## Authoritative inventory and reconciliation

The uploaded `handoff/chefsire-drink-image-inventory.csv` is preserved byte-for-byte, including IDs, concepts, ingredients, destination paths and source references. It supersedes the provisional inventory used in the earlier uncommitted Batch 1 preparation. No Phase 1 re-audit was repeated. `manifest.json` accounts for **all 185 inventory rows** using original IDs where present and inventory-row numbers for blank-ID cleanup rows.

| Inventory action | Rows | Current disposition |
|---|---:|---|
| replace | 136 | 28 replacement slots integrated on feature branch; 108 unresolved |
| replace (reuse) | 5 | Pending appropriate context-specific existing fallback selection |
| replace (reuse hub image) | 4 | Integrated using corresponding local category hub artwork |
| remove reference — do not generate | 16 | Removed after static/helper-consumer verification; no generation |
| investigate → retire after heroes land | 24 | Retained: existing SVGs still have recipe/fallback consumers |

Thus 48 rows are implemented (28 + 4 + 16), and 137 have explicit unresolved dispositions (108 + 5 + 24). This is inventory-row accounting, not a count of unique photographs or a claim that all retained SVGs need replacement. The five generic user-content/category placeholders cannot safely be mapped to an unrelated specific recipe; category artwork for several relevant destinations is still unavailable. The 24 SVGs remain dependencies of active recipe/category fallback mappings (107 source references across those mapping families were found). Deleting them during a partial campaign would break existing behavior.

## Received candidates and quality review

The ZIP contained exactly 33 candidate WebPs, IMG-001–033. Every SHA-256, byte size and native dimension matches its supplied record. All candidates were inspected individually. The supplied source manifest is unchanged in `handoff/chefsire-generated-image-candidates.json`; the supplied README is retained as package context, not as a separate instruction overriding the user's request.

- **27 supplied candidates passed visual review and were integrated** at their exact CSV destinations.
- **Five held candidates** remain outside public assets: IMG-011 (smoke from neat whisky), IMG-014 (smoke/steam from neat mezcal), IMG-018 (purple liquid and lemon/cherry versus current blue-curacao/lime recipe), IMG-021 (CSV cherry versus exact current destination's orange-only Old Fashioned recipe), IMG-024 (honey props versus maple syrup recipe).
- **IMG-032 supplied candidate was rejected** for prominent WHEY PROTEIN lettering and avoidable dessert/recognizable-cookie styling. Its slot uses an optimized derivative of the preserved plain chocolate protein-shake pilot instead.
- Originals of all six held/rejected handoff candidates are retained under `held/IMG-*/`; they are not wired to the application.

The full per-image visual reasons, source location, intended path, generation provenance, output metadata and integration status are in `manifest.json`. Historical exact prompts, model versions, raw generation masters and timestamps were not included for the 33 WebPs. Their concepts are not falsely labeled as original submitted prompts, and unknown dates/model fields remain null. Provenance is the user-supplied assertion of OpenAI ChatGPT generation, not a new generation receipt.

`candidate-similarity.json` compares 33 candidates and five pilots using SHA-256 and a 64-bit perceptual difference hash. Distance ≤8 flags manual review; it is not a semantic duplicate guarantee. The five pilots are hash-checked against their saved records. Compare `pilot-review.json`: Daiquiri, Martini and Bourbon pilots are also suitable but do not require regeneration or duplicate integration; the existing smoothie pilot is retained for later category-specific use. The protein pilot is reused for IMG-032. Owner approval of final publication remains pending PR review.

Multi-drink category scenes are accepted only for their own inventory category; none is a contact sheet represented as multiple completed assets. IMG-012 is the single requested seasonal-category scene. No artwork is assigned to an unrelated named recipe.

## Integration boundaries

Only image constants, fallback references, exact referenced image fields and generated image indexes change. The exact CSV destinations are respected. Hub cards share category hero mappings, so changing one mapping updates those cards too. Virgin Cocktails continues to redirect to Mocktails; its distinct existing hub card gets IMG-015, without adding or changing a functional route.

Recipe source data was checked before accepting named recipe imagery. No ingredient, nutrition, instruction, route, authentication, payment, subscription or migration change is part of this work. The generated client and server drink indexes were refreshed with `node --import tsx scripts/generate-drink-index.ts`; a JSON comparison verified only six recipes' image fields (duplicated across index views) and generation timestamps changed.

A desktop crop check found that the existing shallow banners clipped rims and garnishes. The shared hero and custom Rum/Tequila image consumers now honor a category visual fit class; accepted local hero photographs use `object-contain` and right alignment inside the unchanged dark banner. This preserves the full image at desktop and mobile sizes, without stretching or editing the supplied files. Existing stock heroes retain their existing cover behavior.

The 27 accepted WebPs were already optimized and remain byte-identical to the handoff. The protein pilot was exported locally to WebP quality 87 without changing its PNG original. Actual dimensions, sizes and checksums are in the manifest. No native raster was upscaled, stretched or substituted with downloaded stock. Existing stock references for blocked slots remain explicitly unresolved; no claim of a stock-free site is made.

The 16 unused image properties had no direct consumers or helper call sites outside definitions and barrel exports. Their dynamic size helpers now use optional size records so a missing unused hero property still returns its existing appropriate category fallback. No new image was generated for these rows.

## Remaining generation and cost blocker

**October 27 follow-up:** The former proposed `gpt-image-1` default was retired and has been replaced by `gpt-image-2`. See [verified contract and published estimates](gpt-image-2-verification.md), [three-image setup instructions](account-setup.md), [five fallback reviews](generic-fallback-review.json), [24 SVG dependency reviews](svg-dependency-review.json), and [five held correction specifications](held-artwork-corrections.md). The existing manifest and all integrated/held raster bytes remain unchanged. The proposed test covers IMG-034/035/043 at high 1536×1024: $0.495 output-only, approximately $0.507 with the saved prompt-byte planning scenario, and a $0.75 reservation proposal. No authorization or generation has occurred.


There are **103 never-generated IDs, IMG-034–136**, starting with Workout Drinks and Cold Brew. Five earlier held slots may require corrected artwork, giving up to 108 additional one-image requests before further suitable reuse. `generation-plan.json` preserves their IDs, exact destinations and prompts. The first ten category concepts are source-verified; later recipe prompts require source verification and evidence before execution.

No OpenAI API credential is configured and the enforced network policy omits `api.openai.com`. The built-in image tool is raster-capable but exposes no underlying model or billing information. The public guide now provides a verified output-cost estimate; account-applicable standard-rate confirmation remains pending. Do not confuse a published estimate with an invoice guarantee or assume the built-in tool is free.

The executable pipeline and exact prerequisite steps are documented in `tools/drink-image-campaign/README.md`. The updated API configuration is `gpt-image-2`, high quality, 1536×1024 PNG with local WebP export; public support and cost estimates are documented, while account generation access and applicable standard-rate confirmation remain unverified. Actual charges need explicit user approval of a concrete verified budget before any request. No API key should be pasted into chat or committed. `budget.example.json` is deliberately unapproved.

The pipeline preserves prompts, originals, usage and checksums; processes individual images sequentially in groups of ten; checks source hashes and approved ID scope; reserves budget before each request; and retains reservations for uncertain outcomes without automatic retries. The follow-up expands the mocked spending/contract tests to 22 passing tests; see `followup-verification.json`. It produces candidates outside production assets and does not pretend automated file validation is sufficient visual approval.

## Verification

`npm run build:client` passed after final integration and index generation. Existing Vite chunk-size warnings remain. `npm run check` fails with **3,194 pre-existing diagnostics**, matching baseline file/line/column/code counts with **no added or removed diagnostic locations/codes**. Diagnostic union-type text ordering varied; a location/code comparison was used rather than an unstable text diff. Examples are App.tsx route-prop typing and duplicate identifiers in shared/schema.ts. No unrelated TypeScript fixes were attempted. Details are in `verification.json` and `typescript-baseline.md`.

The built preview passed 44 route/viewport checks at 375px and 1440px with no broken local images or page errors. Forced Gin-image failure loaded the local neutral fallback. Six changed canonical recipes and two Featured tabs passed at both widths; four representative full-image hero fits were confirmed at both widths after the crop fix. The broad check initially found Rum mobile horizontal overflow; final element inspection identified unchanged header navigation items, which this image campaign does not modify. Backend responses were mocked and remaining stock-image requests blocked, so these checks establish local image/layout behavior rather than backend or production functionality.

Browser verification results and limitations are recorded separately in `verification.json` after checking the built local client. Local preview verification does not establish production deployment behavior. The PR remains a partial campaign review with provider/budget, five held slots, five generic fallback selections and 24 SVG investigations explicitly outstanding.
