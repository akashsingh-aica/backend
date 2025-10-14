# Trading Application - Multi-Broker Architecture

A comprehensive trading application with extensible architecture supporting multiple brokers, built with Node.js, Fastify, and MongoDB.

## ⚡ Quick Start

```bash
# 1. Generate secrets
node -e "const crypto = require('crypto'); console.log('JWT_SECRET=' + crypto.randomBytes(64).toString('hex')); console.log('SESSION_SECRET=' + crypto.randomBytes(64).toString('hex'))"

# 2. Set up environment (interactive)
node setup.js

# 3. Install dependencies
npm install

# 4. Start the application
npm run dev

# 5. Test the API
curl http://localhost:3000/health
```

## 🚀 Features

- **Multi-Broker Support**: Extensible architecture to integrate multiple brokers (currently supports Zerodha Kite Connect)
- **Authentication**: JWT-based authentication with username/password and Google OAuth
- **Real-time Data**: WebSocket integration for live market data
- **RESTful API**: Complete REST API for trading operations
- **Database Integration**: MongoDB for user management and session handling
- **Security**: Rate limiting, input validation, and secure token management
- **Extensible Design**: Factory pattern for easy broker integration

## 🏗️ Architecture

### Design Patterns Used

1. **Factory Pattern**: `BrokerFactory` for creating different broker instances
2. **Strategy Pattern**: `BaseBroker` interface for different broker implementations
3. **Service Layer**: Separation of business logic from API routes
4. **Repository Pattern**: MongoDB models with business logic methods

### Project Structure

```
src/
├── brokers/            # Broker implementations
│   ├── BaseBroker.js      # Base interface for all brokers
│   ├── ZerodhaBroker.js   # Zerodha Kite Connect implementation
│   └── BrokerFactory.js   # Factory for creating broker instances
├── config/             # Configuration files
│   └── database.js        # MongoDB connection setup
├── middleware/         # Express/Fastify middleware
│   └── auth.js           # Authentication & authorization middleware
├── models/             # Database models
│   ├── User.js           # User model with broker accounts
│   └── TradingSession.js # Active trading sessions
├── routes/             # API routes
│   ├── auth.js           # Authentication routes
│   └── trading.js        # Trading API routes
├── services/           # Business logic services
│   ├── AuthService.js    # Authentication service
│   └── TradingService.js # Trading operations service
└── server.js           # Main application entry point
```

## 🛠️ Installation & Setup

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Zerodha Kite Connect API credentials
- Google OAuth credentials (optional)

### Installation

1. **Clone and install dependencies**:
```bash
cd /path/to/your/trading/project
npm install
```

2. **Generate secure secrets**:
```bash
# Generate JWT and Session secrets
node -e "const crypto = require('crypto'); console.log('JWT_SECRET=' + crypto.randomBytes(64).toString('hex')); console.log('SESSION_SECRET=' + crypto.randomBytes(64).toString('hex'))"

# Or use the interactive setup script
node setup.js
```

3. **Configure environment variables**:
Update the `.env` file with your actual values:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/trading-app

# JWT Configuration  
JWT_SECRET=your-super-secret-jwt-key-here

# Session Configuration
SESSION_SECRET=your-session-secret-key-here

# Zerodha Kite Connect API Configuration
KITE_API_KEY=your-kite-api-key-here
KITE_API_SECRET=your-kite-api-secret-here
KITE_REDIRECT_URL=http://localhost:3000/api/auth/broker/zerodha/callback

# Google OAuth Configuration (Optional)
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_REDIRECT_URL=http://localhost:3000/api/auth/google/callback

# WebSocket Configuration
WS_HOST=ws.kite.trade
WS_PORT=443
```

3. **Start the application**:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com", 
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "identifier": "john@example.com",  // email or username
  "password": "securepassword"
}
```

#### Google OAuth
```http
GET /api/auth/google/url
# Returns Google OAuth URL for user authorization
```

#### Broker Authentication (Zerodha)
```http
GET /api/auth/broker/zerodha/url
Authorization: Bearer <jwt-token>
# Returns Zerodha login URL
```

### Trading Endpoints

#### Get User Profile
```http
GET /api/trading/zerodha/profile
Authorization: Bearer <jwt-token>
```

#### Get Positions
```http
GET /api/trading/zerodha/positions  
Authorization: Bearer <jwt-token>
```

#### Get Holdings
```http
GET /api/trading/zerodha/holdings
Authorization: Bearer <jwt-token>
```

#### Place Order
```http
POST /api/trading/zerodha/orders
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "variety": "regular",
  "exchange": "NSE",
  "tradingsymbol": "INFY",
  "transaction_type": "BUY",
  "quantity": 1,
  "product": "CNC",
  "order_type": "MARKET"
}
```

#### WebSocket Operations
```http
# Connect to WebSocket
POST /api/trading/zerodha/websocket/connect
Authorization: Bearer <jwt-token>

# Subscribe to instruments
POST /api/trading/zerodha/websocket/subscribe
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "instruments": [256265, 408065]  // instrument tokens
}
```

## 🔄 Usage Flow

### Complete Authentication & Trading Flow

1. **User Registration/Login**:
   - Register new user or login with existing credentials
   - Receive JWT token for API authentication

