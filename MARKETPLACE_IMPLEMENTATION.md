# Marketplace Monetization Implementation

## Overview
This document outlines the complete marketplace monetization system implemented for ChefSire. The system enables vendors (chefs, butchers, spice sellers, etc.) to sell physical products through the platform, with automatic commission deduction and seller payouts.

## What Was Implemented

### 1. Database Schema (✅ Complete)

Created 4 new tables to support the marketplace monetization:

#### `payment_methods`
- Stores seller's connected payment accounts (Square, Stripe, PayPal)
- Fields: provider, provider_id, account_status, account_details
- Supports multiple payment providers per seller

#### `commissions`
- Audit trail for all commission calculations
- Records: order_id, seller_id, subscription_tier, commission_rate, amounts
- Links to payouts for tracking when commissions are paid out

#### `payouts`
- Tracks seller payout batches
- Fields: amount, provider, provider_payout_id, status (pending/processing/completed/failed)
- Includes metadata like date range and order count

#### `payout_schedules`
- Configures automatic payout schedules for sellers
- Frequency options: daily, weekly, biweekly, monthly
- Minimum payout threshold (default $25)

**Location**: `shared/schema.ts` (lines 666-774)
**Migration**: `server/drizzle/20251108_marketplace_monetization.sql`

### 2. Square Payment Processing (✅ Complete)

Enabled real Square payment processing with automatic fallback to simulation mode.

#### Features
- Real Square SDK integration with `square` npm package
- Automatic payment processing when buyer checks out
- Idempotency keys to prevent duplicate charges
- Commission calculation based on seller's subscription tier
- Automatic commission record creation for audit trail
- Environment-based configuration (sandbox vs production)
- Graceful fallback to simulation when Square not configured

#### Implementation Details
**File**: `server/routes/payments.ts`

```javascript
// Enabled features:
- POST /api/payments/create-payment
  - Validates order ownership
  - Processes payment via Square Payments API
  - Creates commission record
  - Returns payment details with commission info

- POST /api/payments/refund
  - Processes refunds through Square
  - Updates order status
  - Handles commission adjustments

- GET /api/payments/square-config
  - Returns public Square configuration for frontend
```

#### Commission Tracking
Every payment automatically creates a commission record:
- Order ID
- Seller ID
- Subscription tier at time of sale
- Commission rate (e.g., 10% for free tier)
- Total amount, commission amount, seller amount
- Status (pending → paid after payout)

### 3. Seller Payout System (✅ Complete)

Implemented automated seller payout processing with Square Connect.

#### Features
- Payout processing to connected Square accounts
- Batch payouts for multiple orders
- Payout status tracking (pending/processing/completed/failed)
- Commission marking as "paid" when payout completes
- Payout history and pending balance queries
- Provider-agnostic design (supports Square, Stripe, PayPal)

#### Implementation Details
**File**: `server/routes/payouts.ts`

```javascript
// Enabled endpoints:
- POST /api/payouts/process-seller-payout
  - Verifies seller has connected payment method
  - Creates payout record
  - Processes transfer via Square
  - Marks commissions as paid
  - Returns payout details

- GET /api/payouts/my-payouts
  - Shows seller's payout history
  - Total paid out vs pending
  - Individual payout details

- GET /api/payouts/pending-balance
  - Shows earnings waiting for payout
  - List of delivered but unpaid orders

- POST /api/payouts/connect-square
  - Initiates Square OAuth flow for seller
  - Returns authorization URL
```

#### Payout Workflow
1. Orders are marked as "delivered"
2. Admin/automated system calls `/process-seller-payout`
3. System checks for connected payment method
4. Creates payout record (status: processing)
5. Transfers funds via Square Connect
6. Updates payout status to completed
7. Marks all related commissions as "paid"

### 4. Subscription Tier Enforcement (✅ Complete)

Implemented tier-based limits and feature gates for the marketplace.

#### Tier Structure
```javascript
Free Tier (10% commission):
- 5 products max
- No store builder
- Basic listings only

Starter Tier $15/mo (8% commission):
- 50 products max
- Custom store page
- Basic analytics

Professional Tier $35/mo (5% commission):
- Unlimited products
- Full store builder
- Advanced analytics

Enterprise Tier $75/mo (3% commission):
- Unlimited products
- Priority support
- API access

Premium Plus Tier $150/mo (1% commission):
- White-label options
- Dedicated account manager
```

#### Enforcement Points

**Product Creation** (`server/routes/marketplace.ts`)
- Checks current product count vs tier limit
- Returns 403 with upgrade message if limit reached
- Shows products remaining in successful response

**Store Builder** (`server/routes/stores-crud.ts`)
- Requires Starter tier or higher for store creation
- Returns 403 with tier requirement if on Free tier
- Prevents layout customization for free users

### 5. Commission System (✅ Complete)

Automatic commission calculation and tracking integrated throughout the payment flow.

#### How It Works
1. **Order Creation**: Commission calculated based on seller's current tier
2. **Payment Processing**: Commission record created in database
3. **Payout Processing**: Commission marked as "paid"
4. **Audit Trail**: Full history of all commissions per order

#### Commission Rates by Tier
- Free: 10%
- Starter: 8%
- Professional: 5%
- Enterprise: 3%
- Premium Plus: 1%

## What's Not Yet Complete

### 1. Migration Execution
**Status**: Migration file created, but DATABASE_URL not configured

**To Run**:
```bash
# Configure DATABASE_URL environment variable first
export DATABASE_URL="postgresql://..."

# Then run migration
npm run db:migrate
```

