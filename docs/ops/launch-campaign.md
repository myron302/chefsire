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

The one of these live today is permanent account closure. `docs/ops/part3b-closure-safety.md` says the hard
switch may not be changed, merged, deployed, or run against production until Myron explicitly approves **and**
a legal/retention review is on the record. That is load-bearing here because **`main` deploys automatically**:
merging closure-enabling code to `main` *is* deploying it, so "merge on green with a clean review" does not
apply to it. Closure work proceeds as far as a PR that leaves `PERMANENT_CLOSURE_AVAILABLE = false`, and stops
there.

If you add a boundary like that to another feature's document, add a line for it here too, or the next run will
not know it exists.

### What must never be weakened to make a run finish

A test that would fail if the protection it guards were removed. If a change makes a test pass, mutate the code
it covers and confirm the test fails. A green run bought by deleting the thing that was watching is worse than
a red one.

## State

Updated 2026-11-27 by Claude.

### Landed since the last update

- **#1537 — the schema-push guard bypass.** Merged. The hole Codex found on #1536, closed; see the correction
  below. Verified independently before merging: suite green at 79/0, the five new tests fail when the
  first-value read is restored, and `pg`'s choice of host read directly off the driver.

### In flight

| Item | Where | Next action | Owner |
| --- | --- | --- | --- |
| Drink premium-collection gate | PR #1530 | Codex re-review requested at head `2fdaf487`, which is one unreviewed production commit past its last clean pass. Merge when that comes back clean | Claude |
| Flaky leak assertions | PR #1535 | green and mergeable; Codex's P2 answered with a code change (foreign resource ids, not just account ids) and a re-review requested at head `4d61cdd`. Merge when it returns | Claude |
| Custom drink save prefix | PR #1514 | GPT's fix, rebased and given the regression test it lacked; merge on green | Claude |
| Rendering smoke check | PR #1526 | re-run after #1535 merges | Claude |
| Search Intelligence | unpublished, Codex local | Codex is unblocked as of 27 Nov: Plesk tracks `main` with automatic deploy, so a feature-branch push cannot deploy. It is publishing draft PRs with both feature flags default-off | Codex |
| Barcode lookup fixes | PRs #1515, #1517 | drafts since 23 Nov; GPT to say whether they are finished or need work | GPT |

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

### Known and not yet done

- `session-cookie-races.postgres.test.ts`, 5 genuine account-switching failures.
- `POST /collections/:id/items` is fixed in #1530; no other write path has been audited for the same shape.
- `server/routes/drinks.ts` holds about half the repository's type errors in one file.

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
