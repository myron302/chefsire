# Part 3b — erasure items a closure coordinator must still handle

Running list of rows that reference a member but are **not reachable from that member's own
private-content erasure**, because they belong to another member's record. Each one has to be
redacted (not deleted) by the closure coordinator when permanent closure is eventually built.
Permanent closure is hard-disabled (`PERMANENT_CLOSURE_AVAILABLE = false`), so none of this is live
yet; this file exists so the list is not rediscovered from scratch later.

## 1. DM notifications naming the sender

`notifications` rows are keyed by **recipient**. A DM alert stores the sender's display name in
`title` and up to 80–100 characters of the message in `message`:

- `server/routes/dm.ts` — `POST /api/dm/threads/:id/messages`
- `server/realtime/dmSocket.ts` — the `send` handler

So after a member closes, their name and their words survive inside every other participant's
notification rows. The sender's own erasure pass cannot touch those rows: they are another member's
data, and deleting them would silently remove a notification the recipient legitimately received.

**Required at closure:** redact — rewrite **every** field that carries the closing member's identity
or their words, keeping the row and its read state:

- `title` (holds the display name)
- `message` (holds up to 80–100 characters of what they wrote)
- `metadata` — the socket path stores `senderId`, and anything else denormalized into it

Redacting only the visible title and leaving the snippet or the sender id behind does not resolve
the privacy problem; it just hides it from the list view. Treat the row as redacted only when none
of its fields identify the member or quote them.

The HTTP path currently stores no `senderId` in metadata. Adding it is a prerequisite for finding
these rows cheaply, and should land with the coordinator rather than now; until it does, the HTTP
path's rows have to be found through the thread's participants.

**Deliberately not done in stage 3a.** GPT's draft solved this by replacing the copy with
"New message" / "You have a new message." for everyone, forever. That trades a visible downgrade of
every member's notifications today against a cleanup problem that only exists once closure ships,
and closure can solve it properly. Pinned by assertion in
`server/routes/dm-closure-safety.postgres.test.ts`.

## 2. Participants left in shared threads

A closed member stays a `dm_participants` row in threads they shared, by design: removing them
would corrupt other people's conversation history. Already handled on the write side — closed,
suspended and deactivated participants no longer accrue new notifications (same two files above) —
but the coordinator still owes a decision on how their name renders in the other participants'
thread list.

## 3. Counters backed by rows that outlive the member

`users.postsCount`, `posts.likesCount` and `posts.commentsCount` are maintained in the same
transaction as the rows they count (`server/storage.ts`), so they are consistent today. Erasure that
removes a closed member's likes or comments has to repair the **other** member's post counters, the
way `server/lib/remix-engagement-cleanup.ts` already does for remix engagement.
