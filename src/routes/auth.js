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
            
            // Store user ID in session for OAuth callback
            request.session.userId = request.user._id.toString();
            request.session.brokerType = brokerType;
            request.session.timestamp = Date.now();
            
            // Force session save before responding
            await new Promise((resolve, reject) => {
                request.session.save((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            const loginUrl = AuthService.getBrokerLoginUrl(brokerType);
            
            reply.send({
                success: true,
                loginUrl,
                message: 'Open this URL in your browser to authorize with Zerodha',
                sessionInfo: {
                    sessionId: request.session.sessionId,
                    expiresIn: '30 minutes'
                }
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
                    request_token: { type: 'string' },
                    action: { type: 'string' },
                    status: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { brokerType } = request.params;
            const { request_token, status } = request.query;
            
            // Check if authorization was denied
            if (status === 'error') {
                return reply.send(`
                    <html>
                        <head><title>Authorization Failed</title></head>
                        <body style="font-family: Arial, sans-serif; padding: 50px; text-align: center;">
                            <h1>❌ Authorization Failed</h1>
                            <p>You denied authorization or an error occurred.</p>
                            <p>Please close this window and try again.</p>
                        </body>
                    </html>
                `);
            }
            
            // Get user ID from session (set when getting login URL)
            const userId = request.session.userId;
            const sessionTimestamp = request.session.timestamp;
            const timeSinceSession = sessionTimestamp ? Math.floor((Date.now() - sessionTimestamp) / 1000) : 'unknown';
            
            // Log session info for debugging
            fastify.log.info({
                hasSession: !!request.session,
                hasUserId: !!userId,
                sessionId: request.session.sessionId,
                timeSinceSession: timeSinceSession + ' seconds'
            }, 'OAuth callback received');
            
            if (!userId) {
                return reply.status(400).send(`
                    <html>
                        <head><title>Session Expired</title></head>
                        <body style="font-family: Arial, sans-serif; padding: 50px; text-align: center;">
                            <h1>⚠️ Session Expired or Not Found</h1>
                            <p>Your session has expired or cookies are being blocked by your browser.</p>
                            
                            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 600px;">
                                <h3>🔍 Troubleshooting</h3>
                                <p style="text-align: left;"><strong>Common causes:</strong></p>
                                <ul style="text-align: left;">
                                    <li>Waited too long (>30 min) between steps</li>
                                    <li>Browser blocking cookies (check privacy settings)</li>
                                    <li>Using incognito/private mode</li>
                                    <li>Different browser than the one used for API call</li>
                                </ul>
                                <p style="text-align: left;"><strong>Session info:</strong> ${timeSinceSession === 'unknown' ? 'No session found' : 'Last active ' + timeSinceSession + ' seconds ago'}</p>
                            </div>
                            
                            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 600px;">
                                <h3>🔄 Try Again</h3>
                                <p style="text-align: left;">Steps:</p>
                                <ol style="text-align: left;">
                                    <li>Make sure cookies are enabled in your browser</li>
                                    <li>Call GET /api/auth/broker/zerodha/url with your JWT token</li>
                                    <li><strong>Immediately</strong> open the returned URL in the <strong>same browser</strong></li>
                                    <li>Authorize the application</li>
                                </ol>
                            </div>
                        </body>
                    </html>
                `);
            }
            
            const result = await AuthService.authenticateWithBroker(
                userId,
                brokerType,
                request_token
            );
            
            // Success - show user-friendly HTML response
            reply.type('text/html').send(`
                <html>
                    <head>
                        <title>Authorization Successful</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 50px; text-align: center; }
                            .success { color: #28a745; }
                            .info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 600px; text-align: left; }
                            code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
                        </style>
                    </head>
                    <body>
                        <h1 class="success">✅ Zerodha Authorization Successful!</h1>
                        <p>Your trading account has been connected.</p>
                        
                        <div class="info">
                            <h3>📊 Broker Profile</h3>
                            <p><strong>User ID:</strong> ${result.session.brokerProfile.user_id}</p>
                            <p><strong>User Name:</strong> ${result.session.brokerProfile.user_name}</p>
                            <p><strong>Email:</strong> ${result.session.brokerProfile.email}</p>
                            <p><strong>Session Expires:</strong> ${new Date(result.session.expiresAt).toLocaleString()}</p>
                        </div>
                        
                        <div class="info">
                            <h3>🎯 Next Steps</h3>
                            <p>You can now use the trading APIs:</p>
                            <ul style="text-align: left;">
                                <li><code>GET /api/trading/zerodha/profile</code> - Get your profile</li>
                                <li><code>GET /api/trading/zerodha/positions</code> - View positions</li>
                                <li><code>GET /api/trading/zerodha/holdings</code> - View holdings</li>
                                <li><code>POST /api/trading/zerodha/orders</code> - Place orders</li>
                                <li><code>GET /api/trading/zerodha/instruments</code> - Get instrument list</li>
                            </ul>
                            <p><strong>Remember:</strong> Include your JWT token in the Authorization header!</p>
                        </div>
                        
                        <p>You can close this window now.</p>
                    </body>
                </html>
            `);
        } catch (error) {
            reply.status(400).type('text/html').send(`
                <html>
                    <head><title>Error</title></head>
                    <body style="font-family: Arial, sans-serif; padding: 50px; text-align: center;">
                        <h1>❌ Error</h1>
                        <p>${error.message}</p>
                        <p>Please close this window and try again.</p>
                    </body>
                </html>
            `);
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