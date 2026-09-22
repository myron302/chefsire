# ChefSire Payment & Commission System

## 🎯 Overview

ChefSire has buyer-payment code and server-side commission calculations, but it does **not** currently have a provider-confirmed seller-transfer implementation. Seller payouts are unavailable and fail closed. Marketplace fulfillment and customer payment are independent trust domains: **delivered does not mean paid or payout eligible**.

## 💰 Money Flow

```
1. Buyer pays $100
   ↓
2. Square charges buyer → Money goes to ChefSire Square account
   ↓
3. ChefSire holds $100
   ↓
4. Calculate commission based on seller's tier
   - Professional tier = 5% = $5 commission
   - Seller gets = $95
   ↓
5. Seller transfer remains unavailable until a payout provider can submit and confirm it
   ↓
6. ChefSire keeps $5 as platform fee
```

**Key Point:** The calculated seller share is accounting data, not proof that money was transferred.

## 🔐 How Commission is Guaranteed

### Why Sellers Can't Bypass Commission:

1. **ChefSire receives ALL payments first** via your Square account
2. **Commission is calculated server-side** - clients cannot choose a payout amount
3. **No seller transfer is currently executed** - Square account linking is not a transfer API
4. **All transactions are logged** - complete audit trail
5. **Payout execution remains disabled** even if a seller linked a Square account

### Example:
```javascript
// In /api/payments/create-payment
Square charges buyer $100 → Goes to YOUR Square account

// POST /api/payouts/process-seller-payout
HTTP 503 { code: "PAYOUT_PROVIDER_UNAVAILABLE" }
// No payout or commission state is inserted, claimed, or marked paid.
```

## 📋 Required Setup

### 1. Square Application Setup

**Get these from Square Developer Portal:**
```bash
SQUARE_APPLICATION_ID="sq0idp-xxxxx"
SQUARE_ACCESS_TOKEN="EAAAxxxxx"
SQUARE_LOCATION_ID="LX7Pxxxxx"
```

**Steps:**
1. Go to https://developer.squareup.com/apps
2. Create a new application (or use existing)
3. Get Application ID from "Credentials"
4. Generate Access Token (Production or Sandbox)
5. Get Location ID from Square Dashboard

### 2. Square account linking (OAuth only)

OAuth account linking may be configured, but it does not enable seller transfers:
1. In Square Developer Portal → Your App → OAuth
2. Enable "Square Account Management" permission
3. Add redirect URL: `https://chefsire.com/api/payouts/square-callback`
4. Save OAuth settings

### 3. Environment Variables

Add to your `.env` file:
```bash
# Square Payment Processing
SQUARE_APPLICATION_ID=sq0idp-your-app-id
SQUARE_ACCESS_TOKEN=EAAAyour-access-token
SQUARE_LOCATION_ID=your-location-id

# For production
NODE_ENV=production
```

## 🚀 API Endpoints

### Payment Flow

#### 1. Create Order (No Payment Yet)
```javascript
POST /api/orders/checkout
{
  "productId": "prod_123",
  "quantity": 2,
  "fulfillmentMethod": "shipping",
  "shippingAddress": { ... }
}

Response: {
  "order": {
    "id": "order_123",
    "totalAmount": "100.00",
    "platformFee": "5.00",    // Your commission
    "sellerAmount": "95.00",   // What seller gets
    "status": "pending"
  }
}
```

#### 2. Process Payment via Square
```javascript
POST /api/payments/create-payment
{
  "orderId": "order_123",
  "sourceId": "cnon:xxx",  // Square payment token from frontend
  "verificationToken": "verify_xxx"  // 3D Secure token
}

// ChefSire receives $100 via Square
// Only an exact Square COMPLETED response with matching amount/currency is stored
// as paymentStatus → "captured". Fulfillment status is unchanged.
```

