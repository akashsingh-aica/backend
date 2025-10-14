const TradingService = require('../services/TradingService');
const { authenticateToken, authenticateBrokerSession, rateLimit } = require('../middleware/auth');

async function tradingRoutes(fastify, options) {
    // Rate limiting for trading routes
    const tradingRateLimit = rateLimit({ windowMs: 1 * 60 * 1000, max: 100 }); // 100 requests per minute

    // Get user's active trading sessions
    fastify.get('/sessions', {
        preHandler: [authenticateToken]
    }, async (request, reply) => {
        try {
            const sessions = await TradingService.getActiveSessions(request.user._id);
            
            reply.send({
                success: true,
                sessions
            });
        } catch (error) {
            reply.status(500).send({
                success: false,
                error: error.message
            });
        }
    });

    // Get user profile from broker
    fastify.get('/:brokerType/profile', {
        preHandler: [authenticateToken, tradingRateLimit]
    }, async (request, reply) => {
        try {
            const { brokerType } = request.params;
            const profile = await TradingService.getUserProfile(request.user._id, brokerType);
            
            reply.send({
                success: true,
                profile
            });
        } catch (error) {
            reply.status(400).send({
                success: false,
                error: error.message
            });
        }
    });

    // Get user positions
    fastify.get('/:brokerType/positions', {
        preHandler: [authenticateToken, tradingRateLimit]
    }, async (request, reply) => {
        try {
            const { brokerType } = request.params;
            const positions = await TradingService.getPositions(request.user._id, brokerType);
            
            reply.send({
                success: true,
                positions
            });
        } catch (error) {
            reply.status(400).send({
                success: false,
                error: error.message
            });
        }
    });

    // Get user holdings
    fastify.get('/:brokerType/holdings', {
        preHandler: [authenticateToken, tradingRateLimit]
    }, async (request, reply) => {
        try {
            const { brokerType } = request.params;
            const holdings = await TradingService.getHoldings(request.user._id, brokerType);
            
            reply.send({
                success: true,
                holdings
            });
        } catch (error) {
            reply.status(400).send({
                success: false,
                error: error.message
            });
        }
    });

    // Get user orders
    fastify.get('/:brokerType/orders', {
        preHandler: [authenticateToken, tradingRateLimit]
    }, async (request, reply) => {
        try {
            const { brokerType } = request.params;
            const orders = await TradingService.getOrders(request.user._id, brokerType);
            
            reply.send({
                success: true,
                orders
            });
        } catch (error) {
            reply.status(400).send({
                success: false,
                error: error.message
            });
        }
    });

    // Place an order
    fastify.post('/:brokerType/orders', {
        preHandler: [authenticateToken, tradingRateLimit],
        schema: {
            params: {
                type: 'object',
                required: ['brokerType'],
                properties: {
                    brokerType: { type: 'string', enum: ['zerodha'] }
                }
            },
            body: {
                type: 'object',
                required: ['variety', 'exchange', 'tradingsymbol', 'transaction_type', 'quantity', 'product', 'order_type'],
                properties: {
                    variety: { type: 'string', enum: ['regular', 'bo', 'co', 'iceberg', 'auction'] },
                    exchange: { type: 'string' },
                    tradingsymbol: { type: 'string' },
                    transaction_type: { type: 'string', enum: ['BUY', 'SELL'] },
                    quantity: { type: 'number', minimum: 1 },
                    product: { type: 'string', enum: ['CNC', 'MIS', 'NRML'] },
                    order_type: { type: 'string', enum: ['MARKET', 'LIMIT', 'SL', 'SL-M'] },
                    price: { type: 'number', minimum: 0 },
                    trigger_price: { type: 'number', minimum: 0 },
                    validity: { type: 'string', enum: ['DAY', 'IOC'] },
                    tag: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { brokerType } = request.params;
            const orderResult = await TradingService.placeOrder(
                request.user._id,
                brokerType,
                request.body
            );
            
            reply.send({
                success: true,
                order: orderResult
            });
        } catch (error) {
            reply.status(400).send({
                success: false,
                error: error.message
            });
        }
    });

    // Get instruments list
    fastify.get('/:brokerType/instruments', {
        preHandler: [authenticateToken],
        schema: {
            params: {
                type: 'object',
                required: ['brokerType'],
                properties: {
                    brokerType: { type: 'string', enum: ['zerodha'] }
                }
            },
            querystring: {
                type: 'object',
                properties: {
                    exchange: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { brokerType } = request.params;
            const { exchange } = request.query;
            
            const instruments = await TradingService.getInstruments(
                request.user._id,
                brokerType,
                exchange
            );
            
            reply.send({
                success: true,
                instruments
            });
        } catch (error) {
            reply.status(400).send({
                success: false,
                error: error.message
            });
        }
    });

    // WebSocket routes
    
    // Connect to WebSocket
    fastify.post('/:brokerType/websocket/connect', {
        preHandler: [authenticateToken]
    }, async (request, reply) => {
        try {
            const { brokerType } = request.params;
            const result = await TradingService.connectWebSocket(request.user._id, brokerType);
            
            reply.send({
                success: true,
                message: 'WebSocket connected successfully',
                ...result
            });
        } catch (error) {
            reply.status(400).send({
                success: false,
                error: error.message
            });
        }
    });

    // Subscribe to ticker
    fastify.post('/:brokerType/websocket/subscribe', {
        preHandler: [authenticateToken],
        schema: {
            params: {
                type: 'object',
                required: ['brokerType'],
                properties: {
                    brokerType: { type: 'string', enum: ['zerodha'] }
                }
            },
            body: {
                type: 'object',
                required: ['instruments'],
                properties: {
                    instruments: {
                        type: 'array',
                        items: { type: 'number' },
                        minItems: 1
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { brokerType } = request.params;
            const { instruments } = request.body;
            
            const result = await TradingService.subscribeToTicker(
                request.user._id,
                brokerType,
                instruments
            );
            
            reply.send({
                success: true,
                message: 'Subscribed to instruments successfully',
                ...result
            });
        } catch (error) {
            reply.status(400).send({
                success: false,
                error: error.message
            });
        }
    });

    // Unsubscribe from ticker
    fastify.post('/:brokerType/websocket/unsubscribe', {
        preHandler: [authenticateToken],
        schema: {
            params: {
                type: 'object',
                required: ['brokerType'],
                properties: {
                    brokerType: { type: 'string', enum: ['zerodha'] }
                }
            },
            body: {
                type: 'object',
                required: ['instruments'],
                properties: {
                    instruments: {
                        type: 'array',
                        items: { type: 'number' },
                        minItems: 1
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { brokerType } = request.params;
            const { instruments } = request.body;
            
            const result = await TradingService.unsubscribeFromTicker(
                request.user._id,
                brokerType,
                instruments
            );
            
            reply.send({
                success: true,
                message: 'Unsubscribed from instruments successfully',
                ...result
            });
        } catch (error) {
            reply.status(400).send({
                success: false,
                error: error.message
            });
        }
    });

    // Get subscribed instruments
    fastify.get('/:brokerType/websocket/subscriptions', {
        preHandler: [authenticateToken]
    }, async (request, reply) => {
        try {
            const { brokerType } = request.params;
            const instruments = await TradingService.getSubscribedInstruments(
                request.user._id,
                brokerType
            );
            
            reply.send({
                success: true,
                instruments
            });
        } catch (error) {
            reply.status(400).send({
                success: false,
                error: error.message
            });
        }
    });

    // Disconnect from broker
    fastify.post('/:brokerType/disconnect', {
        preHandler: [authenticateToken]
    }, async (request, reply) => {
        try {
            const { brokerType } = request.params;
            const result = await TradingService.disconnectBroker(
                request.user._id,
                brokerType
            );
            
            reply.send({
                success: true,
                message: `Disconnected from ${brokerType} successfully`
            });
        } catch (error) {
            reply.status(400).send({
                success: false,
                error: error.message
            });
        }
    });
}

module.exports = tradingRoutes;