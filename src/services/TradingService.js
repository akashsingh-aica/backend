const BrokerFactory = require('../brokers/BrokerFactory');
const TradingSession = require('../models/TradingSession');
const User = require('../models/User');

class TradingService {
    constructor() {
        this.activeBrokers = new Map(); // Cache active broker instances
    }

    // Get or create broker instance for user session
    async getBrokerInstance(userId, brokerType) {
        try {
            const sessionKey = `${userId}_${brokerType}`;
            
            // Check if we have cached instance
            if (this.activeBrokers.has(sessionKey)) {
                return this.activeBrokers.get(sessionKey);
            }

            // Get active session
            const session = await TradingSession.findActiveSession(userId, brokerType);
            if (!session) {
                throw new Error(`No active ${brokerType} session found`);
            }

            // Create broker instance
            const brokerConfig = this.getBrokerConfig(brokerType);
            const broker = BrokerFactory.createBroker(brokerType, brokerConfig);

            // Set access token and connect
            if (brokerType === 'zerodha') {
                broker.setAccessToken(session.accessToken);
                await broker.connect();
            }

            // Cache the instance
            this.activeBrokers.set(sessionKey, broker);

            return broker;
        } catch (error) {
            throw new Error(`Failed to get broker instance: ${error.message}`);
        }
    }

    // Get user profile from broker
    async getUserProfile(userId, brokerType) {
        try {
            const broker = await this.getBrokerInstance(userId, brokerType);
            return await broker.getProfile();
        } catch (error) {
            throw new Error(`Failed to get user profile: ${error.message}`);
        }
    }

    // Get user positions
    async getPositions(userId, brokerType) {
        try {
            const broker = await this.getBrokerInstance(userId, brokerType);
            return await broker.getPositions();
        } catch (error) {
            throw new Error(`Failed to get positions: ${error.message}`);
        }
    }

    // Get user holdings
    async getHoldings(userId, brokerType) {
        try {
            const broker = await this.getBrokerInstance(userId, brokerType);
            return await broker.getHoldings();
        } catch (error) {
            throw new Error(`Failed to get holdings: ${error.message}`);
        }
    }

    // Get user orders
    async getOrders(userId, brokerType) {
        try {
            const broker = await this.getBrokerInstance(userId, brokerType);
            return await broker.getOrders();
        } catch (error) {
            throw new Error(`Failed to get orders: ${error.message}`);
        }
    }

    // Place an order
    async placeOrder(userId, brokerType, orderParams) {
        try {
            const broker = await this.getBrokerInstance(userId, brokerType);
            
            // Validate order parameters based on broker type
            this.validateOrderParams(brokerType, orderParams);
            
            return await broker.placeOrder(orderParams);
        } catch (error) {
            throw new Error(`Failed to place order: ${error.message}`);
        }
    }

    // Get instruments list
    async getInstruments(userId, brokerType, exchange = null) {
        try {
            const broker = await this.getBrokerInstance(userId, brokerType);
            
            if (brokerType === 'zerodha') {
                return await broker.getInstruments(exchange);
            }
            
            throw new Error(`Get instruments not implemented for ${brokerType}`);
        } catch (error) {
            throw new Error(`Failed to get instruments: ${error.message}`);
        }
    }

    // WebSocket methods
    async connectWebSocket(userId, brokerType) {
        try {
            const broker = await this.getBrokerInstance(userId, brokerType);
            return await broker.connectWebSocket();
        } catch (error) {
            throw new Error(`Failed to connect WebSocket: ${error.message}`);
        }
    }

    async subscribeToTicker(userId, brokerType, instruments) {
        try {
            const broker = await this.getBrokerInstance(userId, brokerType);
            return await broker.subscribeToTicker(instruments);
        } catch (error) {
            throw new Error(`Failed to subscribe to ticker: ${error.message}`);
        }
    }

    async unsubscribeFromTicker(userId, brokerType, instruments) {
        try {
            const broker = await this.getBrokerInstance(userId, brokerType);
            return await broker.unsubscribeFromTicker(instruments);
        } catch (error) {
            throw new Error(`Failed to unsubscribe from ticker: ${error.message}`);
        }
    }