2. **Broker Authentication**:
   - Get broker login URL from API
   - User authorizes on broker website
   - Handle callback with request token
   - API exchanges token for access token

3. **Trading Operations**:
   - Make API calls using JWT token
   - Access user profile, positions, holdings
   - Place orders, get order status
   - Subscribe to live market data via WebSocket

## 🔧 Adding New Brokers

The architecture is designed for easy broker integration:

1. **Create Broker Implementation**:
```javascript
// src/brokers/NewBroker.js
const BaseBroker = require('./BaseBroker');

class NewBroker extends BaseBroker {
    async connect() {
        // Implement connection logic
    }
    
    async getProfile() {
        // Implement profile fetching
    }
    
    // Implement other required methods...
}
```

2. **Update Factory**:
```javascript
// src/brokers/BrokerFactory.js
case 'newbroker':
    return new NewBroker(config);
```

3. **Add Configuration**:
```javascript
// src/services/AuthService.js & TradingService.js
case 'newbroker':
    return {
        apiKey: process.env.NEW_BROKER_API_KEY,
        apiSecret: process.env.NEW_BROKER_API_SECRET
    };
```

## 🛡️ Security Features

- JWT-based authentication with expiration
- Password hashing using bcrypt  
- Rate limiting on API endpoints
- Input validation and sanitization
- CORS protection
- Session management for broker connections
- Secure token storage

## 🚦 Error Handling

The application includes comprehensive error handling:

- Global error handlers for unhandled exceptions
- Specific error responses for different error types
- Validation error messages
- Rate limiting responses
- Database connection error handling

## 📊 Monitoring & Logging

- Structured logging with different levels
- Health check endpoint (`/health`)
- API documentation endpoint (`/api`)
- Request/response logging in development mode

## 🧪 Testing

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test API info
curl http://localhost:3000/api

# Test user registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123","firstName":"Test","lastName":"User"}'
```

## 🔧 Utility Scripts & Commands

### Environment Setup

```bash
# Interactive setup script (recommended)
node setup.js

# Generate secure JWT and Session secrets
node -e "const crypto = require('crypto'); console.log('JWT_SECRET=' + crypto.randomBytes(64).toString('hex')); console.log('SESSION_SECRET=' + crypto.randomBytes(64).toString('hex'))"

# Generate single secret key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Database Operations

```bash
# Check MongoDB connection (local)
mongosh --eval "db.adminCommand('ping')"

# Connect to MongoDB and list databases
mongosh "mongodb://localhost:27017" --eval "show dbs"

# Drop trading database (careful!)
mongosh "mongodb://localhost:27017/trading-app" --eval "db.dropDatabase()"
```

### Development & Testing

```bash
# Start server in development mode
npm run dev

# Start server in production mode
npm start

# Check server health
curl http://localhost:3000/health

# Get API documentation
curl http://localhost:3000/api | jq .

# Run API examples
node examples/api-usage-examples.js

# Check what's running on port 3000
lsof -i :3000

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Environment Validation

```bash
# Check if all required environment variables are set
node -e "
const required = ['MONGODB_URI', 'JWT_SECRET', 'KITE_API_KEY', 'KITE_API_SECRET'];
const missing = required.filter(key => !process.env[key] || process.env[key].includes('enter your'));
console.log(missing.length ? 'Missing: ' + missing.join(', ') : '✅ All required vars set');
"
```

### MongoDB Setup (Local)

```bash
# Install MongoDB (macOS with Homebrew)
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community

# Stop MongoDB service
brew services stop mongodb-community

# Install MongoDB (Ubuntu)
sudo apt update
sudo apt install -y mongodb

# Start MongoDB service (Ubuntu)
sudo systemctl start mongod
sudo systemctl enable mongod
```

### API Testing with curl

```bash
# Register a test user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'

# Login and get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "test@example.com",
    "password": "password123"
  }' | jq -r '.token')

# Use token for authenticated requests
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/auth/profile

# Get Zerodha login URL
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/auth/broker/zerodha/url
```

### Debugging & Monitoring

```bash
# Monitor server logs
tail -f logs/app.log  # if you set up file logging

# Check memory usage
node -e "console.log('Memory:', process.memoryUsage())"

# Monitor MongoDB logs (local)
tail -f /usr/local/var/log/mongodb/mongo.log

# Check Node.js version compatibility
node -v && npm -v
```

### Production Deployment Helpers

```bash
# Set production environment
export NODE_ENV=production

# Install production dependencies only
npm ci --production

# Check for security vulnerabilities
npm audit

# Update dependencies
npm update

# Create production build (if using build process)
npm run build
```

### Quick Troubleshooting

```bash
# Clear npm cache
npm cache clean --force

# Reinstall node_modules
rm -rf node_modules package-lock.json && npm install

# Check port conflicts
netstat -tulpn | grep :3000

# Test MongoDB connection
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ MongoDB error:', err.message));
"
```

## 🤝 Contributing

1. Follow the established patterns when adding new features
2. Implement proper error handling and validation
3. Add appropriate logging for debugging
4. Update documentation for new endpoints
5. Test thoroughly before committing

## 📄 License

This project is licensed under the MIT License.

---

**Note**: Remember to replace all placeholder values in the `.env` file with your actual API keys and configuration before running the application.