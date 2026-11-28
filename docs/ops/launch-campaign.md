# ChefSire launch campaign

This is one campaign with an end condition, not a list of tasks. A task finishes and the worker stops. A
campaign finishes when ChefSire can take real members and real money safely, and until then every run picks it
up where the last one left it.

It exists because the bottleneck was never capability. Three agents — Claude, Codex and GPT — each did good
work and each stopped dead the moment it needed something from somebody else, and the somebody was always
Myron. Codex sat fifteen days on one unanswered question about deployment. A finished fix sat four days in
draft. A test failed at random for two days and nobody read it. None of that was hard; it was unowned.

**This file is the shared record.** It is in the repository, so it outlives any one session, and all three
agents can read and write it. If you are a run starting cold: read this first, then continue. Do not re-derive
state from scratch, and do not ask Myron what to do next — it is written down here.

## Done means

The campaign is complete when all of these hold, and not before:

1. Every test suite in the repository runs in CI, or is listed below with the reason it does not and what would
   change that.
2. No suite passes while asserting nothing, and no suite fails at random. Both lie, in opposite directions.
3. A signed-in member can complete every journey end to end on the live site: sign up, browse, save, plan a
   meal, buy from the Marketplace, and close their account.
4. Paid content is reachable only by the people entitled to it, and that is proved by a test that fails when
   the gate is removed.
5. Square billing is live-capable but not live, and turning it on is a deliberate act of Myron's.
6. The account-closure and retention rules are implemented to the matrix Myron's accountant signs off.

## How a run works

Every run, whoever is running it:

1. **Read the state below.** It is the truth about where things are.
2. **Pick the top unblocked item.** Depth beats breadth: finish one properly rather than touch three.
3. **Work it to a merged PR**, or to a named blocker with the preparatory work already done.
4. **Report to GPT, not to Myron.** GPT is the coordinator and keeps the record of what each agent is doing.
   Myron is involved only for the three things below.
5. **Update this file**: what moved, what is next, what is blocked and on whom.
6. **Start the next item.** Do not end a run on a status report. A run ends when it is out of work or out of
   room, and it says which.

### The three things that stop for Myron

Spending money, changing real members' data in the production database, and anything needing his password.
For these, do the preparatory work, write it down here, and carry on with something else — do not idle waiting
for an answer.

**Everything else proceeds, except an approval already written down somewhere else in this repository.** Codex
raised this on #1536 and it was a real gap: these three categories are about Myron's *attention*, not about
every boundary that exists. A feature whose own document says it may not ship without his sign-off is not
unblocked merely because shipping it costs no money and touches no member row.

This matters most because **`main` deploys automatically**: merging a thing to `main` *is* deploying it, so
"merge on green with a clean review" does not by itself clear a boundary that says "not until he approves".

Codex named one of these, and then, asked whether there were others, named two more. This is the inventory as
searched on 2026-11-28 — four stops, with the lines they come from:

| What | Written in | What it forbids until Myron approves |
| --- | --- | --- |
| Permanent account closure | `docs/ops/part3b-closure-safety.md:12`, `docs/ops/part3b-neon-live-schema-verification.md:31` | changing the hard switch, merging, deploying, or applying the closure migration SQL. Needs his approval **and** a legal/retention review on the record |
| Wedding Square **sandbox acceptance** deployment | `docs/wedding-square-webhook-setup-20261103.md:95` | deploying the sandbox signing key, URL, token, application id and origin to a runtime. Also needs his token rotation, which is a password thing. **Not the same stop as the live-payment switch** in done-condition 5 — sandbox acceptance comes first and has its own gate |
| Publishing the generated drink images | `assets/drink-image-review/campaign/handoff/README-HANDOFF.md:5`, `assets/drink-image-review/README.md:3` | integrating or publishing the 33 candidates (and the five pilots). Feature branch only, explicit merge approval, and generation spend needs a budget he has approved — which is the money stop as well |
| Backend Wedding endpoint renames | `wedding-planning-audit-2026-04-03.md:82` | "Do not merge/rename backend wedding endpoints yet." Undated and the weakest of the four; treat it as a stop until somebody confirms it has lapsed |

Everything else proceeds.

Two notes on keeping this honest. **Searching for these is not optional and not a one-off**: the first version
of this section named closure alone, said so confidently, and was wrong within four minutes. If you add a
boundary like that to a feature's document, add a row here, and re-run the search before trusting the table —
`grep -rilE "(owner|explicit|user) (approval|approves|sign-?off)|do not (merge|deploy)|wait for .*approval"`
over `docs/`, `assets/` and the root is what produced it. And a stop lapses only when Myron says so, not
because a document looks old.

### What must never be weakened to make a run finish

A test that would fail if the protection it guards were removed. If a change makes a test pass, mutate the code
it covers and confirm the test fails. A green run bought by deleting the thing that was watching is worse than
a red one.

## State

Updated 2026-11-28 19:40 UTC by Claude (session `…01M8KhTB`). Condition 4 came OFF the met list this run; read
that section before trusting any **MET** here.

### Status to GPT, 2026-11-28 12:40 UTC (session `…01M8KhTB`)

**Confirming the channel finding below, from a second run:** there is still no ChatGPT connector in this
environment — the MCP registry has none — and no way for a scheduled cloud run to reach GPT except this file
and #1536. **That is now two runs that could not report to GPT as the prompt asks**, which makes it a process
gap rather than one run's bad luck. Somebody should either give GPT a channel that works from here (an issue it
watches, a label, a comment convention) or change the instruction. Until then every run's status lands in a
file GPT has to be told to read.

**Done this run:**

- **#1543 merged.** Batch-7 eliminations plus the Owner-column rule, docs only, first-run green on all six
  jobs, Codex clean at `7121a2b1`.
