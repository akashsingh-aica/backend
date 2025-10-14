const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TradingSession = require('../models/TradingSession');

// Middleware to authenticate JWT token
async function authenticateToken(request, reply) {
    try {
        const authHeader = request.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return reply.status(401).send({
                success: false,
                error: 'Access token is required'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find user and check if still active
        const user = await User.findById(decoded.userId);
        if (!user || !user.isActive) {
            return reply.status(401).send({
                success: false,
                error: 'Invalid or expired token'
            });
        }

        // Attach user to request
        request.user = user;
        
    } catch (error) {
        return reply.status(401).send({
            success: false,
            error: 'Invalid token'
        });
    }
}

// Middleware to authenticate broker session
async function authenticateBrokerSession(request, reply) {
    try {
        await authenticateToken(request, reply);
        
        const { brokerType } = request.params;
        
        if (!brokerType) {
            return reply.status(400).send({
                success: false,
                error: 'Broker type is required'
            });
        }

        // Check if user has active session for this broker
        const session = await TradingSession.findActiveSession(request.user._id, brokerType);
        
        if (!session) {
            return reply.status(401).send({
                success: false,
                error: `No active ${brokerType} session found. Please authenticate first.`
            });
        }

        // Update last activity
        await session.updateActivity();
        
        request.brokerSession = session;
        
    } catch (error) {
        return reply.status(500).send({
            success: false,
            error: 'Session validation failed'
        });
    }
}

// Middleware to validate request body
function validateRequest(schema) {
    return (request, reply, done) => {
        const { error } = schema.validate(request.body);
        if (error) {
            return reply.status(400).send({
                success: false,
                error: error.details[0].message
            });
        }
        done();
    };
}

// Middleware for error handling
function errorHandler(error, request, reply) {
    console.error('API Error:', error);
    
    // MongoDB duplicate key error
    if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return reply.status(409).send({
            success: false,
            error: `${field} already exists`
        });
    }
    
    // Validation errors
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return reply.status(400).send({
            success: false,
            error: messages.join(', ')
        });
    }
    
    // JWT errors
    if (error.name === 'JsonWebTokenError') {
        return reply.status(401).send({
            success: false,
            error: 'Invalid token'
        });
    }
    
    // Default error
    reply.status(500).send({
        success: false,
        error: 'Internal server error'
    });
}

// Rate limiting middleware (basic implementation)
function rateLimit(options = {}) {
    const requests = new Map();
    const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    const maxRequests = options.max || 100;

    return (request, reply, done) => {
        const key = request.ip;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean old entries
        if (requests.has(key)) {
            const userRequests = requests.get(key).filter(time => time > windowStart);
            requests.set(key, userRequests);
        }

        const userRequests = requests.get(key) || [];
        
        if (userRequests.length >= maxRequests) {
            return reply.status(429).send({
                success: false,
                error: 'Too many requests'
            });
        }

        userRequests.push(now);
        requests.set(key, userRequests);
        done();
    };
}

module.exports = {
    authenticateToken,
    authenticateBrokerSession,
    validateRequest,
    errorHandler,
    rateLimit
};