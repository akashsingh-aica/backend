const AuthService = require('../services/AuthService');
const { authenticateToken, validateRequest, rateLimit } = require('../middleware/auth');

async function authRoutes(fastify, options) {
    // Rate limiting for auth routes
    const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

    // Register new user
    fastify.post('/register', {
        preHandler: authRateLimit,
        schema: {
            body: {
                type: 'object',
                required: ['username', 'email', 'password', 'firstName', 'lastName'],
                properties: {
                    username: { type: 'string', minLength: 3, maxLength: 30 },
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 6 },
                    firstName: { type: 'string', minLength: 1 },
                    lastName: { type: 'string', minLength: 1 }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const result = await AuthService.register(request.body);
            reply.send(result);
        } catch (error) {
            reply.status(400).send({
                success: false,
                error: error.message
            });
        }
    });

    // Login with username/email and password
    fastify.post('/login', {
        preHandler: authRateLimit,
        schema: {
            body: {
                type: 'object',
                required: ['identifier', 'password'],
                properties: {
                    identifier: { type: 'string' }, // email or username
                    password: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const result = await AuthService.login(request.body);
            reply.send(result);
        } catch (error) {
            reply.status(401).send({
                success: false,
                error: error.message
            });
        }
    });

    // Get Google OAuth URL
    fastify.get('/google/url', async (request, reply) => {
        try {
            const authUrl = AuthService.getGoogleAuthUrl();
            reply.send({
                success: true,
                authUrl
            });
        } catch (error) {
            reply.status(500).send({
                success: false,
                error: error.message
            });
        }
    });

    // Handle Google OAuth callback
    fastify.get('/google/callback', {
        schema: {
            querystring: {
                type: 'object',
                required: ['code'],
                properties: {
                    code: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { code } = request.query;
            const result = await AuthService.handleGoogleCallback(code);
            
            // In a real app, you might redirect to frontend with token
            reply.send(result);
        } catch (error) {
            reply.status(400).send({
                success: false,
                error: error.message
            });
        }
    });

    // Get broker login URL
    fastify.get('/broker/:brokerType/url', {
        preHandler: [authenticateToken],
        schema: {
            params: {
                type: 'object',
                required: ['brokerType'],
                properties: {
                    brokerType: { type: 'string', enum: ['zerodha'] }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { brokerType } = request.params;
            const loginUrl = AuthService.getBrokerLoginUrl(brokerType);
            
            reply.send({
                success: true,
                loginUrl
            });
        } catch (error) {
            reply.status(400).send({
                success: false,
                error: error.message
            });
        }
    });

    // Handle broker OAuth callback
    fastify.get('/broker/:brokerType/callback', {
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
                required: ['request_token'],
                properties: {
                    request_token: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { brokerType } = request.params;
            const { request_token } = request.query;
            
            const result = await AuthService.authenticateWithBroker(
                request.user._id,
                brokerType,
                request_token
            );
            
            reply.send(result);
        } catch (error) {
            reply.status(400).send({
                success: false,
                error: error.message
            });
        }
    });

    // Logout from specific broker or all brokers
    fastify.post('/logout', {
        preHandler: [authenticateToken],
        schema: {
            body: {
                type: 'object',
                properties: {
                    brokerType: { type: 'string', enum: ['zerodha'] }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { brokerType } = request.body;
            const result = await AuthService.logout(request.user._id, brokerType);
            
            reply.send(result);
        } catch (error) {
            reply.status(500).send({
                success: false,
                error: error.message
            });
        }
    });

    // Get current user profile
    fastify.get('/profile', {
        preHandler: [authenticateToken]
    }, async (request, reply) => {
        try {
            reply.send({
                success: true,
                user: request.user.toJSON()
            });
        } catch (error) {
            reply.status(500).send({
                success: false,
                error: error.message
            });
        }
    });
}

module.exports = authRoutes;