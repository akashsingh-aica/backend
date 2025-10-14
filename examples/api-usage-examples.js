// Example usage of the Trading API
// This file demonstrates how to use the trading application API

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
let authToken = null;

// Helper function to make authenticated requests
async function apiRequest(method, endpoint, data = null) {
    const config = {
        method,
        url: `${API_BASE_URL}${endpoint}`,
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        }
    };

    if (data) {
        config.data = data;
    }

    try {
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error(`API Error on ${method} ${endpoint}:`, error.response?.data || error.message);
        throw error;
    }
}

// Example 1: User Registration and Login
async function exampleUserAuth() {
    console.log('\n=== User Authentication Example ===');
    
    try {
        // Register new user
        console.log('1. Registering new user...');
        const registerData = {
            username: 'trader123',
            email: 'trader123@example.com',
            password: 'securepassword123',
            firstName: 'John',
            lastName: 'Trader'
        };
        
        const registerResult = await apiRequest('POST', '/auth/register', registerData);
        console.log('✅ User registered successfully');
        console.log('User ID:', registerResult.user._id);
        
        // Store the token
        authToken = registerResult.token;
        console.log('🔑 Auth token received and stored');
        
        // Get user profile
        console.log('\n2. Getting user profile...');
        const profile = await apiRequest('GET', '/auth/profile');
        console.log('✅ Profile retrieved:', {
            username: profile.user.username,
            email: profile.user.email,
            fullName: `${profile.user.firstName} ${profile.user.lastName}`
        });
        
    } catch (error) {
        // If user already exists, try login instead
        if (error.response?.status === 400) {
            console.log('User already exists, trying login...');
            
            const loginData = {
                identifier: 'trader123@example.com',
                password: 'securepassword123'
            };
            
            const loginResult = await apiRequest('POST', '/auth/login', loginData);
            authToken = loginResult.token;
            console.log('✅ User logged in successfully');
        }
    }
}

// Example 2: Broker Authentication (Zerodha)
async function exampleBrokerAuth() {
    console.log('\n=== Broker Authentication Example ===');
    
    try {
        // Get Zerodha login URL
        console.log('1. Getting Zerodha login URL...');
        const urlResult = await apiRequest('GET', '/auth/broker/zerodha/url');
        console.log('🔗 Zerodha Login URL:', urlResult.loginUrl);
        
        console.log(`
📝 Manual Steps Required:
1. Open the URL above in your browser
2. Login with your Zerodha credentials
3. Copy the 'request_token' from the callback URL
4. Use it in the next API call

Example callback URL:
http://localhost:3000/api/auth/broker/zerodha/callback?request_token=ABC123&action=login&status=success

In this example, 'ABC123' is your request_token.
        `);
        
        // Note: In a real application, the callback would be handled automatically
        // For demonstration, we'll show how to use the request token
        
        console.log('\n2. Example of handling broker callback (manual step required)...');
        console.log('After getting request_token from callback URL, make this call:');
        console.log(`
curl -X GET "${API_BASE_URL}/auth/broker/zerodha/callback?request_token=YOUR_REQUEST_TOKEN" \\
  -H "Authorization: Bearer ${authToken}"
        `);
        
    } catch (error) {
        console.error('Broker auth error:', error.response?.data || error.message);
    }
}

// Example 3: Trading Operations (requires broker authentication)
async function exampleTradingOperations() {
    console.log('\n=== Trading Operations Example ===');
    
    try {
        // Check active sessions
        console.log('1. Checking active trading sessions...');
        const sessions = await apiRequest('GET', '/trading/sessions');
        console.log('📊 Active sessions:', sessions.sessions.length);
        
        if (sessions.sessions.length === 0) {
            console.log('⚠️  No active broker sessions found. Please authenticate with a broker first.');
            return;
        }
        
        const brokerType = sessions.sessions[0].brokerType;
        console.log(`Using broker: ${brokerType}`);
        
        // Get user profile from broker
        console.log('\n2. Getting broker profile...');
        const profile = await apiRequest('GET', `/trading/${brokerType}/profile`);
        console.log('✅ Broker profile:', {
            userId: profile.profile.user_id,
            userName: profile.profile.user_name,
            email: profile.profile.email
        });
        
        // Get positions
        console.log('\n3. Getting positions...');
        const positions = await apiRequest('GET', `/trading/${brokerType}/positions`);
        console.log('📈 Positions count:', positions.positions.net?.length || 0);
        
        // Get holdings
        console.log('\n4. Getting holdings...');
        const holdings = await apiRequest('GET', `/trading/${brokerType}/holdings`);
        console.log('💼 Holdings count:', holdings.holdings?.length || 0);
        
        // Get orders
        console.log('\n5. Getting orders...');
        const orders = await apiRequest('GET', `/trading/${brokerType}/orders`);
        console.log('📋 Orders count:', orders.orders?.length || 0);
        
        // Example order placement (commented out for safety)
        console.log('\n6. Example order placement (not executed):');
        const exampleOrder = {
            variety: 'regular',
            exchange: 'NSE',
            tradingsymbol: 'INFY',
            transaction_type: 'BUY',
            quantity: 1,
            product: 'CNC',
            order_type: 'MARKET'
        };
        console.log('Order details:', exampleOrder);
        console.log('⚠️  Order placement is commented out for safety');
        
        // Uncomment below to actually place order (use with caution!)
        /*
        const orderResult = await apiRequest('POST', `/trading/${brokerType}/orders`, exampleOrder);
        console.log('✅ Order placed:', orderResult.order);
        */
        
    } catch (error) {
        console.error('Trading operations error:', error.response?.data || error.message);
    }
}

