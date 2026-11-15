# Part 3b: DM and uploaded-media retention boundary (implementation inventory)

Read-only source audit at current draft. Tracking: #1486. **Permanent closure OFF.**

## What DM schema actually stores

- `shared/schema/messaging/dm.ts`: `dm_threads` are shared and have no direct user FK. `dm_participants` records each member's participation and read state; it has a CASCADE user FK. `dm_messages` has a CASCADE `sender_id -> users.id` FK, a required `body`, and `attachments jsonb NOT NULL DEFAULT []` holding `{name,url,type}` objects.
- Deleting the user row would erase their authored messages via CASCADE and may remove their participant rows; **do not hard delete**. Tombstone the user ID, retain thread/participant identifiers needed by the counterparty and redact only ordinary sender-owned message content when legally permitted.
- `catering_booking_conversations.thread_id` ties some DM threads to paid/contractual catering. Generic DM API deliberately excludes these and uses booking APIs for that evidence. Do **not** blanket-redact those message bodies or detach booking threads. Legal/retention review must specify evidence access and expiry separately.
- `server/lib/closure-message-inventory.ts` is intentionally read-only and returns **counts**, not message bodies or filenames, by classifying threads via booking linkage. Missing link table/errors prevent any future closure transaction from assuming all messages are ordinary.

## Proposed eventual execution (not implemented)

1. In the final locked closure transaction, preserve booking-linked evidence (restricted access), redact ordinary `dm_messages` authored by the closing member in place: `body = 'This message was removed'`; `attachments = '[]'::jsonb`. Preserve message IDs, sender ID, thread ID, timestamps and all messages authored by other members.
2. Preserve `dm_threads`, `dm_participants` for the remaining members and the closed account as needed for historical thread rendering. A deleted-user public serializer must display `Deleted user` without leaking old display names in participant snapshots or notification previews.
3. Identify attachment object URLs from ordinary messages and enqueue **eligible** media for deferred deletion only if no other retained record references the same object. Never trust a client-provided URL as a filesystem path. Never delete a booking or financial attachment under generic DM policy.
4. Scan other metadata/denormalizations: thread last-message previews, search indices, notifications, websocket payload history, cached avatars, CDN/R2 objects, export snapshots and backups. Redacting `dm_messages` alone is not a complete privacy erasure.
5. Keep file deletion in a durable DB outbox written inside the closure transaction, processed only after commit and idempotently retried. Distinguish DB redaction done from media cleanup pending/failed; preserve evidence of cleanup without storing the erased PII in audit details.

## Storage facts

- Uploads use `server/lib/uploads-dir.ts` with configurable `UPLOADS_DIR`, otherwise a path relative to the built app. `server/app.ts` serves `/uploads` via the uploads static handler.
- `server/lib/data-uri.ts` can persist media to local uploads **or R2**. Both stores must be covered; an `/uploads/foo` URL and a CDN/R2 URL are not interchangeable file identities. Public static assets or third-party media must not be deleted based on URL matching.
- Media may be shared between posts, recipes, messages, marketplace listings or paid fulfillment. Candidate cleanup must verify reference ownership and dependencies, not merely the uploader's account.

## Required tests before implementing writes

- Sender redact only, preserve counterparty messages and thread visibility; booking-linked DM evidence unchanged.
- Link-table unavailable -> refusal and zero mutation; test concurrent booking conversation linkage and closure.
- Idempotent redaction and outbox, shared-object reference exclusion, path-traversal/host validation, R2/local-delete retry, backup/CDN expiry accounting.
- No live deletion until a legal retention policy and production schema migration are separately authorized.
