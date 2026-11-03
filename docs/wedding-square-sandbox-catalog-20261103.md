# Wedding Square sandbox catalog verification — November 3, 2026

Verified using the authenticated Square Developer Console API Explorer against
`connect.squareupsandbox.com`, API version `2026-09-16`.

Before writing, ListCatalog returned the existing Premium parent and no
subscription plan variations. The existing Premium parent was reused. Only the
missing Premium variation, Elite parent, and Elite variation were created.

Final `GET /v2/catalog/list?types=SUBSCRIPTION_PLAN,SUBSCRIPTION_PLAN_VARIATION`
returned HTTP 200 at 17:17:07 UTC, exactly two parents and two variations,
without a pagination cursor. Nested variations also matched their parents.

| Environment variable | Verified catalog ID |
| --- | --- |
| `WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID` | `MQZRYJJAGKUIBFG2WHR4SZ2Q` |
| `WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID` | `6NTJWTLW3MZKTT3LXY2I4RPG` |
| `WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID` | `CWVYS2LWAXSLWJK4ACYCDZEO` |
| `WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID` | `JXELZMQNVZMRJKI6YTNIIQNO` |

Premium is USD 2499 cents monthly; Elite is USD 4999 cents monthly. Both have
one phase, ordinal zero, STATIC pricing, no finite periods, and the correct
parent ID. All four objects are active and present at all locations. No trials,
discounts, proration or billing anchors were added.

Idempotency keys used for the three missing objects:

- `cs-wedding-premium-monthly-2499-v1`
- `cs-wedding-elite-plan-v1`
- `cs-wedding-elite-monthly-4999-v1`

## Local configuration and checks

The ignored local `.env` has mode 0600 and contains the catalog IDs,
`SQUARE_ENV=sandbox`, USD, the previously supplied merchant/location IDs, and
`SQUARE_LIVE_PAYMENTS_ENABLED=false`. No access token was copied. No Wedding
feature switch was enabled. This is workspace configuration only; Plesk's
environment was not accessible or changed, and no deployment was performed.

The readiness assessor was run with the local environment and a fresh read-only
Neon schema/count query. All six required tables and eleven columns exist.
All six Wedding Square tables contain zero rows. Readiness remains false:
this workspace lacks the token, sandbox application ID, webhook URL/signing key,
allowed HTTPS origin, and enabled sandbox acceptance switches. This does not
establish whether those values are already configured in Plesk.

The provider-smoke CLI failed closed before provider reads because runtime
credentials and the enrollment gate are unavailable. The browser catalog GET
above succeeded independently; it is not a passing application provider smoke
or merchant/location attestation. Thirty-five readiness, catalog attestation,
and provider-smoke tests passed. No subscription or payment was created, and
charge/renewal/cancellation/refund lifecycle acceptance remains unverified.

## Credential incident

A browser screenshot unexpectedly captured the API Explorer token field in the
tool preview. The saved screenshot was deleted and is not attached or committed.
Rotate that sandbox token before further testing and securely replace it in
any runtime where it is configured. No token is included in this document,
local environment, Git, or test output.