Before calling Square, ChefSire durably records `capture_pending` with one stable
idempotency key and unique Square `referenceId`. If Square succeeds but local
commission/revenue persistence fails, the order remains explicitly pending
reconciliation. A retry follows every Square `ListPayments` cursor for the
fixed window from five minutes before through five minutes after the recorded
capture attempt. This tolerates bounded application/provider clock skew until
it finds that original reference or exhausts the provider result set;
unrelated same-amount payments are ignored. It never
combines the old key with a newly tokenized payment source. Definitive card
instrument failures identified by Square's `PAYMENT_METHOD_ERROR` category
release the attempt for a new key, while mixed, unknown, and transport outcomes
block a new charge. It never substitutes a local or simulated success.

Seller lookup, amount validation, commission inputs, and Square client setup
all complete before `capture_pending` is written. Failures in that preparation
phase therefore leave the order retryable as `unverified`; after the pending
write, any uncertain submission outcome remains fail-closed and must reconcile.

Each new order also has a durable seller-revenue ledger state. Capture changes
`uncredited` to `credited` in the same transaction that increments
`monthlyRevenue`; refund changes `credited` to `reversed` in the same
transaction that decrements it. Historical unverified rows are marked
`legacy_unverified` because legacy order creation and aggregate revenue updates
were not atomic. They must be manually reconciled before a new charge rather
than risking a second credit or inventing historical certainty.

Legacy orders whose old fulfillment status is `paid` or which already contain
a Square payment ID are not considered verified, but they are also not safe to
charge again or cancel as if unpaid. Capture and fulfillment cancellation use
the same legacy-indicator predicate and fail closed with
`LEGACY_PAYMENT_RECONCILIATION_REQUIRED`.

#### 3. Mark Order Delivered
```javascript
PATCH /api/orders/order_123/status
{
  "status": "delivered",
  "trackingNumber": "USPS123"
}
```

This seller-owned endpoint accepts only `status` and `trackingNumber`. It cannot
set `paymentStatus`, Square IDs, provider status, or capture time. Delivery is
fulfillment evidence only and never creates a commission or verified earning.

Full refunds use the same containment pattern: `refund_pending` and a stable
refund idempotency key are persisted before the Square call. Square `PENDING`
refund IDs are retained and polled on retry; completed provider refunds whose
local accounting transaction fails remain non-earning and recoverable rather
than appearing unquestionably captured. A provider-confirmed `FAILED` or
`REJECTED` refund restores the captured state, archives the failed refund ID,
and releases the logical attempt so a later request receives a new idempotency
key. Ambiguous outcomes stay blocked. Partial refunds remain unavailable.
Synchronous Square rejections known to mean that no refund was created restore
the captured state in the same conservative way; unknown provider errors stay
pending. After a provider-confirmed completed refund, the seller may separately
move pending/processing/shipped fulfillment to `cancelled` without changing any
payment evidence.

The pending record snapshots the immutable Square request: idempotency key,
payment ID, amount in cents, USD currency, and a trimmed canonical reason.
Retries rebuild the request only from that snapshot, so changed or omitted
HTTP input cannot alter an operation already in flight. A definitive provider
failure retires the snapshot before a new logical attempt receives a new key.

#### 4. Payout execution (currently unavailable)
```javascript
POST /api/payouts/process-seller-payout
{
  "sellerId": "seller_123",
  "orderIds": ["order_123", "order_456"]
}

// HTTP 503: PAYOUT_PROVIDER_UNAVAILABLE
// No transfer is attempted and no payout/commission state changes.
```

`GET /api/payouts/pending-balance` also fails closed with HTTP 503 `PAYOUT_ELIGIBILITY_UNVERIFIABLE`.
The available marketplace order lifecycle
does not prove provider-captured payment, so its zeroed response must not be
interpreted as a successful zero pending balance. Existing locally completed
payout rows are unverified legacy history, not proof of a provider transfer.

## 💳 Frontend Integration

### Square Web Payments SDK

```javascript
// client/src/components/SquarePaymentForm.tsx
import { useEffect } from 'react';

const SquarePaymentForm = ({ amount, onPaymentSuccess }) => {
  useEffect(async () => {
    // 1. Get Square config
    const config = await fetch('/api/payments/square-config').then(r => r.json());

    // 2. Initialize Square Payments
    const payments = Square.payments(config.applicationId, config.locationId);

    // 3. Create card form
    const card = await payments.card();
    await card.attach('#card-container');

    // 4. On submit
    document.getElementById('pay-button').onclick = async () => {
      const result = await card.tokenize();

      if (result.status === 'OK') {
        // Send token to your backend
        const response = await fetch('/api/payments/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            orderId: currentOrder.id,
            sourceId: result.token
          })
        });

        if (response.ok) {
          onPaymentSuccess();
        }
      }
    };
  }, []);

  return (
    <div>
      <div id="card-container"></div>
      <button id="pay-button">Pay ${amount}</button>
    </div>
  );
};
```