// Example 4: WebSocket Operations
async function exampleWebSocketOperations() {
    console.log('\n=== WebSocket Operations Example ===');
    
    try {
        const sessions = await apiRequest('GET', '/trading/sessions');
        
        if (sessions.sessions.length === 0) {
            console.log('⚠️  No active broker sessions found for WebSocket operations.');
            return;
        }
        
        const brokerType = sessions.sessions[0].brokerType;
        
        // Connect to WebSocket
        console.log('1. Connecting to WebSocket...');
        const wsConnect = await apiRequest('POST', `/trading/${brokerType}/websocket/connect`);
        console.log('✅ WebSocket connected:', wsConnect.message);
        
        // Subscribe to sample instruments (INFY and TCS)
        console.log('\n2. Subscribing to instruments...');
        const instruments = [408065, 2953217]; // INFY and TCS instrument tokens
        const subscribe = await apiRequest('POST', `/trading/${brokerType}/websocket/subscribe`, {
            instruments
        });
        console.log('✅ Subscribed to instruments:', subscribe.instruments);
        
        // Get subscribed instruments
        console.log('\n3. Getting subscribed instruments...');
        const subscriptions = await apiRequest('GET', `/trading/${brokerType}/websocket/subscriptions`);
        console.log('📡 Currently subscribed instruments:', subscriptions.instruments);
        
        // Wait a bit to receive some ticks
        console.log('\n4. Waiting for market data... (check server logs for tick data)');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Unsubscribe from one instrument
        console.log('\n5. Unsubscribing from one instrument...');
        const unsubscribe = await apiRequest('POST', `/trading/${brokerType}/websocket/unsubscribe`, {
            instruments: [instruments[0]]
        });
        console.log('✅ Unsubscribed from instruments:', unsubscribe.instruments);
        
    } catch (error) {
        console.error('WebSocket operations error:', error.response?.data || error.message);
    }
}

// Example 5: Google OAuth (demonstrates the flow)
async function exampleGoogleAuth() {
    console.log('\n=== Google OAuth Example ===');
    
    try {
        // Get Google OAuth URL
        console.log('1. Getting Google OAuth URL...');
        const googleUrl = await apiRequest('GET', '/auth/google/url');
        console.log('🔗 Google OAuth URL:', googleUrl.authUrl);
        
        console.log(`
📝 Manual Steps for Google OAuth:
1. Open the URL above in your browser
2. Login with your Google account
3. Copy the 'code' parameter from the callback URL
4. Use it in the callback endpoint

Example callback URL:
http://localhost:3000/api/auth/google/callback?code=ABC123&scope=email+profile

Make this call with the code:
curl -X GET "${API_BASE_URL}/auth/google/callback?code=YOUR_GOOGLE_CODE"
        `);
        
    } catch (error) {
        console.error('Google OAuth error:', error.response?.data || error.message);
    }
}

// Main execution function
async function runAllExamples() {
    console.log('🚀 Starting Trading API Examples...');
    console.log('Make sure the server is running on http://localhost:3000');
    
    try {
        // Run examples in sequence
        await exampleUserAuth();
        await exampleBrokerAuth();
        await exampleGoogleAuth();
        await exampleTradingOperations();
        await exampleWebSocketOperations();
        
        console.log('\n✅ All examples completed successfully!');
        console.log('\n📚 Next steps:');
        console.log('1. Complete broker authentication using the provided URLs');
        console.log('2. Test trading operations with real broker connection');
        console.log('3. Monitor WebSocket data in server logs');
        console.log('4. Explore the API documentation at http://localhost:3000/api');
        
    } catch (error) {
        console.error('\n❌ Example execution failed:', error.message);
    }
}

// Run examples if this file is executed directly
if (require.main === module) {
    runAllExamples();
}

module.exports = {
    apiRequest,
    exampleUserAuth,
    exampleBrokerAuth,
    exampleTradingOperations,
    exampleWebSocketOperations,
    exampleGoogleAuth,
    runAllExamples
};