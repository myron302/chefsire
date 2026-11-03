# ChefSire Wedding Square sandbox webhooks — November 3, 2026

## Saved Square configuration

Audited the existing ChefSire app in Sandbox. Exactly one webhook subscription
was listed. Reused it; no webhook subscription or billing catalog object was
created. Its old URL, `/api/square/webhook`, has no matching current subscription
handler. Updated the existing subscription to the dedicated Wedding endpoint.

| Setting | Verified value |
| --- | --- |
| Subscription ID | `wbhk_6a2ad4e8e79a4136916efc9165766439` |
| Name | ChefSire Subscriptions (Sandbox) |
| Environment / status | Sandbox / enabled |
| Notification URL | `https://chefsire.com/api/wedding/subscription/webhooks/square` |
| API version | `2025-10-16` (retained; matches Wedding provider HTTP reads) |
| Events | 16, listed below |

| Family | Subscribed events |
| --- | --- |
| Subscriptions | `subscription.created`, `subscription.updated` |
| Invoices | `invoice.created`, `invoice.published`, `invoice.updated`, `invoice.payment_made`, `invoice.scheduled_charge_failed`, `invoice.canceled`, `invoice.refunded`, `invoice.deleted` |
| Payments | `payment.created`, `payment.updated` |
| Refunds | `refund.created`, `refund.updated` |
| Disputes | `dispute.created`, `dispute.state.updated` |

No beta, deprecated dispute events, or dispute-evidence events were selected.
Dispute lifecycle events use this same subscription and signing key; a second
subscription is unnecessary and would complicate signature verification.

## Delivery and database verification

Square's Send test event sent a signed `dispute.created` notification to the
exact configured Wedding URL at 17:30:59 UTC. The endpoint responded **503**.
Square's logs show two failed test delivery records with the same event ID
`ce8464b5-6628-4ac2-9264-e06c34df3e82`; the inspected record scheduled another
attempt for 17:31:59 UTC. Do not count these records as two persisted events.

The sample test has merchant `0HPGX5JYE6EE1`, not the configured tester merchant
`ML4FP964D31TG`. After configuration is repaired, a correctly signed foreign
merchant sample must still be rejected, not inserted as owned payment evidence.
A successful console sample alone cannot establish provider-backed billing.

An independent invalid-signature POST to the deployed endpoint also returned
503. This confirms the endpoint is unavailable before signature acceptance;
it does **not** establish the expected 401 signature rejection in the deployed
application. A fresh read-only Neon query found zero webhook events, pending or
processed. Successful delivery, production-route duplicate handling, and actual
provider-backed reconciliation into Neon remain unverified.

## Implementation correction under review

The prior intake acknowledged dispute events with 204 and silently discarded
them. The change records only their canonical dispute ID as a pending hint.
The existing event worker independently GETs the exact sandbox dispute and its
payment, checks location/customer/price against one owner-bound invoice, and
atomically revokes only that invoice's evidence under the queue lease/revision.
Any dispute, including a partial dispute or WON state, cannot restore paid access.
Provider failures or ambiguous ownership leave the event pending. No provider
writes, new routes, migrations, prices, or entitlement grants were introduced.

The intake also explicitly refuses work if the live-payment switch is true.
Signed delivery, wrong key/body/URL, duplicate handling and database-outage
tests cover local HTTP intake. Disposable PostgreSQL CI covers durable signed
intake/duplicates and payment/refund/dispute queue acknowledgement. These tests
are separate from a real Square-to-Neon acceptance run.

Square requires prompt 2xx acknowledgement; failed deliveries retry with
exponential backoff for up to 24 hours. ChefSire acknowledges only after the
metadata insert commits; duplicates use the composite unique key. Database
failure returns 503 with Retry-After 5. Internal reconciliation remains gated,
claims one event with a 15-minute lease and retries provider GETs on later scans;
the hourly worker is not a provider POST retry loop. Deleted draft invoices or
unmatched sample objects can remain pending for operator reconciliation.

## Secure configuration and remaining blockers

The exact notification URL and sandbox application ID were added to the ignored
local mode-0600 `.env`; existing plan IDs and `SQUARE_LIVE_PAYMENTS_ENABLED=false`
were preserved. No sandbox acceptance switch was enabled. The handler uses the
configured URL plus raw request bytes, not Host/proxy headers or rebuilt JSON.

The existing dedicated signature key was obtained with Square's Copy control,
without printing or screenshotting it. The signature key was securely configured in the ignored local mode-0600 `.env`
after retrying the shared transfer at its supported root. Temporary copies were
deleted and the clipboard cleared. Plesk's runtime key/URL could not be inspected
or changed. Do not mistake matching the local URL and key for verification of
the deployed environment's signing configuration.

The exposed sandbox access token still needs rotation. Browser security requires
the owner to submit credential replacement. No access token was copied, printed,
or captured during this work. Rotation must be followed by secure replacement in
Plesk and any other authorized runtime; never paste credentials into the PR.

Before real acceptance: finish sandbox token rotation; securely set the dedicated
signing key, exact URL, token, application ID, allowed HTTPS origin and required
sandbox switches in the intended runtime; review/merge the dispute correction;
then deploy only with owner approval. Re-run readiness and provider smoke in that
runtime, exercise owned sandbox events and compare their immutable IDs with Neon.
No Plesk deployment or production billing activation was performed.

## Official references

- https://developer.squareup.com/docs/webhooks/overview
- https://developer.squareup.com/docs/webhooks/step3validate
- https://developer.squareup.com/docs/webhooks/v2webhook-events-tech-ref
- https://developer.squareup.com/reference/square/disputes-api/webhooks
