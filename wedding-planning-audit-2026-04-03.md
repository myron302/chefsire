# Wedding Planning Audit — 2026-04-03

Scope reviewed:
- `client/src/pages/services/wedding-planning.tsx`
- `client/src/pages/services/wedding-planning/*`
- `client/src/pages/services/wedding-map/*`
- `client/src/pages/services/vendor-listing.tsx`
- `client/src/pages/services/public-registry.tsx`
- `client/src/hooks/use-wedding.ts`
- `server/routes/wedding-*.ts` and `server/routes/vendor-subscription.ts`
- route mounting in `client/src/App.tsx` and `server/routes/index.ts`

## Primary hotspots

1) **Monolithic wedding planning workspace (highest priority)**
- `client/src/pages/services/wedding-planning.tsx` is ~5k lines and acts as domain state manager, API client, business-rules engine, and UI renderer in one file.
- It owns many independent state groups (budget, tasks, registry, insights, guests/RSVP, event details, calendar, vendors, trial/paywall) and multiple persistence effects.
- Risk: side-effect coupling, high cognitive load, and fragile behavior during future edits.

2) **Repeated fetch/persistence patterns in one component**
- The planning page repeats similar "load on user change + debounce save" effect patterns per domain (tasks, budget, registry, insights).
- Error handling and fallback behavior are inconsistent by domain.
- Risk: drift, regressions, and difficult test coverage.

3) **Route-level micro-pages are thin wrappers over a single giant orchestrator**
- `client/src/pages/services/wedding-planning/{budget,calendar,checklist,invitations,registry,vendors}.tsx` just pass `mode` into one large workspace.
- Good for URL structure, but all complexity remains centralized.

4) **Vendor and map surfaces are sizable standalone orchestrators**
- `client/src/pages/services/wedding-map/index.tsx` (~1.1k lines) does category caching, union logic, search orchestration, detail fetching, export, and UI.
- `client/src/pages/services/vendor-listing.tsx` (~864 lines) combines marketing content + multi-step submission flow.
- Risk: these are secondary hotspots; should be handled after the main planning workspace split.

5) **Potentially stale/unused wedding hook surface**
- `client/src/hooks/use-wedding.ts` uses endpoints (`/api/wedding/vendors`, `/api/wedding/quotes`, `/api/wedding/saved-vendors/:id`, `/api/wedding/vendor-message`) that do not match the active planner quote route shape (`/api/wedding/vendor-quotes`).
- Likely dead or drifting abstraction; risky if reintroduced without reconciliation.

6) **Backend wedding routes are numerous and mostly vertically sliced**
- Wedding backend is split across many route files (tasks, budget, registry, insights, calendar, event details, RSVP, subscription, vendor listings, vendor quotes).
- Each small route file repeats a similar `ensure*Table` + sanitize + CRUD pattern.
- This is maintainable enough today, but a future cleanup should centralize shared helpers after frontend risk is reduced.

## Architecture snapshot

### Main user-facing wedding surfaces
- Wedding planning hub + focused modes under `/services/wedding-planning/*`
- Wedding vendor map `/services/wedding-map`
- Vendor onboarding/listing `/services/vendor-listing`
- Public registry view `/registry/:slug` and internal registry management in planner

### Biggest orchestrators
- `client/src/pages/services/wedding-planning.tsx` (primary)
- `client/src/pages/services/wedding-map/index.tsx` (secondary)
- `client/src/pages/services/vendor-listing.tsx` (secondary)

### Most reused subcomponents in scope
- In this area, reuse is limited; wedding planning is mostly in one mega-file with local sections.
- `wedding-planning/*` mode files are route wrappers only.
- `MapView.tsx` is a reusable boundary around Google Maps rendering.

### Complexity center assessment
- **Mostly frontend complexity right now** (state orchestration + UI + per-feature fetch logic in planner page).
- Backend complexity exists but is comparatively modular per feature route.
- Schema complexity is moderate (JSONB-backed settings/tasks/insights + RSVP/event tables).

### Overlap with vendor/marketplace/email flows
- Planner overlaps with vendor quotes (`/api/wedding/vendor-quotes`) and links into vendor listing and vendor map.
- RSVP invites tie into email delivery and notification services.
- Subscription gating spans planner UI and wedding subscription routes.

## Safest next refactor recommendation

### Refactor first
**Start with frontend page cleanup in `wedding-planning.tsx`, without changing behavior.**

Why safest:
- Highest blast radius reduction.
- Can be done incrementally by extracting internal modules/hooks while preserving API contracts and rendering output.
- Avoids premature backend/schema changes while behavior is still concentrated in one page.

### Do NOT touch yet
- Do not merge/rename backend wedding endpoints yet.
- Do not alter RSVP email/token flow yet (security + deliverability + user-facing links).
- Do not redesign data models in DB yet.

### Safe modularization candidates (no behavior change)
1. `useWeddingPlanningTasksPersistence` (load/save/debounce).
2. `useWeddingBudgetSettingsPersistence`.
3. `useWeddingRegistryLinksPersistence`.
4. `useWeddingInsightsPersistence`.
5. Pure utility modules for normalization/calculation (budget math, RSVP CSV export, roadmap/insight derivation).
6. Section components split by mode (`ChecklistSection`, `BudgetSection`, `VendorsSection`, etc.) receiving explicit props.

## Suggested next 2–3 passes

### Pass 1 (safest, highest ROI)
- Extract pure helpers and persistence hooks from `wedding-planning.tsx` into `client/src/pages/services/wedding-planning/` modules.
- Keep JSX structure and route behavior unchanged.
- Add lightweight tests for pure helpers only.

### Pass 2
- Extract mode sections into presentational components with typed props.
- Keep state ownership in `WeddingPlanningWorkspace` for now.
- Normalize loading/error/empty-state UI patterns across sections.

### Pass 3
- Evaluate whether to split remaining orchestrator state by domain context/reducer.
- Only after frontend extraction stabilizes, decide whether backend helper consolidation is worth doing.
- Reconcile or remove stale `use-wedding.ts` abstraction if confirmed unused.

## Risky areas to avoid (for now)
- RSVP token/response flow and invitation email wiring.
- Subscription gating branches affecting paid/free behavior.
- Calendar/date normalization paths that already include compatibility handling.
- Any large endpoint contract rename that would require multi-page coordinated updates.
