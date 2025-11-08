# ChefSire Payment & Commission System

## 🎯 Overview

ChefSire acts as the **payment processor** - all money flows through ChefSire first, then sellers get paid minus commission. This ensures you ALWAYS collect your royalties.

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
5. ChefSire transfers $95 to seller via Square Connect
   ↓
6. ChefSire keeps $5 as platform fee
```

**Key Point:** Sellers NEVER receive buyer payments directly. You control all money flow.

## 🔐 How Commission is Guaranteed

### Why Sellers Can't Bypass Commission:

1. **ChefSire receives ALL payments first** via your Square account
2. **Commission is deducted BEFORE payout** - it's automatic
3. **Sellers only get paid via Square Connect transfers** - they can't access the full amount
4. **All transactions are logged** - complete audit trail
5. **Sellers must connect their Square account** - no Square account = no payouts

### Example:
```javascript
// In /api/payments/create-payment
Square charges buyer $100 → Goes to YOUR Square account

// In /api/payouts/process-seller-payout
Transfer $95 to seller's Square account
Keep $5 in your account (commission)
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

### 2. Enable Square Connect (OAuth)

**Required for seller payouts:**
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
// Order status → "paid"
```

#### 3. Mark Order Delivered
```javascript
PATCH /api/orders/order_123/status
{
  "status": "delivered",
  "trackingNumber": "USPS123"
}
```

#### 4. Payout to Seller
```javascript
POST /api/payouts/process-seller-payout
{
  "sellerId": "seller_123",
  "orderIds": ["order_123", "order_456"]
}

// ChefSire transfers $95 to seller's Square account
// ChefSire keeps $5 commission
```

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

## 🔄 Payout Schedules

### Option 1: Immediate Payout (Risky)
- Pay sellers as soon as order is delivered
- **Risk:** Chargebacks/refunds within 30-60 days
- **Not recommended**

### Option 2: Delayed Payout (Safer)
- Wait 7-14 days after delivery before paying sellers
- Covers most chargeback periods
- **Recommended for launch**

```javascript
// Cron job runs daily
// Pay sellers for orders delivered 7+ days ago
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - 7);

await db
  .select()
  .from(orders)
  .where(
    and(
      eq(orders.status, 'delivered'),
      lt(orders.deliveredAt, cutoffDate),
      eq(orders.payoutStatus, 'pending')
    )
  );
```

### Option 3: Scheduled Batches (Most Common)
- Weekly or monthly payouts (like Uber, Airbnb)
- Lower transaction fees (batch transfers)
- Easier accounting

```javascript
// Every Friday at midnight
cron.schedule('0 0 * * 5', async () => {
  const sellers = await getSellersWithPendingPayouts();

  for (const seller of sellers) {
    await processSellerPayout(seller.id);
  }
});
```

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

1. **Set up Square application** (30 min)
   - Create app in Square Developer Portal
   - Get credentials
   - Add to `.env`

2. **Install Square SDK** (5 min)
   ```bash
   npm install square
   ```

3. **Uncomment Square code** in:
   - `server/routes/payments.ts`
   - `server/routes/payouts.ts`

4. **Build frontend payment form** (2 hours)
   - Install Square Web SDK
   - Create payment component
   - Handle tokenization

5. **Set up payout schedule** (1 hour)
   - Choose schedule (immediate/delayed/batched)
   - Create cron job
   - Test payouts

6. **Go live!**
   - Switch to production credentials
   - Test with real money (small amounts first)
   - Monitor closely for first week

## 🆘 Troubleshooting

**"Payment failed: INVALID_CARD"**
- Check test card numbers
- Verify CVV is correct
- Make sure card isn't expired

**"Payout failed: INSUFFICIENT_BALANCE"**
- ChefSire Square account needs funds
- Wait for payments to settle (1-2 days)

**"OAuth error: Invalid redirect URI"**
- Check redirect URL in Square Developer Portal
- Must exactly match callback URL

## 📚 Resources

- [Square Payments API](https://developer.squareup.com/docs/payments-api/overview)
- [Square Connect/OAuth](https://developer.squareup.com/docs/oauth-api/overview)
- [Square Web SDK](https://developer.squareup.com/docs/web-payments/overview)
