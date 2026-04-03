# Pantry / Inventory Audit (April 3, 2026)

## Scope audited
- `client/src/pages/pantry/*`
- Pantry-adjacent grocery/inventory surfaces in `client/src/components/NutritionMealPlanner.tsx` and meal-planner sections/modals.
- Coupled server routes in:
  - `server/routes/pantry.ts`
  - `server/routes/meal-planner-advanced.ts`
- Domain boundary check in:
  - `shared/schema/domains/pantry-allergens-community.ts`

## Main hotspots

### 1) `client/src/pages/pantry/index.tsx`
- **Why it is a hotspot**
  - Very large orchestrator page (~1300 lines) that mixes data fetching, mutation logic, URL-driven scanner ingestion, filtering, derived stats, and most rendering concerns in one file.
  - Contains multiple direct `fetch` calls and mutation handlers in-page, plus a nested `AddItemForm` component at the bottom.
  - Duplicates grocery-list integration logic that also exists in other pantry/grocery surfaces.
- **Risk indicators**
  - Mixed concerns make regression risk high for even simple UI updates.
  - Several query/mutation flows are tightly coupled to local state + toasts.

### 2) `client/src/components/NutritionMealPlanner.tsx`
- **Why it is a hotspot**
  - Extremely large (~2000 lines), with pantry/grocery logic embedded alongside meal-planning, water/streak/body metrics, premium gating, scanner handling, and modal orchestration.
  - Reimplements grocery fetch/add/toggle/check-pantry flows that overlap with pantry pages.
  - Heavy local state surface with many imperative handlers.
- **Risk indicators**
  - Highest prop/event orchestration complexity in this domain.
  - Bug fixes in grocery behavior likely need duplicated edits across multiple places.

### 3) `client/src/pages/pantry/household.tsx`
- **Why it is a hotspot**
  - Medium-large (~630 lines) but mostly network orchestration: many household mutations (create/join/leave/sync/resolve/invite/accept/decline/remove) in one component.
  - Polling + mutation invalidation are repeated in this file.
- **Risk indicators**
  - Debug/operational error details are surfaced directly in UI toasts; brittle if backend payload shape shifts.

### 4) `server/routes/pantry.ts`
- **Why it is a hotspot**
  - Route file does CRUD + backward-compat routes + household membership/invite lifecycle + runtime schema/table bootstrapping in one module.
  - Runtime `ensureHouseholdSchema()` DDL in request path increases coupling and surprises.
- **Risk indicators**
  - Backend contract drift risk is high because many consumer pages rely on this file.
  - Legacy user-id routes and session routes coexist with inconsistent auth assumptions.

### 5) Pantry ↔ grocery coupling in `server/routes/meal-planner-advanced.ts`
- **Why it is a hotspot**
  - Grocery endpoints and pantry integration are mixed inside a broad “advanced meal planner” router.
  - Pantry matching logic (`check-pantry`) is string-contains matching and updates rows in-place.
- **Risk indicators**
  - Any grocery contract changes can affect pantry pages, nutrition page, and recipe-kit flows simultaneously.

## Architecture map (brief)

### Main user-facing pantry / inventory surfaces
- `/pantry` → primary pantry dashboard + add/edit/delete + scanner ingestion handoff + quick links.
- `/pantry/shopping-list` → standalone grocery list CRUD and barcode add flow.
- `/pantry/household` → household membership/invite/sync/duplicate resolution.
- `/pantry/recipe-matches` → pantry-based recipe suggestions.
- `/pantry/scanner` → scan + lookup + redirect into `/pantry` with URL params.

### Biggest orchestrators/pages
1. `client/src/components/NutritionMealPlanner.tsx`
2. `client/src/pages/pantry/index.tsx`
3. `client/src/pages/pantry/household.tsx`

### Most reused subcomponents
- Pantry-adjacent: `GroceryTabSection`, meal-planner modals (`AddGroceryItemModal`, `PantryModal`, etc.), `BarcodeScanner`, and shared UI primitives.

### Complexity distribution
- **Mostly frontend complexity first**, then route-contract complexity.
- Backend complexity is moderate but centralized in big route files.
- Schema complexity is lower, but boundary drift is visible: the shared pantry schema module does not declare `household_id` on `pantryItems` while routes alter/use it at runtime/migrations.

### Pantry overlap with grocery / meal-planner
- Strong overlap.
- Pantry pages and NutritionMealPlanner both perform grocery-list CRUD/check-pantry and scanner-driven add flows.
- This overlap is the top duplication hotspot and safest first target for non-behavioral extraction.

## Safest next refactor pass recommendation

### Refactor first
**Start with frontend page cleanup**, specifically extracting a shared pantry/grocery API + normalization layer without changing endpoint behavior.

Candidate first extraction units:
1. `client/src/lib/pantry-api.ts` (pantry CRUD + expiring + household info fetch).
2. `client/src/lib/grocery-api.ts` (list/add/update/delete/toggle/check-pantry/optimize).
3. `client/src/lib/pantry-grocery-normalizers.ts` (quantity/unit parsing + item normalization).

This removes duplicate `fetch`/mapping/parsing logic from:
- `client/src/pages/pantry/index.tsx`
- `client/src/pages/pantry/shopping-list.tsx`
- `client/src/components/NutritionMealPlanner.tsx`

### Do NOT touch yet
- Household backend semantics in `server/routes/pantry.ts` (owner-leave rules, invite lifecycle, duplicate resolution behavior).
- Matching heuristics in `check-pantry` or recipe suggestion semantics.
- Scanner lookup/provider behavior (`/api/lookup/*`, `/api/products/barcode/*`) beyond mechanical call-site extraction.

### Safe modularization opportunities (low behavior risk)
- Split presentation-only sections from `pantry/index.tsx` (filters toolbar, summary cards, inventory list row, add/edit dialogs).
- Convert repeated amount parsing and grocery payload construction into pure utility helpers.
- Centralize toast copy helpers for recurring success/failure patterns.

### Backend vs frontend vs schema order
1. **Frontend cleanup first** (largest immediate risk reduction with least contract churn).
2. Backend route cleanup second (only after frontend callsites are centralized and testable).
3. Schema split/normalization third (after route boundaries are clarified).

## Suggested next 2–3 passes

### Pass 1 (safest, no behavior change)
- Add shared client API modules for pantry/grocery endpoints.
- Move request + response normalization + quantity parsing there.
- Replace duplicated inline `fetch` logic in pantry index + shopping-list + NutritionMealPlanner callsites.

### Pass 2 (UI orchestration split)
- Split `client/src/pages/pantry/index.tsx` into container + presentational sections.
- Keep hooks/mutations in container; move cards/dialog bodies/list rendering into small components.
- Add explicit loading/error/empty subcomponents for consistency.

### Pass 3 (route boundary tightening)
- Split `server/routes/pantry.ts` into `pantry-items` and `pantry-households` route modules.
- Keep endpoint contracts unchanged.
- Replace runtime DDL bootstrapping with startup/migration-time guarantees (if infra allows) in a follow-up.

## Risky areas to avoid right now
- Any endpoint path/shape changes (e.g., pantry update route naming quirks) while multiple pages still call endpoints directly.
- Household mutation semantics and duplicate-resolution rules.
- Broad schema edits until frontend callsites are centralized and easier to update in one place.
