const TradingSession = require('../models/TradingSession');
const User = require('../models/User');

async function webhookRoutes(fastify, options) {
    
    // Zerodha Postback webhook
    fastify.post('/zerodha/postback', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    user_id: { type: 'string' },
                    order_id: { type: 'string' },
                    order_timestamp: { type: 'string' },
                    exchange_order_id: { type: 'string' },
                    tradingsymbol: { type: 'string' },
                    exchange: { type: 'string' },
                    instrument_token: { type: 'number' },
                    order_type: { type: 'string' },
                    transaction_type: { type: 'string' },
                    variety: { type: 'string' },
                    product: { type: 'string' },
                    quantity: { type: 'number' },
                    price: { type: 'number' },
                    trigger_price: { type: 'number' },
                    average_price: { type: 'number' },
                    filled_quantity: { type: 'number' },
                    pending_quantity: { type: 'number' },
                    cancelled_quantity: { type: 'number' },
                    status: { type: 'string' },
                    status_message: { type: 'string' },
                    validity: { type: 'string' },
                    tag: { type: 'string' },
                    guid: { type: 'string' },
                    parent_order_id: { type: 'string' },
                    checksum: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const postbackData = request.body;
            
            console.log('📨 Received Zerodha postback:', {
                order_id: postbackData.order_id,
                status: postbackData.status,
                tradingsymbol: postbackData.tradingsymbol,
                user_id: postbackData.user_id
            });

            // Validate checksum (important for security)
            if (!validatePostbackChecksum(postbackData)) {
                console.error('❌ Invalid checksum in postback');
                return reply.status(400).send({
                    success: false,
                    error: 'Invalid checksum'
                });
            }

            // Find user by Zerodha user ID
            const user = await User.findOne({
                'brokerAccounts.brokerType': 'zerodha',
                'brokerAccounts.brokerId': postbackData.user_id,
                'brokerAccounts.isActive': true
            });

            if (!user) {
                console.log('⚠️  User not found for Zerodha user ID:', postbackData.user_id);
                return reply.status(200).send({ success: true, message: 'User not found' });
            }

            // Process the postback based on status
            await processOrderUpdate(user, postbackData);

            // Emit real-time notification (if using WebSocket)
            // You can extend this to emit to connected clients
            emitOrderUpdate(user._id, postbackData);

            reply.send({
                success: true,
                message: 'Postback processed successfully'
            });

        } catch (error) {
            console.error('❌ Error processing Zerodha postback:', error);
            reply.status(500).send({
                success: false,
                error: 'Internal server error'
            });
        }
    });

    // Health check for webhook
    fastify.get('/health', async (request, reply) => {
        reply.send({
            success: true,
            message: 'Webhook service is healthy',
            timestamp: new Date().toISOString()
        });
    });
}

// Validate postback checksum for security
function validatePostbackChecksum(data) {
    // Zerodha provides checksum validation
    // You should implement this based on Zerodha's documentation
    // For now, we'll skip validation in development
    if (process.env.NODE_ENV === 'development') {
        return true;
    }

    // In production, implement proper checksum validation
    const crypto = require('crypto');
    const { checksum, ...dataWithoutChecksum } = data;
    
    // Create checksum string as per Zerodha documentation
    const checksumString = Object.keys(dataWithoutChecksum)
        .sort()
        .map(key => `${key}=${dataWithoutChecksum[key]}`)
        .join('&');
    
    const expectedChecksum = crypto
        .createHmac('sha256', process.env.KITE_API_SECRET)
        .update(checksumString)
        .digest('hex');
    
    return checksum === expectedChecksum;
}

// Process order updates based on status
async function processOrderUpdate(user, orderData) {
    try {
        console.log(`📊 Processing order update for user ${user._id}:`, {
            order_id: orderData.order_id,
            status: orderData.status,
            symbol: orderData.tradingsymbol
        });

        // Handle different order statuses
        switch (orderData.status) {
            case 'COMPLETE':
                console.log('✅ Order completed:', orderData.order_id);
                // You can store order completion in database
                // Send notification to user
                break;
                
            case 'CANCELLED':
                console.log('❌ Order cancelled:', orderData.order_id);
                // Handle cancellation
                break;
                
            case 'REJECTED':
                console.log('🚫 Order rejected:', orderData.order_id, orderData.status_message);
                // Handle rejection
                break;
                
            case 'OPEN':
                console.log('📝 Order placed:', orderData.order_id);
                // Handle order placement
                break;
                
            default:
                console.log('📋 Order status update:', orderData.status);
        }

        // You can extend this to:
        // 1. Store order updates in database
        // 2. Send email/SMS notifications
        // 3. Update user's portfolio in real-time
        // 4. Trigger automated trading strategies

    } catch (error) {
        console.error('Error processing order update:', error);
    }
}

// Emit real-time order updates to connected clients
function emitOrderUpdate(userId, orderData) {
    // If you have WebSocket connections, emit the update
    // This is a placeholder for real-time functionality
    console.log(`🔄 Emitting order update to user ${userId}:`, {
        type: 'ORDER_UPDATE',
        order_id: orderData.order_id,
        status: orderData.status,
        symbol: orderData.tradingsymbol
    });

    // You can implement this using:
    // 1. Socket.IO for real-time updates
    // 2. Server-sent events
    // 3. WebSocket connections
    // 4. Push notifications
}

module.exports = webhookRoutes;