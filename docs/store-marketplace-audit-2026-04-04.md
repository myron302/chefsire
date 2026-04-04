# Store / Marketplace Audit (2026-04-04)

Scope: focused audit of store/marketplace/product-listing/purchase-adjacent surfaces.

## Surfaces audited
- `client/src/pages/store/*`
- `client/src/pages/marketplace/ProductPage.tsx`
- `client/src/components/store/*`
- `client/src/pages/checkout/CheckoutPage.tsx` (purchase-adjacent)
- `client/src/lib/store/products.ts` (store product API wrapper)
- `server/routes/marketplace.ts`
- `server/routes/stores-crud.ts`
- `shared/schema/domains/commerce-billing.ts`
- `shared/schema/domains/ops-wedding.ts` (store table and store layout typing)

## Biggest hotspots

1. **`client/src/pages/store/ProductFormPage.tsx` (~777 lines)**
   - High-responsibility page: create/edit mode orchestration, validation, image upload, digital file upload, delivery mapping, and API mutation are all in one component.
   - Contains domain mapping logic (`deliveryMethods` <-> shipping/pickup/in-store/isDigital) that is duplicated server-side.
   - Uses many inline validation branches and async flows that are hard to unit-test in isolation.

2. **`client/src/pages/store/StoreDashboard.tsx` (~653 lines)**
   - Orchestrates 4+ separate fetch chains (store, products, stats, tier, recent sales) and several mutation paths (publish, theme, customization, subscription checkout).
   - Mixed concerns: analytics display, product management shell, subscription pricing cards, and store-builder launcher all in one file.
   - Error states are mostly toast-only; partial-load and stale-state scenarios are not explicitly modeled.

3. **`client/src/components/store/StoreCustomization.tsx` (~609 lines)**
   - Very large form state object with broad nested configuration and direct upload integration.
   - Uses `any` for store/config update shapes, making frontend/backend layout-contract drift more likely.

4. **`client/src/pages/store/Marketplace.tsx` (~525 lines)**
   - Heavy page with fetch + client-side filtering/sorting + pagination + 2 card render modes.
   - Duplicates delivery/category display rules that also exist in product/store viewer surfaces.
   - Filter query composition is split across URL params + in-memory filtering, creating behavioral drift risk.

5. **`server/routes/marketplace.ts` (~310 lines)**
   - Route-level domain logic includes tier limits, zod schemas, delivery-method translation, and analytics helpers.
   - `deliveryMethods` translation appears in both create and update handlers.
   - Frontend and backend use overlapping but not identical delivery method tokens (`shipped/pickup/digital_download` vs `shipping/local_pickup/digital` seen in UI helpers).

## Architecture map (brief)

### Main user-facing surfaces
- Marketplace browse/list: `/store` (alias from `/marketplace`).
- Product detail: `/product/:id`.
- Storefront public page: `/store/:handle`.
- Seller/admin pages: `/store/create`, `/store/dashboard`, `/store/products/new`, `/store/products/edit/:id`.
- Checkout-adjacent: `/checkout?productId=...`.

### Primary orchestrators
- `StoreDashboard.tsx`: seller control center + tier management.
- `ProductFormPage.tsx`: product creation/edit orchestration.
- `Marketplace.tsx`: browse/search/filter + list/grid rendering.
- `StoreViewer.tsx`: store + product loading with owner/unpublished behavior branches.

### Most reused subcomponents
- `ProductCard`, `StoreHeader`, `ProductManager`, `ThemeSelector`, `StoreCustomization`, `SubscriptionPlansModal`, `StoreBuilder`.

### Complexity distribution
- **Mostly frontend orchestration complexity**, with meaningful backend coupling in:
  - delivery method mapping,
  - product/list/search payload shape,
  - store publishing/visibility behavior.
- **Schema complexity is moderate** for this area (products + stores are in split domain files), but frontend typing currently under-leverages schema-derived typing.

### Overlap with purchases / subscriptions / vendor flows
- Store dashboard contains subscription upgrade launch path (Square checkout link flow).
- Product and checkout pages couple through `/api/marketplace/products/:id` payload fields and shipping expectations.
- Vendor listing is largely separate in route/module space; not an immediate first-pass dependency for store cleanup.

## Safe next refactor recommendation

### Refactor first
1. **Frontend API contract extraction (no behavior change)**
   - Introduce typed API client/hooks for store+marketplace endpoints used by `Marketplace`, `ProductPage`, `StoreViewer`, `StoreDashboard`, and `ProductFormPage`.
   - Centralize delivery-method normalization helpers in one shared frontend module.

2. **Page-level orchestration split for `StoreDashboard`**
   - Extract data-loading hooks (`useStoreDashboardData`) and mutation helpers (`useStoreDashboardActions`) without changing JSX behavior initially.

3. **Form logic extraction for `ProductFormPage`**
   - Move validation and payload-building logic into pure helpers.
   - Keep route behavior and UI unchanged while shrinking the page component.

### Do NOT touch yet
- End-to-end checkout/payment flows (`SquarePaymentForm`, order checkout route) beyond read-only coupling review.
- Store builder internals (`StoreBuilder`) during first pass, since it is a separate interaction-heavy domain.
- Backend route behavior changes (especially tier limits and store visibility rules) until frontend contract stabilization is complete.

### Safe modularization candidates
- `client/src/pages/store/ProductFormPage.tsx`: split into `productForm.validation.ts`, `productForm.payload.ts`, and upload hook.
- `client/src/pages/store/StoreDashboard.tsx`: split dashboard loader/actions and subscription card block.
- `client/src/pages/store/Marketplace.tsx`: extract filter state + query adapter + shared product list item/card rendering.
- `server/routes/marketplace.ts`: extract `deliveryMethods` mapping and shared product schema fragments (internal module-only move first).

## Suggested 2–3 pass plan

### Pass 1 (lowest risk): Contract + helper extraction
- Add typed interfaces around marketplace/store API responses in one shared client module.
- Extract frontend delivery-method constants + mapping helpers.
- Replace per-page ad-hoc fetch response casting with typed helpers.

### Pass 2: Orchestrator slimming
- Extract `StoreDashboard` data loading + actions to hooks; preserve existing tabs and rendering.
- Extract `Marketplace` query/filter/sort state management into dedicated hook.

### Pass 3: Form and backend-adapter cleanup
- Extract `ProductFormPage` validation/payload/upload helpers.
- Extract and reuse backend `deliveryMethods` conversion helper between create/update handlers.
- Add focused tests for payload conversion and key empty/error states.

## Risky areas to avoid for now
- Any changes to delivery token values without a full cross-page + route compatibility sweep.
- Any shift in unpublished-store visibility behavior (`/api/stores/:handle` owner logic).
- Subscription checkout redirect flow behavior in dashboard until isolated tests or sandbox verification are in place.
