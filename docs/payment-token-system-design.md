# Technical Design Document: Payment & Token System for Hunter Trades Journal

## 1. Database Schema

### 1.1 User
```
{
  _id: ObjectId,
  discord_id: String,
  username: String,
  email: String,
  created_at: Date,
  updated_at: Date,
  is_booster: Boolean,
  booster_expiry: Date,
  registration_status: String, // 'pending', 'active', 'failed'
  registration_paid_at: Date
}
```

### 1.2 Registration (ONE-TIME — Init Payment)
```
{
  _id: ObjectId,
  user_id: ObjectId,
  amount_idr: Number,            // 2000000 atau 1800000 (Booster discount 10%)
  amount_usd: Number,            // Converted value saat transaksi
  booster_discount_applied: Boolean,
  status: String,                // 'pending', 'paid', 'failed', 'refunded'
  midtrans_transaction_id: String,
  midtrans_reference_id: String,
  paid_at: Date,
  created_at: Date
}
```
**Catatan**: `Registration` hanya satu record per user — **bukan recurring subscription**. Hanya sekali bayar untuk aktivasi akun.

### 1.3 Subscription (RECURRING — Monthly Token Topup)
```
{
  _id: ObjectId,
  user_id: ObjectId,
  plan: String, // 'basic', 'premium', 'enterprise'
  status: String, // 'active', 'cancelled', 'expired'
  start_date: Date,
  end_date: Date,
  auto_renew: Boolean,
  created_at: Date,
  updated_at: Date
}
```

### 1.3 TokenBalance
```
{
  _id: ObjectId,
  user_id: ObjectId,
  balance: Number,
  last_updated: Date,
  monthly_reset_date: Date
}
```

### 1.4 Transaction
```
{
  _id: ObjectId,
  user_id: ObjectId,
  type: String, // 'purchase', 'consumption', 'refund'
  amount: Number,
  currency: String, // 'IDR', 'USD'
  status: String, // 'completed', 'pending', 'failed'
  reference_id: String, // Midtrans transaction ID
  created_at: Date,
  updated_at: Date,
  description: String
}
```

## 2. Midtrans Integration Flow

### 2.1 Snap Payment Flow
```
1. User initiates payment via frontend
2. Backend creates transaction record in database
3. Backend calls Midtrans Snap API to create payment token
4. Frontend receives payment token and redirects user to Midtrans payment page
5. User completes payment
6. Midtrans sends callback to backend
7. Backend verifies payment status and updates transaction record
8. Backend updates user's token balance if payment is successful
```

### 2.2 Callback Handling
```
1. Receive callback from Midtrans
2. Verify callback signature
3. Update transaction status in database
4. If payment is successful:
   a. Calculate token amount based on payment amount
   b. Update user's token balance
   c. Create new transaction record
5. Send confirmation to user
```

## 3. Discord Booster Verification

### 3.1 Better Auth Integration
```
1. User links Discord account via Better Auth
2. Backend verifies Discord Booster role
3. If user has active Booster role:
   a. Set is_booster flag to true in User collection
   b. Set booster_expiry date based on role expiry
4. Schedule periodic check for Booster role status
```

## 4. Token Consumption Logic

### 4.1 Token Deduction
```
1. When user makes AI request:
   a. Check user's token balance
   b. If balance is sufficient:
      i. Deduct tokens from balance
      ii. Create consumption transaction record
      iii. Proceed with AI request
   c. If balance is insufficient:
      i. Return error response
      ii. Suggest payment options
```

### 4.2 Token Refill
```
1. User purchases tokens via Midtrans
2. Payment callback updates token balance
3. System automatically resets token balance on monthly_reset_date
```

## 5. AI Trading Auto-Block

### 5.1 Token Monitoring
```
1. Before each AI trading request:
   a. Check user's token balance
   b. If balance is below threshold:
      i. Block trading request
      ii. Notify user to refill tokens
```

### 5.2 Trading Session Management
```
1. When trading session starts:
   a. Set token consumption rate limit
   b. Monitor token usage in real-time
   c. If tokens are depleted:
      i. Terminate trading session
      ii. Save session state
      iii. Notify user
```

## 6. Currency Conversion Service

### 6.1 Exchange Rate API
```
1. Integrate with reliable exchange rate API
2. Cache exchange rates for performance
3. Provide conversion function:
   a. convertCurrency(amount, fromCurrency, toCurrency)
```

### 6.2 Payment Processing
```
1. For international payments:
   a. Convert payment amount to IDR using current exchange rate
   b. Process payment in IDR
   c. Record original currency and amount in transaction
```

## 7. System Architecture

```
[Frontend] <-> [Express API] <-> [MongoDB]
                     ^
                     |
                     v
               [Midtrans] [Discord API]
```

## 8. Security Considerations

- Implement proper authentication for all API endpoints
- Validate all incoming data
- Encrypt sensitive data in database
- Implement rate limiting for API endpoints
- Regularly update dependencies to patch security vulnerabilities

## 9. Deployment Plan

1. Set up MongoDB database
2. Deploy backend API
3. Configure Midtrans payment gateway
4. Set up Discord OAuth via Better Auth
5. Implement frontend payment interface
6. Test all payment flows
7. Monitor system performance and adjust as needed
