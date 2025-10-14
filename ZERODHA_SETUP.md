# Zerodha Kite Connect Setup Guide

## 📋 Required URLs for Zerodha Kite Connect

Zerodha Kite Connect requires **two different URLs** to be configured in your app settings:

### 1. 🔄 **Redirect URL** (Mandatory)
- **Purpose**: Where users are redirected after login/authorization
- **When used**: During OAuth flow when user authorizes your app
- **URL Format**: `http://localhost:3000/api/auth/broker/zerodha/callback`

### 2. 📨 **Postback URL** (Optional but Recommended)
- **Purpose**: Receives real-time order updates and notifications
- **When used**: Whenever order status changes (placed, executed, cancelled, etc.)
- **URL Format**: `http://localhost:3000/api/webhooks/zerodha/postback`

## 🔧 Environment Configuration

Your `.env` file should have:

```env
# Zerodha Kite Connect API Configuration
KITE_API_KEY=your_api_key_here
KITE_API_SECRET=your_api_secret_here
KITE_REDIRECT_URL=http://localhost:3000/api/auth/broker/zerodha/callback
KITE_POSTBACK_URL=http://localhost:3000/api/webhooks/zerodha/postback
```

## 🌐 Zerodha Developer Console Setup

### Step 1: Login to Kite Connect
1. Go to [https://kite.trade/](https://kite.trade/)
2. Login with your Zerodha account
3. Navigate to "My Apps" or create a new app

### Step 2: Configure URLs
In your Kite Connect app settings, set:

**Redirect URL (Required):**
```
http://localhost:3000/api/auth/broker/zerodha/callback
```

**Postback URL (Optional):**
```
http://localhost:3000/api/webhooks/zerodha/postback
```

### Step 3: Note Your Credentials
- **API Key**: Found in your app dashboard
- **API Secret**: Found in your app dashboard (keep this secure!)

## 🔄 Authentication Flow

### User Login Process:
1. User calls: `GET /api/auth/broker/zerodha/url`
2. API returns Zerodha login URL
3. User visits URL and authorizes your app
4. Zerodha redirects to: `http://localhost:3000/api/auth/broker/zerodha/callback?request_token=xxx`
5. Your API handles callback and creates session

### Order Updates (Postback):
1. User places an order via API
2. Order status changes (executed, cancelled, etc.)
3. Zerodha sends POST request to: `http://localhost:3000/api/webhooks/zerodha/postback`
4. Your API processes the update and can notify user in real-time

## 🧪 Testing Your Setup

### 1. Test Redirect URL:
```bash
# Start your server
npm run dev

# Register a user and get token
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'

# Get Zerodha login URL
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/auth/broker/zerodha/url
```

### 2. Test Postback URL:
```bash
# Test webhook endpoint
curl -X POST http://localhost:3000/api/webhooks/zerodha/postback \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "test123",
    "status": "COMPLETE",
    "tradingsymbol": "INFY",
    "user_id": "test_user"
  }'

# Check webhook health
curl http://localhost:3000/api/webhooks/health
```

## 🚀 Production Deployment

When deploying to production, update your Zerodha app with:

**Redirect URL:**
```
https://yourdomain.com/api/auth/broker/zerodha/callback
```

**Postback URL:**
```
https://yourdomain.com/api/webhooks/zerodha/postback
```

And update your `.env`:
```env
KITE_REDIRECT_URL=https://yourdomain.com/api/auth/broker/zerodha/callback
KITE_POSTBACK_URL=https://yourdomain.com/api/webhooks/zerodha/postback
```

## 🔒 Security Considerations

### Postback Security:
- Zerodha sends a checksum with postback data
- Always validate the checksum to ensure authenticity
- The webhook handler includes checksum validation
- Use HTTPS in production for secure communication

### API Security:
- Keep your API Secret secure and never expose it
- Use environment variables for sensitive data
- Implement proper authentication for your API endpoints
- Rate limit your webhook endpoints to prevent abuse

## 🐛 Common Issues

### 1. **Redirect URL Mismatch**
- Error: "Invalid redirect_uri"
- Solution: Ensure exact match between Zerodha app settings and your `.env`

### 2. **Postback Not Received**
- Check if postback URL is accessible from internet
- Verify webhook endpoint is working: `GET /api/webhooks/health`
- Check server logs for incoming requests

### 3. **Invalid Checksum**
- Postback requests failing validation
- Ensure you're using correct API Secret for checksum validation
- Check Zerodha documentation for latest checksum algorithm

## 📊 Webhook Data Format

Zerodha sends postback data in this format:

```json
{
  "user_id": "XX1234",
  "order_id": "151220000000000",
  "order_timestamp": "2023-12-15 09:15:32",
  "exchange_order_id": "1234567890",
  "tradingsymbol": "INFY",
  "exchange": "NSE",
  "instrument_token": 408065,
  "order_type": "MARKET",
  "transaction_type": "BUY",
  "variety": "regular",
  "product": "CNC",
  "quantity": 1,
  "price": 0,
  "trigger_price": 0,
  "average_price": 1500.25,
  "filled_quantity": 1,
  "pending_quantity": 0,
  "cancelled_quantity": 0,
  "status": "COMPLETE",
  "status_message": "",
  "validity": "DAY",
  "tag": "",
  "guid": "unique_id",
  "parent_order_id": null,
  "checksum": "calculated_checksum_value"
}
```

## 🔗 Useful Links

- [Zerodha Kite Connect Documentation](https://kite.trade/docs/connect/v3/)
- [Postback Documentation](https://kite.trade/docs/connect/v3/postback/)
- [API Documentation](https://kite.trade/docs/connect/v3/api/)
- [Error Codes Reference](https://kite.trade/docs/connect/v3/exceptions/)

---

**Note**: Replace `localhost:3000` with your actual domain when deploying to production!