## 🔄 Payout Scheduling (not implemented)

No immediate, delayed, cron, or batch seller payout path is enabled. Any future
eligibility rule must require both the applicable fulfillment state **and**
independently verified provider capture. Delivery alone is not payout
eligibility, and provider capture is not proof of a seller payout transfer.

## 📊 Commission Tiers

| Tier | Monthly Fee | Commission | Seller Gets (on $100 sale) |
|------|------------|------------|---------------------------|
| Free | $0 | 10% | $90 |
| Starter | $15 | 8% | $92 |
| Professional | $35 | 5% | $95 |
| Enterprise | $75 | 3% | $97 |
| Premium Plus | $150 | 1% | $99 |

**Your Revenue Example:**
- 100 sellers on Professional tier
- Each does $5,000/month in sales
- Total sales: $500,000/month
- Your commission (5%): **$25,000/month**
- Subscription fees (100 × $35): **$3,500/month**
- **Total monthly revenue: $28,500**

## ⚠️ Important Security Notes

1. **Never expose Square Access Token to frontend** - it's server-side only
2. **Use Application ID for frontend** - it's safe to expose
3. **Always validate amounts on backend** - don't trust frontend
4. **Log all transactions** - create audit trail
5. **Implement idempotency keys** - prevent duplicate charges

## 🧪 Testing

### Sandbox Mode
```bash
# Use Square Sandbox for testing
NODE_ENV=development
SQUARE_APPLICATION_ID=sandbox-sq0idb-xxx
SQUARE_ACCESS_TOKEN=EAAA-sandbox-xxx
```

### Test Card Numbers
```
Success: 4111 1111 1111 1111
Decline: 4000 0000 0000 0002
3D Secure: 4111 1111 1111 1111 (CVV: 999)
```

## 📝 Next Steps

### Database updates

Use `npm run db:push` (or the explicit `npm run db:push:accept`) rather than
running Drizzle directly. The supported command keeps one selected
`DATABASE_URL` for every phase, runs financial migration preflights before
schema synchronization without replaying unrelated historical migrations, and
re-verifies the staged payout constraints after
every push. An audit-required duplicate-claim failure must be resolved by a
financial review; the workflow never deletes or chooses among those records.

1. **Set up Square application** (30 min)
   - Create app in Square Developer Portal
   - Get credentials
   - Add to `.env`

2. **Install Square SDK** (5 min)
   ```bash
   npm install square
   ```

3. **Implement and security-review a real payout provider** before enabling any seller transfer

4. **Build frontend payment form** (2 hours)
   - Install Square Web SDK
   - Create payment component
   - Handle tokenization

5. **Keep payout execution fail closed** until provider submission and confirmation are persisted safely

6. **Go live!**
   - Switch to production credentials
   - Test with real money (small amounts first)
   - Monitor closely for first week

## 🆘 Troubleshooting

**"Payment failed: INVALID_CARD"**
- Check test card numbers
- Verify CVV is correct
- Make sure card isn't expired

**`PAYOUT_PROVIDER_UNAVAILABLE` or `PAYOUT_ELIGIBILITY_UNVERIFIABLE`**
- This is the expected fail-closed behavior; it does not mean a transfer was attempted.
- Do not treat the zeroed eligibility response as a successful pending balance.

**"OAuth error: Invalid redirect URI"**
- Check redirect URL in Square Developer Portal
- Must exactly match callback URL

## 📚 Resources

- [Square Payments API](https://developer.squareup.com/docs/payments-api/overview)
- [Square Connect/OAuth](https://developer.squareup.com/docs/oauth-api/overview)
- [Square Web SDK](https://developer.squareup.com/docs/web-payments/overview)
