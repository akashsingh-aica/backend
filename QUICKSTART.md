# Trading Application - Quick Start Guide

## 🚀 Quick Start

Follow these steps to get your trading application up and running:

### 1. Setup Environment Variables

Run the interactive setup script:

```bash
node setup.js
```

This will guide you through configuring:
- Database connection
- JWT secrets
- Zerodha API credentials
- Google OAuth (optional)
- Server settings

### 2. Start MongoDB

If using local MongoDB:
```bash
# macOS (with Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

### 3. Start the Application

```bash
# Development mode (with auto-reload)
npm run dev

# Or production mode
npm start
```

### 4. Test the API

The server will start at `http://localhost:3000` (or your configured port).

#### Check if server is running:
```bash
curl http://localhost:3000/health
```

#### View API documentation:
```bash
curl http://localhost:3000/api
```

#### Run example API calls:
```bash
node examples/api-usage-examples.js
```

## 📚 API Endpoints Quick Reference

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/google/url` - Get Google OAuth URL
- `GET /api/auth/broker/zerodha/url` - Get Zerodha login URL
- `POST /api/auth/logout` - Logout user

### Trading (requires authentication)
- `GET /api/trading/sessions` - Get active trading sessions
- `GET /api/trading/zerodha/profile` - Get broker profile
- `GET /api/trading/zerodha/positions` - Get positions
- `GET /api/trading/zerodha/holdings` - Get holdings
- `GET /api/trading/zerodha/orders` - Get orders
- `POST /api/trading/zerodha/orders` - Place order

### WebSocket (requires broker authentication)
- `POST /api/trading/zerodha/websocket/connect` - Connect to live data
- `POST /api/trading/zerodha/websocket/subscribe` - Subscribe to instruments
- `POST /api/trading/zerodha/websocket/unsubscribe` - Unsubscribe from instruments

## 🔑 Getting API Keys

### Zerodha Kite Connect
1. Visit [Kite Connect](https://kite.trade/)
2. Create a developer account
3. Create a new app to get API Key and Secret
4. Set redirect URL to: `http://localhost:3000/api/auth/broker/zerodha/callback`

### Google OAuth (Optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add redirect URI: `http://localhost:3000/api/auth/google/callback`

## 🛠️ Development

### Project Structure
```
src/
├── brokers/           # Broker implementations (extensible)
├── config/           # Database and app configuration
├── middleware/       # Authentication, validation, error handling
├── models/          # MongoDB schemas
├── routes/          # API endpoints
├── services/        # Business logic
└── server.js        # Main application entry
```

### Adding New Brokers

1. Create new broker class extending `BaseBroker`
2. Update `BrokerFactory` with new broker case
3. Add configuration in services
4. Test with new broker's API

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret for JWT token signing | Yes |
| `KITE_API_KEY` | Zerodha API key | Yes |
| `KITE_API_SECRET` | Zerodha API secret | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | No |
| `PORT` | Server port | No (default: 3000) |

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check connection string in `.env`
   - Verify network connectivity

2. **Zerodha API Errors**
   - Verify API key and secret
   - Check if redirect URL matches exactly
   - Ensure request token is fresh (expires in few minutes)

3. **JWT Token Issues**
   - Check if JWT_SECRET is set
   - Verify token is being sent in Authorization header
   - Token format should be: `Bearer <token>`

4. **Port Already in Use**
   - Change PORT in `.env` file
   - Kill existing process: `lsof -ti:3000 | xargs kill -9`

### Debug Mode

Set `NODE_ENV=development` for detailed logging:
```bash
NODE_ENV=development npm run dev
```

## 📞 Support

- Check the [README.md](./README.md) for detailed documentation
- Review example usage in [examples/api-usage-examples.js](./examples/api-usage-examples.js)
- Look at the API documentation at `/api` endpoint
- Check server logs for detailed error information

## 🔄 Next Steps

1. **Complete Authentication Flow**
   - Register/login users
   - Connect broker accounts
   - Test trading operations

2. **Implement Frontend**
   - Build React/Vue/Angular frontend
   - Use the API endpoints provided
   - Handle authentication and token management

3. **Add More Brokers**
   - Follow the extensible architecture
   - Implement additional broker classes
   - Test with different broker APIs

4. **Production Deployment**
   - Set up production MongoDB
   - Configure proper JWT secrets
   - Set up HTTPS and domain
   - Configure production environment variables