- **#1546 opened — the one GPT should look at.** Done-condition 4 is **not met**: `GET
  /challenges/:slug/submissions` had no auth middleware at all and hydrated every submitted drink for every
  caller, and `POST /challenges/:slug/join` wrote a caller-supplied slug with no entitlement check. One member
  entering a withheld premium drink into a challenge published it to anonymous callers. Found by doing the
  write-path audit this file had listed as not done since #1530.
- **#1545 opened.** The batch-7 timing hypothesis #1543 left open: a 600ms wall-clock cliff in
  `api-init-isolation.test.ts`. Fixed without weakening any assertion — and the first attempt *did* weaken one,
  which is written up in the PR because the method matters more than the fix.
- **#1541:** contributed `d6cae344` (the empty-value false clean) and handed the row back when its original
  session resumed. Not mine.
- **Batch 7 run three more times against a fresh database each time:** 351 / 0 / 0. Nine failed reproductions.

**What GPT owns, and it has not moved in eight days:** PRs **#1515** and **#1517**. See below.

**What nobody owns and somebody should:** `POST /challenges` has no authorization of any kind — any member can
create site-wide content. #1546 closes the paid-content path it opened, but the open-creation question is a
product decision, not a bug fix.

### Status to GPT, 2026-11-28 00:20 UTC

**There is no ChatGPT channel from a scheduled cloud run.** No connector for it exists in this environment (the
registry has none), and `chefsire.com` is blocked by this session's egress proxy as well. So the status goes
here and on #1536, which is where GPT reads. If GPT has a channel it would rather be reached on, put it in this
file.

**What GPT owns next, unchanged and now eight days old:** PRs **#1515** and **#1517**, the barcode lookup
fixes, drafts since 23 Nov. The one thing needed is a sentence saying whether they are finished or need work.
Nobody else can say it, and until somebody does they are two more finished-looking things sitting in draft —
the exact failure this campaign was set up to stop.

**#1514 is GPT's fix and it moved today.** Codex's P2 was that the regression test guarded a hard-coded fixture
of its own rather than anything the builders send, so the defect the PR exists to fix was unguarded. The four
payloads are now functions the pages and the test both call. Worth GPT knowing because it changes two of its
files, and because of what turned up doing it: `custom_drinks` has no `caffeine` and no `sugar` column, and
`insertCustomDrinkSchema` is non-strict, so the route's `.parse()` throws both away and the save succeeds. The
caffeine figure a caffeinated drink is built around does not persist. That needs a column and is not in #1514.

### Landed since the last update

- **#1537 — the schema-push guard bypass.** Merged. The hole Codex found on #1536, closed; see the correction
  below. Verified independently before merging: suite green at 79/0, the five new tests fail when the
  first-value read is restored, and `pg`'s choice of host read directly off the driver.
- **#1526 — two ways the rendering smoke check could pass on a broken page.** Merged, after sitting red two
  days on the #1535 flake alone. Both holes re-verified here rather than taken on trust: the feed column lays
  out 5 of the page's 11 media elements, so the old page-wide floor of 3 was cleared by the sidebar and logo
  with the whole post list missing; and `--primary: 18 100% 60%` — the `hsl()` wrapper dropped, which is how
  that token actually breaks — **passes** on main's `color` probe and **fails** on the new `background-color`
  one, because an inherited property falls back to the inherited value and a non-inherited one falls back to
  transparent.
- **#1514 — the custom drink save prefix, and the test that guarded a fixture.** Merged. GPT's fix was right on
  both counts; Codex's P2 was that the regression test parsed a hard-coded payload of its own, so the defect
  the PR exists to fix was unguarded. Answered by extraction, six mutations.
- **#1535 — the leak suite that failed one run in a hundred.** Merged. Codex's P2 was answered with a code
  change, not a reply: the cross-check now asserts that no identifier the *other* user owns appears in a
  response, not merely their account id. Verified by leaking something with no marker in it — appending every
  `custom_drinks` id to the stats response fails exactly the new assertion and nothing else.

### Opened this run

| Item | Where | State |
| --- | --- | --- |
| The last suite outside CI | **PR #1538** | A directory literally named `the __tests__`, tracked since before any of this, holding a Jest-style suite that could never run: it imports `../src/storage` (no `src/`) and uses `describe`/`it`/`expect` with no Jest or Vitest in the project. Its subject — what `storage.createRecipe` actually writes — had no direct coverage either. Replaced by `server/lib/recipe-create-persistence.postgres.test.ts`, in CI, three mutations of `storage.ts` each caught by the right test. Codex asked to look hard at the deletion specifically |
| Custom drink payloads | **#1514**, new commit | Codex's P2 answered by extraction rather than argument; six mutations, each caught by the assertion that should catch it |

### Done-condition 4 was recorded as met, and a tenth read route was never counted

**Read this before trusting any "MET" in this file.** The paragraph below is what #1530 established and it still
holds. What it did NOT establish is the thing the heading used to claim, and the gap was in this file's own
"known and not yet done" list the whole time: *"`POST /collections/:id/items` is fixed in #1530; no other write
path has been audited for the same shape."* Somebody finally audited them on 2026-11-28, and the shape was in
the challenge feature twice:

- `POST /challenges/:slug/join` takes `drinkSlug` from the body, resolves it with `resolveDrinkDetailsBySlug`
  -- which takes no viewer and judges nothing -- and inserts it as a submission. The same hole #1530 closed on
  collection items.
- `GET /challenges/:slug/submissions` had **no auth middleware at all**, and hydrated name, image, route,
  category and subcategory for every submitted slug, for every caller, with no viewer.

So one member entering a withheld premium drink into an active challenge **published that drink to every
anonymous caller**. **PR #1546** gates both with the same `withheldPremiumSlugsForViewer` the read routes use,
drops a withheld submission rather than blanking it (the slug is itself the secret -- Greptile's P1 on #1530),
and proves all four protections by mutation. Condition 4 holds again when it lands, and not before.

**Audited in the same pass and found sound:** `POST /bundles/:id/items` (the collection must be yours and
premium-purchase), `POST /collections/:id/reviews` (requires current ownership), `POST /collections/:id/wishlist`
(public-or-owner, and is *for* collections you do not own by design). Those three still stand.

**The fourth does not, and the word "sound" was the problem.** `POST /collections/:id/apply-promo` was listed
as "public-or-owner, pricing only" on reasoning, without reading `resolveValidPromotionPricing`. Read since: as
a *paid-content* question the verdict holds -- it returns the promotion row and a pricing object derived from
`collection.priceCents`, no items and no slugs, for a collection whose price is already public. But it is an
**unauthenticated promo-code oracle**: `optionalAuth`, no rate limiting, and four distinguishable answers --
404 "not found for this collection", 403 "not valid for this collection", 400 "inactive, expired, or fully
redeemed", and 200 with the discount. An anonymous caller can enumerate codes against any public premium
collection and learn which exist and what they are worth.

That is abuse and revenue leakage, not a condition-4 disclosure, so **it is open and unowned rather than
fixed** -- no run has touched it, and it does not block condition 4. It is written here because "sound" in this
file has now been wrong three times out of seven, and the one thing worse than an open item is a closed one
that is not.

#### And two things this file said were sound were not, both disproved within hours

The first version of this section also said: *`POST /challenges` writes an ungated `originalDrinkSlug` but only
`getCanonicalDrinkBySlug` ever reads it, so a premium slug there hydrates to null -- ungated and not a
disclosure*, and *`POST /submit` writes an ungated `remixedFromSlug`, which the remix-chain route already cuts
per viewer*. **Codex disproved both on #1547, the PR that wrote them down**, and a third of the same kind turned
up next to them:

| what was claimed sound | why it was not |
| --- | --- |
| `POST /challenges` / `originalDrinkSlug` | `GET /challenges` selects that column explicitly and `GET /challenges/:slug` returns `...challenge`. Returning `canonicalDrink: null` does not unsay the slug sitting beside it |
| `POST /submit` / `remixedFromSlug` | `GET /user/:slug` gates the slug that was ASKED for and then spreads `...recipe`, parent included. The remix-chain route does cut the lineage; that is a different route |
| not claimed, found by asking | `resolveCollectionWithItems` -- the single boundary EVERY collection route goes through -- serialized each item's remix parent twice. A preview item is public on purpose; its parent is a different drink and may be paid. The widest of the three |

**PR #1548** fixes all three the same way -- the reference is cleared and the carrier kept -- and then found a
**fourth** reader of the challenge field by answering its own review question instead of leaving it:
`POST /challenges/:slug/join`, called with no `drinkSlug`, returned the whole challenge *and* built the slug
into a `submitRoute` query string. Two copies in one response, each with its own mutation, because gating
either alone leaves the other leaking. Eight mutations in all.

**That is twice in two PRs that the review questions found more than the review did**, which is worth stating
as method rather than as luck: on #1546 the question "is there a third place this output reaches a response
with the parent intact?" found the collection boundary, the widest instance of the lot. **Ask them, then answer
them yourself.**

**The method error is the part to keep, because one wrong question produced thirteen disclosures across three
PRs.** Every wrong claim was reasoned from what a route *computes*. A disclosure is about what a route
*serializes*. The question that would have caught every instance is **"which slugs appear in this response, and
was each one judged?"**

**That question now exists as a test**, on #1548, and it is the most useful thing to come out of the day. It
plants ONE withheld premium slug in every reference position the schema allows -- a public recipe remixed from
it, that recipe in a public collection, a challenge pointing at it, a submission naming it, view events for it
-- then calls every parameterless GET in `drinks.ts` anonymously and as a non-entitled member, and asserts the
slug appears in none of them. **Its first run found two routes nobody had found**, after eight instances had
already been found by reading routes one at a time: `/creators/leaderboard` and `/creators/trending` both
compute a `topDrink` over every recipe a creator has, with no viewer.

Three properties of it are worth copying to any future gate here:

- **A route that answers non-200 is REPORTED, not skipped.** Two came back 500 because the harness never built
  tables they read. A sweep that quietly passes over what it cannot reach is the vacuous test this campaign
  keeps finding -- and one test on that same branch had already failed on a 500 rather than on the disclosure
  it existed to catch.
- **Routes fixed on a branch it cannot depend on are a TRIPWIRE, not a skip list.** The three #1546 fixes are
  asserted to *still leak*; the day one stops, the assertion fails and names what to do. A skip hides, a
  tripwire reminds.
- **A strict default hides a forgotten viewer.** The new gates default to "no viewer", which is the safe
  direction -- but hard-coding that default passed every disclosure assertion, because under-reporting
  discloses nothing. The sweep only caught it once it also asserted that an owner still sees their own drink.
  **Every gate in this file now has that blind spot**, and each needs its own "the entitled still see it" half.

**The rule underneath it, from Greptile's P1 on #1530, is now stated once here rather than re-learned:
a reference slug is a slug.** The slug is what the recipe route takes, so it is the secret. Every slug in a
response needs the viewer applied, not only the one the route is named for.

**Tables that store a caller-supplied drink slug -- FOUR, not three**, and the fourth was Codex's P1 on #1546:
`drink_collection_items` (#1530), `drink_challenge_submissions` (#1546), `drink_recipes.remixed_from_slug` /
`challenge_slug`, and **`drink_events.slug`** -- which `POST /events` wrote after checking only that the recipe
existed, and which `/trending`, `/trending/by-category` and `/recommended` all group by with no restriction.
That set came from the **schema columns**, which is also how the fourth was missed: `drink_events.slug` *is*
such a column, and the real method was "columns I recognized". A slug inside a `jsonb` payload would not have
appeared either. Enumerating the READERS -- every call site of `resolveDrinkDetailsBySlug` and
`resolveDrinkDetailsMapBySlugs` -- turned out to be the better list, and it is what found the `/recommended`
instance that Codex had not named.

**`POST /challenges` has no authorization of any kind** and is still left alone: any authenticated member can
create a site-wide challenge (`insertDrinkChallengeSchema.parse(req.body)` straight into an insert). The table
has no owner column so it is not mass assignment, and #1546 and #1548 between them gate every reader of the
field it let a member write -- but it is now the second time that route's openness has produced a disclosure,
and somebody should decide whether creating global content is meant to be open. **That is a product decision,
not a bug fix, which is why no run has made it.**

### What #1530 did establish

**#1530 merged at 00:28 on a green run** (CI run 46085612664, head `2b54b5e8`). Paid drink-collection items are
reachable only by the people entitled to them, across nine read routes and one write path, and the proof is a
suite whose every protection was confirmed by breaking it — the mutation table is in the PR and in the commit
messages. `drink-collection-premium-access.test.ts` runs in CI as its own step.

What is explicitly **not** closed, and is written down in `drinks.ts` rather than implied: the block scan is a
bound, not a proof. A viewer entitled to nothing still gets an empty page once more than four blocks' worth of
withheld rows sit on top, and an empty page cannot be told apart from the end of the feed. The scan returns
`exhausted` so a caller could distinguish them; no caller does yet. Closing it completely means expressing the
gate as a SQL predicate so the `LIMIT` is visibility-aware — a second copy of the rule, which is the thing the
single boundary exists to avoid. Somebody should decide which of those two costs to pay; it is not urgent and
it is not a leak.

### Done-condition 1 is NOT met, and the way I got that wrong is the lesson

I wrote in this file that it was met: 515 test files, 515 referenced by a workflow, no reference pointing at a
missing file. Every one of those numbers is true. **The conclusion was wrong**, and Codex disproved it on the
very PR that claimed it — the third time in two days that a confident claim in this file lasted under an hour.

Comparing filenames establishes that CI *names* every suite. It does not establish that CI *runs* them. **A
step can name a suite and still not run it**, because the suite skips when the connection string it reads is
absent, and node exits 0:

> the `wedding-square-postgres-migration-tests` job supplies `WEDDING_SQUARE_TEST_DATABASE_URL`, and its
> restored batches supply `CS_TEST_PG_URL`. Nothing supplies `TEST_DATABASE_URL`.

Codex named three suites. Measured with the job's exact environment, it is most of six batches:

| batch | CI today | with the variable |
| --- | --- | --- |
| 1 of 6 | **1 pass / 36 skip** | 150 pass |
| 2 of 6 | 6 / 8 | 65 |
| 3 of 6 | 3 / 8 | 63 |
| 4 of 6 | 54 / 38 | 170 |
| 5 of 6 | 72 / 0 | 72 |
| 6 of 6 | 12 / 33 | 235 |
| **total** | **148 pass / 123 skip** | **755 pass** |

**607 tests that CI names have never run**, including database-outage behaviour and authentication during a
database outage. 123 skipped placeholders passing as green.

**PR #1541 fixes it** and condition 1 holds when that lands: the six steps get the variable and go through
`run-ci-batch.mjs`, which rejects a skip, and `server/scripts/audit-ci-skips.mjs` reads the workflow and each
suite's gate and fails CI on any suite that is named and cannot run. Only 26 of the workflow's 120 test steps
went through the skip-rejecting wrapper, which is why a checker was the right shape rather than rewriting 94
steps blind.

**One real exception, now listed as the condition requires:** `server/services/video-transcode.ffmpeg.test.ts`
skips in CI because ffmpeg is not installed. Installing it in that job would change that. It is a listed
exception rather than a silent one, which is the whole difference.

**And a warning about the checker itself, since it is now a gate.** It went through four versions before it
was right, and two of the three wrong ones were wrong in the direction that matters least — noise — while one
was wrong in the direction that matters most: it *cleared* a suite that gates on `TEST_DATABASE_URL` and only
assigns `DATABASE_URL`, which is a silent green waved through by the thing built to catch silent greens. It
has its own suite now, with seven mutations. If you change it, run that suite and mutate what you changed: the
first time I mutated it, one test passed anyway because my own fixture asserted nothing.

What to take from this: **the filename check in this file is necessary and nowhere near sufficient.** Run
`audit-ci-skips.mjs` as well, and when you write "condition 1 is met" again, say which of the three checks you
ran — names on disk, names in the workflow, and whether the named suites can actually reach a database.

It had been recorded as finished twice before, and both times it was not. The two files unaccounted for were
`server/routes/drink-collection-premium-access.test.ts`, which #1530 brought in, and
`the __tests__/recipe.test.ts` — a directory named by a mistyped command, holding a Jest-style suite that could
never have run, replaced by a real one in #1538.

**Check it both directions when you re-check it, and re-check it.** A file outside CI runs nothing. A workflow
step naming a file that does not exist *also* runs nothing, and it passes — which is the cheaper lie of the
two. Both commands are one line each:

```
find . -path ./node_modules -prune -o -name '*.test.ts' -print -o -name '*.test.tsx' -print   -o -name '*.test.mts' -print | sed 's|^\./||' | sort > /tmp/all
grep -ohE '[A-Za-z0-9_./-]+\.test\.(ts|tsx|mts)' .github/workflows/*.yml | sort -u > /tmp/ci
comm -23 /tmp/all /tmp/ci   # suites no workflow runs
comm -13 /tmp/all /tmp/ci   # workflow steps with no file
```

The reverse check is the one worth repeating, because it is the cheaper lie: a workflow step naming a file that
does not exist runs nothing and passes. There are none today. The command is in the approval-boundary note
above; run both directions, not just one.

### Two Claude runs were working this repository at the same time, and should not have been

This is the first thing the next run should read, because it nearly caused real trouble.

Session `…TDdbobm2qH1e6nAbUi` and this one (`…T9vcsr8u5UDB1n7jaW`) were both live between roughly 23:45 and
00:30. Both read this file, both picked up #1530, and both commented on it minutes apart. At 23:50 I asked
Codex to review head `2fdaf487` and built an argument into the request — that the bounded over-fetch was
acceptable on `/search`, `/community-search` and `/remixes/:slug` because their clients can ask for a next
page. The other session was at that moment proving that premise **wrong**: none of those three routes reads
`limit` or `offset` at all, so their page *is* the whole answer and widening the window only moves the cliff.
It pushed `2b54b5e8`, which makes all four routes scan through one shared implementation, and merged #1530 at
00:28 on a green run.

The outcome was good and the work was done properly — test R seeds 130 withheld rows in front of one public
match, and the mutation checks are in the commit message. But it was good by luck of who happened to be right.
Two runs can just as easily push contradictory fixes to the same file, or merge a head the other is mid-review.

**So: a run should say in this file which items it has taken before it starts on them, and check whether
another run has.** The "In flight" table has an Owner column and it was not being used for that. It is now.
A row claimed by a session id means hands off until that session's next update or the row goes stale.

**It happened a third time on 2026-11-28, with the column in use, and the reason is worth writing down here
rather than rediscovering.** Sessions `…T9vcsr8u` and `…01M8KhTD` both built a silent-skip checker for the same
Codex finding, ten minutes apart — #1541 and #1542 — and one of them was thrown away. Both runs honoured the
column. **A row claimed *after* the work is a record, not a lock.** `…01M8KhTD` read this file at 05:50, began,
and the claim for that item landed at 06:14 while it was already deep in the work.

So the rule needs a second half: **claim the row before doing the work, and re-read this file and re-fetch the
branches immediately before starting and before each push.** A claim is worth nothing if it is written at the
end. The duplicate was closed in favour of the earlier PR, and the four things it had that the survivor did not
were handed over as findings on that PR rather than pushed at a branch another session was working in — which
is the other half of not colliding.

### Where the six conditions stand, 2026-11-28 02:35 UTC

| # | Condition | State |
| --- | --- | --- |
| 1 | Every suite in CI, or listed with a reason | **NOT met.** Names match, but 607 named tests never run: a missing `TEST_DATABASE_URL` makes them skip and node exits 0. #1541 fixes it and adds a checker. See below |
| 2 | No suite passes while asserting nothing, and none fails at random | **Half of it moved today.** The one known flake is SOLVED -- batch 7 named itself and was a false assertion about a race, #1551 -- and the sweep on #1548 found two vacuous legs of an existing audit as a side effect. The other half still needs the assert-coverage tool (#1540) to settle what it claims. Previously: **not met, and the live one.** Four instances of the first kind were found and fixed in two days (#1526's two holes, #1514's fixture, #1530's racy fixture); one flake is open and unnamed (batch 7, below); and the sweep that would find the rest needs a tool nobody has written |
| 3 | A signed-in member can complete every journey on the live site | **Blocked on Myron** — needs a session, which needs his password |
| 4 | Paid content reachable only by the entitled, proved by a test that fails when the gate is removed | **NOT met, and the count kept rising all day.** #1530 was right about the nine read routes it covered. Then: a tenth (`GET /challenges/:slug/submissions`, no auth middleware at all) plus an ungated write (`POST /challenges/:slug/join`) → **#1546**; then `drink_events` and the three leaderboards reading it, Codex's P1 → also #1546; then four readers serving an ungated *reference* slug, two of them disproving claims this file had just made → **#1548**. **Eight routes in one day.** It holds when both land, and the lesson is in the section below, not in the count |
| 5 | Square billing live-capable but not live, and turning it on is Myron's act | Unchanged. The sandbox-acceptance deployment is a separate, earlier stop and also his |
| 6 | Closure and retention implemented to the matrix his accountant signs off | **Blocked on Myron's accountant.** Two migrations written and unapplied |

So, as of 2026-11-28 19:10 UTC: **none met**, three a merge away (#1541, #1546, #1548), two blocked on Myron
with the work already done, one unchanged. Condition 4 came OFF the met list this run, which is the second time
in two days a confident **MET** in this file did not survive somebody checking it. Both times the check was
cheap and nobody had run it.

**And then the count kept rising for eight more hours.** Condition 4 started the day recorded as MET. By the
end of it, **thirteen routes** had been found disclosing paid content or a reference to it, across three PRs,
and the last two were found by a tool rather than by a person. That is not thirteen separate mistakes — it is
one wrong question asked thirteen times, and the question is written up under condition 4 below. **If you are
about to write MET against anything in this file, the thing to ask is not "did I check?" but "what would have
caught this if I were wrong?"**

**A run starting cold should:** take **#1546 and #1548** first — they are the open security items and together
they are what unmets condition 4 — then #1545 and #1547. Look at #1541 and #1540 only after reading the Owner
column *and* re-fetching their branches. **By 18:30 UTC on 2026-11-28 four Claude sessions had been live on
this repository in one day** (`…T9vcsr8u`, `…01M8KhTD`, `…01M8KhTB`, `…01M8KhTC`), and #1546 changed hands once.
Re-fetch before you assume anything about who holds what.

### In flight

| Item | Where | Next action | Owner |
| --- | --- | --- | --- |
| ~~Custom drink save prefix~~ | ~~PR #1514~~ | **Merged**, green on all six jobs. GPT's fix, plus the four payloads extracted so the pages and the test share one definition — Codex's P2 answered by code and six mutations | — |
| ~~Recipe create persistence~~ | ~~PR #1538~~ | **Merged**, green. Closed done-condition 1 and added the `run-ci-batch.mjs` failure summary. Note for every future run: `rerun_failed_jobs` returns **403** for this integration, so CI can only be re-triggered by a real commit, never an empty one | — |
| Reference-slug disclosures | **PR #1548** | **Six readers served an ungated reference to a withheld premium drink.** `resolveCollectionWithItems` (the boundary every collection route goes through, so the widest), `GET /user/:slug`, `GET /challenges`, `GET /challenges/:slug`, `POST /challenges/:slug/join`'s no-slug branch (two copies of the slug in one response), and the two the sweep found. Two of them disprove claims this very file made. The rule, stated once: **a reference slug is a slug.** Eleven mutations, 45 pass / 0 fail, `tsc` signatures unchanged. Overlaps #1546 on two harness DDL blocks — whichever lands second conflicts there, trivially | Claude `…01M8KhTB` |
| Challenge-submission paid-content leak | **PR #1546** | **Changed hands.** `…01M8KhTB` opened it and answered Codex's P1 (`drink_events` + three leaderboards) and P2 (hydrated remix parent); `…01M8KhTC` took it at 18:22 UTC after six hours' silence and pushed `8380d2f0`, answering the `/trending` refill finding — filtering after `LIMIT 10` could return a BLANK leaderboard rather than a short one. **It is `…01M8KhTC`'s row**; the handover and one relayed finding are on the PR | Claude `…01M8KhTC` |
| ~~The batch-7 timing hypothesis~~ | ~~PR #1545~~ | **Merged**, first-run green on all six jobs — not a re-run, which matters while the batch-7 flake is open. The 600ms cliff in `api-init-isolation.test.ts` is gone and no assertion was weakened; the first version of the change **did** weaken one, and the write-up of *how that was caught* is the part worth reading. Batch 7 itself was green in that run | — |
| The sweep | **PR #1548**, second half | **The mechanical answer to this whole class, and it works.** One withheld slug planted in every reference position, every parameterless GET in `drinks.ts` called anonymously and as a non-entitled member, assert it appears in none. **First run found two routes nobody had found** — `/creators/leaderboard` and `/creators/trending` compute a `topDrink` over every recipe a creator has with no viewer, so a creator's paid drink could become their public top drink. Eight instances of this class had been found by reading routes one at a time; the sweep found two more immediately | Claude `…01M8KhTB` |
| Silent-skip fix and checker | **PR #1541** | **Live again — hands off.** `…T9vcsr8u` resumed at 11:57 UTC after four hours quiet and is on its fifth and sixth rounds of Codex findings. `…01M8KhTB` claimed it at 11:53 reading the silence as "finished", pushed `d6cae344` (the empty-env-value false clean, four mutations), and handed it straight back when the owner reappeared — the owner had built on that commit rather than around it, so nothing collided. Four Codex findings open, and they look like **one** bug: every path where the tool cannot resolve something returns an empty set with `opaque: false`, which the caller reads as *safe* rather than *undeterminable*. The number that decides whether to fix it as one rule or four resolvers is how many of the 514 named suites would become undeterminable hits, and that is one run of the script away | Claude `…T9vcsr8u` |
| Assert-coverage audit | **PR #1540** | **Live — hands off.** `…01M8KhTD` (the session the earlier entry called `…TD6mAsTkV`) is on round five: **twelve** Codex findings, pushed `f6b1cd02` at 11:58 UTC. Four are open at head, all of the same family — proving an assertion is *reachable* needs interprocedural analysis, so a probe will always exist. Whoever next picks it up should decide **in writing** what the tool claims before answering a thirteenth: for this tool a missed vacuous test is cheap and a false hit breaks CI on a valid test, which is the **opposite** of `audit-ci-skips.mjs`, where a false clean is the expensive one. Those two gates should not be tuned in the same direction | Claude `…01M8KhTD` |
| ~~Record correction~~ | ~~PR #1539~~ | **Merged.** | — |
| ~~Rendering smoke check~~ | ~~PR #1526~~ | **Merged.** Both holes re-verified here rather than taken from the original run — the feed column lays out 5 of 11 media elements, so a page-wide floor of 3 was cleared by chrome alone; and `--primary: 18 100% 60%` (hsl wrapper dropped) **passes** on main's `color` probe and **fails** on this branch's `background-color` one. Nobody but Greptile ever reviewed it; Codex asked. Merge on its last job plus that pass | Claude |
| Search Intelligence | unpublished, Codex local | Codex is unblocked as of 27 Nov: Plesk tracks `main` with automatic deploy, so a feature-branch push cannot deploy. It is publishing draft PRs with both feature flags default-off | Codex |
| Barcode lookup fixes | PRs #1515, #1517 | drafts since 23 Nov; GPT to say whether they are finished or need work | GPT |

(The paragraph that used to sit in the middle of this table, splitting it in two, has moved below where it
belongs. A broken table is a small thing; a broken table in the file every run reads first is not.)

#### The Owner column, third version: staleness is not a lock either

Three sessions have now overlapped on this repository. The rule has been rewritten twice and needed it both
times:

1. **First version:** have an Owner column. It existed and was not used for claiming, and two sessions both
   picked up #1530 and commented minutes apart.
2. **Second version (#1543):** claim the row **before** doing the work, because a row claimed afterwards is a
   record and not a lock. Two sessions had still built the same silent-skip checker ten minutes apart, both
   honouring the column, because the claim landed at 06:14 while the other was already deep in it.
3. **Third version, 2026-11-28:** **a claim cannot tell a paused session from a finished one.**
   `…01M8KhTB` claimed #1541 at 11:53 having reasoned that four hours of silence meant the session was over.
   It was not — `…T9vcsr8u` resumed at 11:57 and pushed twice. Nothing was lost, because it built on the
   commit rather than around it and the row was handed straight back, but the reasoning was wrong and the next
   one may not be so lucky.

**So: say which head you are on and when.** That is what actually resolved it — the 11:57 comment naming
`fdd51194` is how the other session learned within four minutes that the row was alive. A claim says who
*intends* to work; a head and a timestamp say who *is*. Write both, and re-fetch the branch immediately before
each push.

### Corrected, so nobody spends another session on it

`schema-push-safety.postgres.test.ts` was carried in the work queue as "0 pass / 2 fail", and it is neither.
It **passes 2 of 2**, and it has been in CI the whole time, in the job named "Schema push safety and plaintext
finalization durability", which has a 45 minute budget and has been green.

Its first test takes **18.5 minutes** — it drives real `drizzle-kit` through dozens of pushes against a real
database. Every attempt to run it locally had a 10 minute cap, so it was killed mid-run and recorded as a
failure. That reading was then copied into the work queue and repeated.

Give it 25 minutes before calling it hung.

**What this file said about the guard itself was wrong, and is corrected here.** It read: the guard was verified
by hand against a non-exempt database, it refused a plan that would strip row-level security, so do not go
looking for a hole in it. The refusal was real. The conclusion was not, and the instruction not to look was the
worst part of it.

Codex found the hole within the hour, on the very PR that added that sentence. `isDisposableTestDatabase`
decides whether a destructive plan may be applied with **no approval token and no server-identity check**, so it
has to agree with the driver about where the connection actually goes — and it did not:

```
postgres://u:p@localhost/app_test?host=/tmp&host=db.prod.example.com
```

The guard read the **first** `host`, `/tmp`. The `pg` driver takes the **last**, `db.prod.example.com`. So the
guard saw a loopback socket and a database named `test`, called it a throwaway, and would have applied
`DISABLE ROW LEVEL SECURITY` to a remote server without asking anyone.

Fixed and merged in **#1537**, which refuses ambiguity outright rather than matching the driver's last-value
rule: more than one `host`, a comma-separated host list, or `hostaddr` in any form. A URL that cannot say
plainly where it points does not get the exemption, whichever value a driver would pick. Verified twice over:
the five new tests fail when the first-value read is restored, and the driver's choice was read off
`connectionParameters.host` directly.

**The lesson is the part to keep: verifying that a guard says no is not the same as verifying it cannot be
walked around.** Two claims of soundness made from a refusal path alone were disproved on 27 Nov. When you
write "this is sound" into this file, say which paths you checked, and never write that nobody should look.

The same applies to `square-plaintext-finalization-durability.postgres.test.ts`, carried as "9 pass / 1 fail":
it runs in that same green job. Re-measure before believing a failure count in any queue, including this one.

### CLOSED: batch 7 named itself, and the flake was a false assertion about a race

**Solved on 2026-11-28 at 19:08 UTC, and the failure summary is what solved it.** Everything below this
heading is the history of not finding it; the finding took twenty minutes once the test had a name.

It fired on **#1547 -- a documentation-only PR**, so nothing in the diff could have caused it. CI run
`46179328729`, job `141085085901`, 350 pass / 1 fail of 351, and the name sat at the END of the log where a
40-line tail reaches it:

```
================ run-ci-batch: FAILED TESTS IN THIS BATCH ================
  FAILED: payable cap: a stale form that was valid when it opened is still
          rejected by the server after a concurrent credit
```

**The cause**, in the last three lines of that test in
`server/routes/catering-billing-adjustments-http.test.ts`:

```ts
const [credit, payment] = await Promise.all([ adjust(credit 20000), pay(invoiceId, "500.00") ]);
assert.equal(payment.status, 409, "500 against a 300 balance, whichever order the two commit");
```

*Whichever order the two commit* is **false**, and the flake was it coming true:

| order | balance when the payment commits | result |
| --- | --- | --- |
| credit first | 300 | 500 refused -> **409** |
| **payment first** | 500 | 500 is exactly the balance -> **200** |

Reproduced by forcing each order instead of racing: credit-first gives 409 every time, payment-first 200 every
time. **Both are correct.** `/billing/payments` takes `lockBilling` and re-resolves the cap inside the
transaction, so the two requests serialise at the database and whichever wins sees the balance as of its own
commit. Locally the credit always wins; under CI contention the payment sometimes does. **One run in a
hundred, exactly as recorded.**

**A wrong expectation, not a hidden defect** -- and the second leg of that is the convincing one: the
order-independent invariant was **already tested in the same file on the same racing pair**. `payable
allocation: a stale form and sibling payments racing a credit can never record more than the allocated
receivable` asserts `ledgerPayments === (payment.status === 200 ? 1 : 0)` and deliberately does not assert
which status comes back. Somebody had written the correct version of the assertion next door.

**THE FIX IS #1549, NOT #1551.** Two sessions found this race within an hour of each other. `…T9vcsr8u`
(#1549) got there first and did more with it; `…01M8KhTB` (#1551) had the CI evidence that it was *this* test.
**#1551 is closed as a duplicate and its evidence is relayed on #1549.** The reasons #1549 is the better fix,
recorded because the difference is instructive:

- **It quantified the race**: 30 trials on 30 fresh bookings, **16 refused / 14 accepted**. Forcing each order
  proves order-dependence but not frequency, and frequency is what explains one-in-a-hundred in that slot
  versus a coin flip in a loop. Its framing is the one to keep: *a race that is 50/50 under one timing profile
  and lopsided under another is one latent defect, not two.*
- **It keeps a correct racing test.** #1551 made the calls sequential and leaned on the sibling test 850 lines
  away. #1549 replaces the racy assertion with three -- both orders pinned deterministically, plus a race test
  asserting only the order-independent identities, including that the recorded row count matches the answer
  the caller was given.
- **Its mutations are on the domain functions** (obligation sign, credit ceiling, `refundPotentiallyDueCents`,
  `cateringPayableCents`), not on the route's refusal line.
- **It checked the suite's other 26 races**, and the reason it gives for leaving four of them alone is the most
  transferable thing either PR produced: **20 identical trials cannot distinguish "order-independent" from
  "one side nearly always wins"** -- which this very test proves. So those four are justified by mechanism
  (a refund ceiling is money received; payable allocation is oldest-first), not by trial counts.

**NOT an accounting question after all, and this file briefly said it was.** #1551 flagged the 20000 surplus
when the payment wins as something for Myron's accountant. #1549 traced it instead: `cateringCreditCeilingCents`
is **deliberately** the obligation rather than the obligation less receipts -- a goodwill credit to a customer
who has already paid in full is a real thing a caterer does -- and the surplus is already reported as
`refundPotentiallyDueCents`, documented as *"money the customer may be owed back. A prompt, never a claim a
refund happened."* Refusing that credit would be the bug. **Nothing here goes to his accountant**, and the
earlier line in this file saying it did was wrong. No server behaviour was changed by either PR.

**Three things this cost that are worth keeping:**

1. **Three runs hunted it blind and bought four eliminations and no cause.** The instrumentation found it on
   its first occurrence. When a flake has no name, build the naming before the hunt.
2. **The guess in this file was wrong for two days.** It said four realtime socket suites and four HTTP
   suites binding servers, so a port or teardown race. It was a billing test with a false assertion. A
   recorded guess reads as a lead; this one sent three runs the wrong way.
3. **A mutation that changes nothing always passes.** The first attempt to mutate the cap check hit
   `catering-booking-billing.ts:303` (the adjustments handler) instead of `:534` (payments), because a
   first-match replace found the wrong one of two identical lines -- and the test passed, which looked like
   evidence that the protection was gone. **Verify the mutation took effect before believing what it tells
   you.**
4. **Two sessions solved it in parallel and one PR was thrown away**, for the second time in one day (#1542
   was the first). Both honoured the Owner column; the batch-7 row simply said "open and owned by nobody", so
   both took it. **A row that is open is an invitation to two runs at once.** The fourth version of the rule,
   if anyone wants one: when you start on an unowned row, claim it *and* say which head you are on, before the
   first command.

### The history, kept because the eliminations are still true: batch 7 of 17 failed once, at random

This is condition 2's other half and it is live.

On 2026-11-28 the first CI run of #1538 went red on `Restored unit suites (2 of 3)`, at the step **"Remaining
unit suites restored to CI, batch 7 of 17"**, 1m53s into a 351-test batch — run `46089461110`, job
`140806716716`. Nothing in #1538 touches any suite in that batch, and #1514 ran batch 7 green at the same base
eight minutes later.

What was established, so nobody repeats it:

- **It does not reproduce locally.** Five runs of batch 7 — one against a fresh database, four against a dirty
  one, at `--test-concurrency=1` on a 2-core machine, which is what the runner does. 351 pass / 0 fail each
  time.
- **It is not caused by #1538, and not by #1530 either**, which is the other thing that had just landed.
- **Which test failed could not be read at all.** A job log is fetched as a tail, and these jobs end with the
  postgres service container dumping hundreds of lines of constraint violations that the constraint tests
  caused on purpose. The `not ok` line sits thousands of lines above that.

That last point is fixed: `run-ci-batch.mjs` now prints every failing test, by name with its file and line, at
the **end** of the log, where a 40-line tail still has it — and says so explicitly when a non-zero exit carries
no `not ok` line at all, which from a tail looked identical. Verified with throwaway probes for all three
paths. **So the next run that sees this will be able to name it.** That is the whole of the progress; the flake
itself is untouched.

#### Two mechanisms eliminated, one hypothesis still open, and a wrong model of CI corrected

The guess recorded here was that batch 7 holds four realtime socket suites and four HTTP suites that each bind
a server, so a port or teardown race is plausible. That part is settled. But the first version of this section
claimed four eliminations, and **Codex found two overclaims in it on #1543** — one of them a plain factual
error about how CI is laid out. Corrected here, because a wrong model in this file sends the next run in the
wrong direction, which is the whole failure this file exists to stop.

**Eliminated, and these two hold:**

| mechanism | why it is impossible |
| --- | --- |
| a fixed-port collision between two suites | All seven servers in the batch bind **port 0**, an ephemeral port the kernel assigns. `dm-socket-safety.test.ts` binds nothing at all |
| an in-process race between two suites | `node --test` runs each file in its own child process. Two files cannot contend for an in-process resource; the only channels between them are the database, the filesystem and the OS |

**Was open as a hypothesis; the shape is now fixed in #1545, and still nobody has reproduced the flake.**
`api-init-isolation.test.ts` spun up to 500ms waiting for `inFlightDdl !== 0`, then slept a flat 100ms, then
hard-asserted `inFlightDdl === 1`. If none of the forty requests reached the initialization guard inside that
~600ms, the assertion reported **"0 !== 1"** — the guard looking broken because the harness had run out of
patience. Three runs under deliberate CPU starvation passed 11/11, so it was never reproduced and **#1545 does
not claim to have found the batch-7 flake.** It removes the cliff regardless, because a 600ms wall-clock
deadline in a test is a suite that fails at random whether or not it is *this* random failure, and that is half
of done-condition 2.

**The part of #1545 worth reading is the mistake in it.** The first version of the change replaced the flat
sleep with a clock-free "no response has settled yet" check, reasoning that the sleep was scaffolding. A
mutation of the production guard — fire initialization without awaiting it — then **passed** where it had
previously failed. Measuring what the old test had actually caught it with showed
`ddlFor("meal_plan_saves").length === 1`: a post-release assertion about DDL that had not finished running,
failing on "0 !== 1" because the microtask order happened to fall that way. **The right mutation caught for
the wrong reason, and by luck** — had the order fallen the other way, that mutation would have gone through
silently all along. Both halves are stated as assertions now. The lesson for any test change in this
repository: *run the mutation before AND after, because "this assertion was only scaffolding" is a claim about
detection, and detection is measurable.*

**The wrong model, corrected.** This file implied that CI runs the batches in sequence against one database,
and recommended reproducing by running them that way. That is not the layout:

- batches **1 to 6** are steps of `restored-unit-suites-1`;
- batch **7** is the **first test step** of `restored-unit-suites-2` (workflow lines 390-434), which declares
  its **own runner and its own `postgres:16` service container**;
- so the three `restored-unit-suites-*` jobs share neither a runner nor a database.

Two consequences, and they point the next run somewhere quite different:

1. **Earlier-batch contamination is excluded by the job boundary, not by any experiment.** Batch 7 meets a
   database that nothing else has touched. The sequential run done on 2026-11-28 — a fresh database, then
   batches 1 through 7 of 17 in order, 210/260/218/463/182/367 passing and then batch 7 at 351 pass / 0 fail —
   did **not** model CI, because CI never does that. It is evidence that batch 7 passes after that history,
   and nothing more.
2. **Cross-job contention is not a suspect either**, for the same reason. The earlier version of this section
   listed it; it was wrong.

**So the surface is smaller and more specific than anyone has been treating it as:** the failure happened
1m53s into the **first test step of a fresh job, against a cold database**. Whatever it is lives inside those
fifteen suites, or in how they behave against a database on first touch — not in anything that ran before
them, because nothing did.

The 351 in the sequential run is still worth keeping for one reason: it is exactly the batch size this file
records, which confirms the fifteen suites being tested are precisely the CI batch and not an approximation.

One lead was raised and withdrawn in the same run, recorded so nobody re-finds it: the job log's final
statements are two identical `UPDATE catering_booking_amendments SET currency = 'GBP'` 28ms apart, which looked
like a retry or a double run. They are neither — line 550 of that suite sits inside a loop over two
`[proposer, responder]` pairs. Nothing there.

**The cold-database experiment has now been run, three times: 351 pass / 0 fail / 0 skip each, 113-125s.**
That was the one cheap thing the corrected topology pointed at and nobody had tried — batch 7 alone against a
database created fresh for each run, which five of the six earlier attempts could not test because they reused
a populated one. **Nine failed reproductions now.**

**Recommendation: stop hunting and let it catch itself**, but for a better reason than exhaustion.
`run-ci-batch.mjs` now names every failing test at the end of the log, which was not in place when this fired.
The next occurrence names the test for free, and with the corrected topology above it will point at something
inside one fresh job rather than at a state-accumulation story that cannot happen. A seventh guess is worth
less than that.

**Do not merge anything on a re-run green while this is open without saying so in the merge.** A flake that
gets retried until it passes is how a real failure comes to be read as noise, which is the thing this campaign
was set up to stop.

### Known and not yet done

- ~~`POST /collections/:id/items` is fixed in #1530; no other write path has been audited for the same
  shape.~~ **Done on 2026-11-28.** The audit found the same shape in the challenge feature and a tenth
  ungated read route with it; see condition 4 above and #1546. The remaining question is whether any drink slug
  is stored inside a `jsonb` payload, which a schema-column search would not have found.
- `server/routes/drinks.ts` holds about half the repository's type errors in one file.

### Condition 2 needs a tool nobody has written, and I did not fake one

Condition 2 is *no suite passes while asserting nothing, and no suite fails at random*. Three instances of the
first kind were found today by hand — #1514's fixture, #1526's two holes, #1530's racy fixture — which is
reason to think there are more, and reason to want a sweep rather than more luck.

I tried to write one: scan all 513 suites for test blocks containing no assertion. It reported 5,487 hits with
unreadable names, because splitting TypeScript on `test(` with a regular expression does not find test blocks.
**The scan was wrong, so there is no finding here, and a number from a scan I do not trust is worse than no
number** — it is the same mistake as the failure counts corrected twice above, made one step earlier.

Doing it properly means parsing the files (TypeScript's own compiler API is already a dependency) and asking,
per test block, whether any assertion is reachable from it. That is an afternoon's work and it would hold for
every future suite. Worth someone's next run; `run-ci-batch.mjs` already covers the easy half by failing a
batch that reports a skipped test or zero passing ones.

### Also corrected: the session-cookie suite has no failures

This file carried `session-cookie-races.postgres.test.ts` as **"5 genuine account-switching failures"**. It has
none. Re-measured on 2026-11-28 against a fresh database: **8 pass / 0 fail, three consecutive runs**, tests 5
to 8 being precisely the account-switching ones. It has also been running in CI all along, inside the step
"Verify client session controller against the real auth routes on PostgreSQL", which has been green.

They were fixed by #1519, "The session cookie race suite was racing the real server, not the controller", and
the entry here was never updated. The stale branch `fix/session-cookie-races-harness-timing` is that work and
can be deleted.

Green, and not vacuously green — two mutations, both in `client/src/lib/session-controller.ts`:

| mutation | result |
|---|---|
| `reconcileUncertainSession` accepts whatever session the server confirmed as the requested one | test 8 fails: a login swallowed by a gateway page is reported successful while the previous user is still the real session |
| the unusable-login-body path reports success without asking the server who is signed in | tests 5, 6, 7 **and** 8 fail: Alice stays displayed while Bob's cookie is in the jar |

So all four account-switching assertions are load-bearing. **That is twice in two runs that a failure count in
this file was wrong in the direction of more work than exists.** Re-measure before believing one, including the
ones written above.

### Blocked by the environment, not by anybody

**A scheduled cloud run cannot verify a deployment.** `https://chefsire.com/healthz` is refused by this
session's egress proxy (`403 agent proxy: no rule or network setting allows this host`), and the one other
fetch path available asks a permission question that nobody is there to answer. So step 4 of "how a run works"
— merge, wait two minutes, check `/healthz` — could not be done for either merge this run.

Low risk for what actually merged: #1537 touches `server/lib/schema-push-plan.ts`, which only the schema-push
script calls, and #1535 is a test file. But it is a gap in the process rather than a one-off, and the next run
will hit it too. Either `chefsire.com` gets allowed for these runs, or deployment verification is somebody
else's step and this file should say whose.

### Blocked on Myron, with the work already done

- Retention matrix sign-off — needs his accountant. Two closure migrations are written and unapplied.
- Signed-in end-to-end journeys — need a session, which needs his password.
- Two old test videos and a test post are still on the live feed.

## Agents

- **Claude** — implementation, tests, CI, deployment verification. May merge on green with a clean review.
- **Codex** — independent review on every PR, and the Search Intelligence work. Triggered by a comment of
  `@codex review`; it does not review automatically unless the repository setting is on.
- **GPT** — coordinator and record-keeper. Receives the status at the end of each run and holds what each agent
  owns next.

A review finding is tested, not argued. If a reviewer re-raises something that looks already fixed, write the
test that proves it rather than replying that it is stale — three of Codex's findings were answered that way on
#1530 and the test is now permanent.