    async getSubscribedInstruments(userId, brokerType) {
        try {
            const broker = await this.getBrokerInstance(userId, brokerType);
            
            if (typeof broker.getSubscribedInstruments === 'function') {
                return broker.getSubscribedInstruments();
            }
            
            return [];
        } catch (error) {
            throw new Error(`Failed to get subscribed instruments: ${error.message}`);
        }
    }

    // Get user's active broker sessions
    async getActiveSessions(userId) {
        try {
            const sessions = await TradingSession.find({
                userId,
                isActive: true,
                expiresAt: { $gt: new Date() }
            }).select('brokerType expiresAt lastActivity metadata.brokerProfile');

            return sessions.map(session => ({
                brokerType: session.brokerType,
                expiresAt: session.expiresAt,
                lastActivity: session.lastActivity,
                profile: session.metadata?.brokerProfile
            }));
        } catch (error) {
            throw new Error(`Failed to get active sessions: ${error.message}`);
        }
    }

    // Disconnect broker instance
    async disconnectBroker(userId, brokerType) {
        try {
            const sessionKey = `${userId}_${brokerType}`;
            
            // Disconnect cached instance if exists
            if (this.activeBrokers.has(sessionKey)) {
                const broker = this.activeBrokers.get(sessionKey);
                await broker.disconnect();
                this.activeBrokers.delete(sessionKey);
            }

            // Mark session as inactive
            await TradingSession.updateMany(
                { userId, brokerType, isActive: true },
                { $set: { isActive: false } }
            );

            return { success: true };
        } catch (error) {
            throw new Error(`Failed to disconnect broker: ${error.message}`);
        }
    }

    // Cleanup expired sessions (should be run periodically)
    async cleanupExpiredSessions() {
        try {
            await TradingSession.cleanupExpiredSessions();
            
            // Remove expired instances from cache
            for (const [key, broker] of this.activeBrokers.entries()) {
                const [userId, brokerType] = key.split('_');
                const activeSession = await TradingSession.findActiveSession(userId, brokerType);
                
                if (!activeSession) {
                    await broker.disconnect();
                    this.activeBrokers.delete(key);
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('Cleanup expired sessions error:', error);
        }
    }

    // Helper methods
    getBrokerConfig(brokerType) {
        switch (brokerType) {
            case 'zerodha':
                return {
                    apiKey: process.env.KITE_API_KEY,
                    apiSecret: process.env.KITE_API_SECRET
                };
            default:
                throw new Error(`Unsupported broker: ${brokerType}`);
        }
    }

    validateOrderParams(brokerType, orderParams) {
        if (brokerType === 'zerodha') {
            const requiredFields = ['variety', 'exchange', 'tradingsymbol', 'transaction_type', 'quantity', 'product', 'order_type'];
            
            for (const field of requiredFields) {
                if (!orderParams[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }

            // Validate enum values
            const validVarieties = ['regular', 'bo', 'co', 'iceberg', 'auction'];
            const validTransactionTypes = ['BUY', 'SELL'];
            const validProducts = ['CNC', 'MIS', 'NRML'];
            const validOrderTypes = ['MARKET', 'LIMIT', 'SL', 'SL-M'];

            if (!validVarieties.includes(orderParams.variety)) {
                throw new Error(`Invalid variety. Must be one of: ${validVarieties.join(', ')}`);
            }

            if (!validTransactionTypes.includes(orderParams.transaction_type)) {
                throw new Error(`Invalid transaction_type. Must be one of: ${validTransactionTypes.join(', ')}`);
            }

            if (!validProducts.includes(orderParams.product)) {
                throw new Error(`Invalid product. Must be one of: ${validProducts.join(', ')}`);
            }

            if (!validOrderTypes.includes(orderParams.order_type)) {
                throw new Error(`Invalid order_type. Must be one of: ${validOrderTypes.join(', ')}`);
            }
        }
    }
}

module.exports = new TradingService();