### 2. Square Configuration
**Required Environment Variables**:
```bash
SQUARE_ACCESS_TOKEN=your_access_token
SQUARE_APPLICATION_ID=your_app_id
SQUARE_LOCATION_ID=your_location_id
```

**Note**: System works in simulation mode without these configured

### 3. Store Builder UI
**Status**: Backend ready, frontend Craft.js needs enhancement

**What's Needed**:
- Additional Craft.js components (Image, Button, Grid, etc.)
- Property inspector for component editing
- Better save/load functionality
- Product embedding components

### 4. Subscription Billing
**Status**: Tier system exists, but no recurring billing

**What's Needed**:
- Stripe/Square subscription integration
- Automatic tier upgrades/downgrades
- Payment card storage
- Invoice generation
- Failed payment handling

### 5. Testing
**Needs Testing**:
- Full flow: product creation → purchase → commission → payout
- Square payment processing (sandbox)
- Tier limit enforcement
- Commission calculations
- Payout processing

## API Endpoints Summary

### Payments
- `POST /api/payments/create-payment` - Process buyer payment via Square
- `POST /api/payments/refund` - Refund an order
- `GET /api/payments/square-config` - Get Square config for frontend

### Payouts
- `POST /api/payouts/process-seller-payout` - Process payout to seller
- `GET /api/payouts/my-payouts` - Get seller's payout history
- `GET /api/payouts/pending-balance` - Get pending earnings
- `POST /api/payouts/connect-square` - Connect Square account

### Products (with tier enforcement)
- `POST /api/marketplace/products` - Create product (checks tier limits)
- `PUT /api/marketplace/products/:id` - Update product
- `DELETE /api/marketplace/products/:id` - Delete product
- `GET /api/marketplace/products` - Search/browse products
- `GET /api/marketplace/sellers/:id/products` - Get seller's products

### Stores (with tier enforcement)
- `POST /api/stores-crud` - Create store (requires Starter+)
- `PATCH /api/stores-crud/:id` - Update store
- `PATCH /api/stores-crud/:id/layout` - Update store layout (requires tier)
- `PATCH /api/stores-crud/:id/publish` - Publish/unpublish store

### Subscriptions
- `GET /api/subscriptions/tiers` - Get all tier options
- `GET /api/subscriptions/my-tier` - Get current user's tier
- `POST /api/subscriptions/upgrade` - Upgrade to paid tier
- `POST /api/subscriptions/cancel` - Cancel subscription
- `GET /api/subscriptions/calculate-commission` - Preview commission

## Revenue Model

### Platform Revenue Streams

1. **Commission on Sales**
   - Free tier: 10% of all sales
   - Paid tiers: 1-8% depending on tier
   - Automatic deduction at payment time

2. **Subscription Fees**
   - Starter: $15/month
   - Professional: $35/month
   - Enterprise: $75/month
   - Premium Plus: $150/month

### Example Revenue Calculation

**Scenario**: Chef sells $1,000 worth of cookware

**Free Tier**:
- Commission: $100 (10%)
- Seller receives: $900
- Platform revenue: $100

**Professional Tier** ($35/mo):
- Commission: $50 (5%)
- Seller receives: $950
- Platform revenue: $50 + $35 = $85

**Premium Plus Tier** ($150/mo):
- Commission: $10 (1%)
- Seller receives: $990
- Platform revenue: $10 + $150 = $160

## Next Steps

### Immediate (To Launch)
1. Configure DATABASE_URL and run migration
2. Set up Square sandbox credentials
3. Test end-to-end payment flow
4. Test payout processing
5. Add frontend tier upgrade prompts

### Short Term (1-2 weeks)
1. Implement recurring subscription billing
2. Add Stripe as alternative to Square
3. Build out store builder UI components
4. Add seller onboarding flow
5. Create admin dashboard for payouts

### Medium Term (1 month)
1. Automated payout scheduling (weekly/monthly)
2. Advanced analytics for sellers
3. Product variant support
4. Inventory management
5. Multi-currency support

### Long Term (3+ months)
1. White-label options for premium tier
2. API access for enterprise customers
3. Advanced marketplace features (reviews, ratings)
4. Bulk operations
5. Integration with external e-commerce platforms

## Files Modified

### Schema & Database
- `shared/schema.ts` - Added 4 new tables, types, and insert schemas
- `server/drizzle/20251108_marketplace_monetization.sql` - Migration file

### Backend Routes
- `server/routes/payments.ts` - Enabled Square payments + commission tracking
- `server/routes/payouts.ts` - Enabled seller payouts + payout history
- `server/routes/marketplace.ts` - Added tier enforcement for products
- `server/routes/stores-crud.ts` - Added tier enforcement for store builder

### Dependencies
- Added `square` npm package for payment processing

## Testing Checklist

- [ ] Create product as Free tier user (should work up to 5)
- [ ] Try to create 6th product as Free tier (should fail)
- [ ] Upgrade to Starter tier
- [ ] Create custom store (should work)
- [ ] Create product and complete purchase
- [ ] Verify commission record created correctly
- [ ] Process seller payout
- [ ] Verify commission marked as "paid"
- [ ] Check payout history
- [ ] Test with Square sandbox credentials
- [ ] Test payment refund flow

## Support & Maintenance

### Monitoring Needed
- Failed payments (Square errors)
- Failed payouts
- Commission calculation accuracy
- Tier limit violations
- Subscription renewals

### Regular Tasks
- Process pending payouts (weekly/monthly)
- Review commission rates
- Monitor high-value transactions
- Handle disputes/chargebacks
- Update tier features

---

**Implementation Date**: November 8, 2025
**Status**: Backend Complete, Frontend Pending
**Ready for**: Testing and Square Configuration
