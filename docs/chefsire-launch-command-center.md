# ChefSire launch command center

**Owner's north star:** Launch a reliable ChefSire product that can acquire users, complete real customer journeys, generate verified revenue, and cover operating costs — without sacrificing saved user content.

**Last baseline audit:** 2026-10-27. This document is a launch operating register, NOT proof of production readiness. The GitHub repo, CI logs, billing provider and production tests must be checked before upgrading any status.

## Operating rules
- Status ladder: **idea → code in branch → PR review → CI verified → merged → Plesk deployed → live journey verified → revenue verified**. Never skip or collapse stages.
- Prioritize end-to-end user outcomes, not lines of code, feature quantity or number of merged PRs.
- AI work is reviewed in isolated branches. Codex/Greptile feedback plus automated tests are necessary but not proof of production success.
- **Never automatically** merge PRs, deploy to Plesk, migrate Neon, enable live charges, spend on image generation, erase customer data, or alter provider billing settings. These need owner approval and applicable verification.
- Protect Square ownership/amount/currency/payment evidence, media hosting costs, personal data, and trial preservation.
- Keep Claude's Store Builder work separate from Wedding Square subscription work; compare branches against fresh remote main before merging.
- Avoid deleting legacy Craft.js layout compatibility, plan UI, or API routes just because they appear unused without an explicit owner decision.

## Active execution board
| Priority | Outcome | Current evidence | Next release gate | Owner/team |
|---|---|---|---|---|
| P0 | **Automatic PR validation** | [#1334](https://github.com/myron302/chefsire/pull/1334) open as of 2026-10-27; CI workflow not confirmed on main | Review workflow, confirm green GitHub Actions run, merge; trigger CI against billing and store builder branches | Assistant / Codex / Greptile; owner approves merge |
| P0 | **Marketplace storefront to successful paid order** | Claude audit at main `e3703f6` identifies inert Add to Cart button; seller experience fragmented | Verify active branch against latest main; working Buy Now → existing verified checkout → Square payment → order → seller fulfillment; sandbox end-to-end | Claude Store Builder; independent reviewers |
| P0 | **Wedding Planner subscription revenue** | Cardless trials [#1329](https://github.com/myron302/chefsire/pull/1329), permanent plan controls [#1330](https://github.com/myron302/chefsire/pull/1330) reported deployed; foundation [#1332](https://github.com/myron302/chefsire/pull/1332) merged; quote policy [#1333](https://github.com/myron302/chefsire/pull/1333) open | CI, verified Square sandbox card/customer/consent/enrollment, signed webhook + invoice reconciliation, plan gating and cancellation, THEN live approval | Assistant / Codex / Greptile |
| P1 | **Original ChefSire visual assets** | [#1331](https://github.com/myron302/chefsire/pull/1331) pending review and generation; 100+ images still unresolved in handoff | Confirm ownership/licensing, budget cap and asset-slot QA; don't spend or deploy placeholder images blindly | Image campaign |
| P1 | **Media and map unit economics** | Video/CDN/transcoding and Google Places costs discussed; no verified per-user margin here | Measure vendor bills and traffic, estimate worst-case per-active-user cost, cap/alert before broader launch | Owner + assistant |
| P1 | **Critical journey audit** | Many open historical PRs and multiple product surfaces | Test sign-up → first value → share → purchase, on desktop/mobile; prioritize broken conversion paths | Assistant / QA |
| P2 | **Long-tail feature expansion** | Nutrition, social, clubs, competitions, recipe/drink hubs | Freeze feature growth until P0 user journeys succeed | Product roadmap |

## Current PR watch (not necessarily complete)
- [#1334 automated PR checks](https://github.com/myron302/chefsire/pull/1334) — must first run successfully and merge into main.
- [#1333 Wedding Square billing quote](https://github.com/myron302/chefsire/pull/1333) — code reviews reported clear; actual build/test confirmation pending as of 2026-10-27.
- [#1331 replacement drink photography](https://github.com/myron302/chefsire/pull/1331) and [#1325 import/preservation work](https://github.com/myron302/chefsire/pull/1325) — parallel asset work needs cost/rights control.
- Claude Store Builder cleanup branch `claude/wizardly-noether-6u51er` reportedly pushed, no PR confirmed in this baseline. Restore compatibility endpoints, shared plan UI and retain Craft.js dependency as explicitly requested by owner.
- Historical drafts: treat old PRs as inventory, not as launch-blocking work without a demonstrated production issue.

## Definition of launch-ready
1. Registered user can finish onboarding, log in, and discover useful recipes/social content without crashing.
2. Seller can create and publish store, list item, buyer can pay, provider confirms capture, order and entitlement/fulfillment records reconcile, and seller can act on order.
3. Wedding customer can activate exactly one 14-day cardless trial, see persistent status, explicitly authorize monthly charges, be billed no earlier than disclosed trial end, manage/cancel renewal, and retain their planner data on downgrade.
4. CI green for release commit; critical server + client smoke tests and payment sandbox security tests documented.
5. Operations: VPS/Plesk, database, Google Maps, CDN/media and Square merchant cost/risk ceilings recorded.
6. Real production end-to-end evidence documented separately from code reviews.

## Daily conductor routine
1. Read latest main SHA, open/draft PRs, review comments and CI results; inspect Claude PRs and reconcile conflicts.
2. Identify newly green, stuck, risky, and stale PRs. Cite exact evidence and avoid claiming anything deployed without proof.
3. Recommend **at most three priorities**, each with accountable owner, blocker, smallest deliverable and next validation.
4. Ask for owner approval only at merge/deploy/migration/spending/payment enablement gates. Otherwise perform safe code/doc/review coordination in branch.
5. Record decisions and update the board through a reviewed PR as facts change.

## AI responsibility matrix
- **Owner:** vision, policy, plan pricing, budgets, access/permissions, release approvals, live payment authorization.
- **ChatGPT conductor:** integrate roadmap, inspect repository evidence, write safe implementation PRs, coordinate review findings, surface next action.
- **Claude:** storefront/store-builder implementation on isolated branches; preserve legacy layout and billing boundaries.
- **Codex & Greptile:** independent PR reviews; CI, rather than review receipts, supplies executable test evidence.
- **GitHub Actions:** run Node 22 tests/build and publish visible pass/fail on PRs. No production secrets or deployment in PR workflows.

## Workspace note
This file is the durable in-repository source for the team's development priorities. ChatGPT Work, if available in the account, can be used for deeper autonomous cross-app operating sessions; a chat message does not create or control a Work workspace automatically. A scheduled ChefSire launch briefing separately summarizes new PR status and blockers; neither mechanism independently changes production.
