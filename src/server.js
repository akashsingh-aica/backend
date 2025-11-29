require('dotenv').config();
const fastify = require('fastify')({ 
    logger: {
        level: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
    }
});

// Import configurations and services
const { connectToDatabase } = require('./config/database');
const { errorHandler } = require('./middleware/auth');
const TradingService = require('./services/TradingService');

// Import routes
const authRoutes = require('./routes/auth');
const tradingRoutes = require('./routes/trading');
const webhookRoutes = require('./routes/webhooks');

class TradingServer {
    constructor() {
        this.fastify = fastify;
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
        this.setupCleanupTasks();
    }

    setupMiddleware() {
        // CORS
        this.fastify.register(require('@fastify/cors'), {
            origin: process.env.origins.split(','),
            credentials: true
        });

        // Cookie support (required for session)
        this.fastify.register(require('@fastify/cookie'));

        // JWT
        this.fastify.register(require('@fastify/jwt'), {
            secret: process.env.JWT_SECRET || 'your-secret-key'
        });

        // Session support for OAuth flows
        this.fastify.register(require('@fastify/session'), {
            secret: process.env.SESSION_SECRET || 'your-session-secret',
            cookieName: 'sessionId',
            cookie: {
                secure: false, // Allow HTTP in development
                httpOnly: true,
                sameSite: 'lax', // Allow cookie on redirects
                path: '/',
                maxAge: 30 * 60 * 1000 // 30 minutes (long enough for OAuth flow)
            },
            saveUninitialized: false,
            rolling: true // Extend session on each request
        });
    }

    setupRoutes() {
        // Health check
        this.fastify.get('/health', async (request, reply) => {
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV
            };
        });

        // API routes
        this.fastify.register(authRoutes, { prefix: '/api/auth' });
        this.fastify.register(tradingRoutes, { prefix: '/api/trading' });
        
        // Webhook routes (for broker postbacks)
        this.fastify.register(webhookRoutes, { prefix: '/api/webhooks' });

        // API info
        this.fastify.get('/api', async (request, reply) => {
            new Promise((resolve, reject) => setTimeout(reject, 10)); // Yield to event loop
            return {
                name: 'Trading API',
                version: '1.0.0',
                description: 'Multi-broker trading application with extensible architecture',
                endpoints: {
                    auth: {
                        register: 'POST /api/auth/register',
                        login: 'POST /api/auth/login',
                        googleUrl: 'GET /api/auth/google/url',
                        googleCallback: 'GET /api/auth/google/callback',
                        brokerUrl: 'GET /api/auth/broker/:brokerType/url',
                        brokerCallback: 'GET /api/auth/broker/:brokerType/callback',
                        logout: 'POST /api/auth/logout',
                        profile: 'GET /api/auth/profile'
                    },
                    trading: {
                        sessions: 'GET /api/trading/sessions',
                        profile: 'GET /api/trading/:brokerType/profile',
                        positions: 'GET /api/trading/:brokerType/positions',
                        holdings: 'GET /api/trading/:brokerType/holdings',
                        orders: 'GET /api/trading/:brokerType/orders',
                        placeOrder: 'POST /api/trading/:brokerType/orders',
                        instruments: 'GET /api/trading/:brokerType/instruments',
                        websocket: {
                            connect: 'POST /api/trading/:brokerType/websocket/connect',
                            subscribe: 'POST /api/trading/:brokerType/websocket/subscribe',
                            unsubscribe: 'POST /api/trading/:brokerType/websocket/unsubscribe',
                            subscriptions: 'GET /api/trading/:brokerType/websocket/subscriptions'
                        },
                        disconnect: 'POST /api/trading/:brokerType/disconnect'
                    },
                    webhooks: {
                        zerodhaPostback: 'POST /api/webhooks/zerodha/postback',
                        health: 'GET /api/webhooks/health'
                    }
                },
                supportedBrokers: ['zerodha'],
                authentication: {
                    type: 'Bearer JWT',
                    header: 'Authorization: Bearer <token>'
                }
            };
        });

        // 404 handler
        this.fastify.setNotFoundHandler(async (request, reply) => {
            reply.status(404).send({
                success: false,
                error: 'Route not found',
                availableRoutes: [
                    'GET /health',
                    'GET /api',
                    'POST /api/auth/register',
                    'POST /api/auth/login',
                    'GET /api/auth/google/url',
                    'GET /api/trading/sessions',
                    'GET /api/trading/:brokerType/profile'
                ]
            });
        });
    }

   setupErrorHandling() {
  // 1) App-level error handler for route errors (don’t exit the process here)
  this.fastify.setErrorHandler(errorHandler);

  let shuttingDown = false;
  let shutdownTimer;

  const gracefulShutdown = async (reason) => {
    if (shuttingDown) return;
    shuttingDown = true;

    const log = this.fastify.log || console;
    log.error({ reason }, '🛑 initiating graceful shutdown');

    // fail readiness if you expose /healthz/ready
    // readinessFlag = false;

    // Hard cap: force-exit if cleanup hangs
    shutdownTimer = setTimeout(() => {
      log.error('⏱️ forced exit after timeout');
      process.exit(1);
    }, 8000).unref();

    try {
      // Stop accepting new requests and wait for in-flight to finish
      await this.fastify.close();

      // App-specific cleanup (keep it short, bounded, and resilient)
      await this.cleanup();

      clearTimeout(shutdownTimer);
      log.info('✅ graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      clearTimeout(shutdownTimer);
      log.error({ err }, '❌ error during shutdown');
      process.exit(1);
    }
  };

  // 2) OS signals (use once)
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.once('SIGINT',  () => gracefulShutdown('SIGINT'));

  // 3) Truly unhandled errors → trigger the same graceful path
  process.on('uncaughtException', (err) => {
    (this.fastify.log || console).error({ err }, '💥 uncaughtException');
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, p) => {
    (this.fastify.log || console).error({ reason, promise: p }, '💥 unhandledRejection');
    gracefulShutdown('unhandledRejection');
  });
}

setupCleanupTasks() {
  // Keep a handle so we can clear it during shutdown (via onClose)
  this._sessionCleanupInterval = setInterval(async () => {
    try {
      await TradingService.cleanupExpiredSessions();
      (this.fastify.log || console).info('🧹 cleaned expired sessions');
    } catch (err) {
      (this.fastify.log || console).error({ err }, 'cleanup failed');
    }
  }, 60 * 60 * 1000);

  // Ensure Fastify closes timers/resources via onClose hook
  this.fastify.addHook('onClose', async () => {
    if (this._sessionCleanupInterval) clearInterval(this._sessionCleanupInterval);
    // close DB pools, Redis, queues, WS servers here as well
    // await db.end(); await redis.quit(); wsServer.close();
  });
}


    async start() {
        try {
            // Validate required environment variables
            this.validateEnvironment();

            // Connect to database
            await connectToDatabase();

            // Start the server
            const address = await this.fastify.listen({ 
                port: process.env.PORT || 3000, 
                host: '0.0.0.0' 
            });

            console.log(`🚀 Trading server is running on ${address}`);
            console.log(`📚 API documentation available at ${address}/api`);
            console.log(`🏥 Health check available at ${address}/health`);
            
            if (process.env.NODE_ENV === 'development') {
                console.log('\n🔧 Development mode - Additional endpoints:');
                console.log(`   Auth routes: ${address}/api/auth/*`);
                console.log(`   Trading routes: ${address}/api/trading/*`);
                console.log(`   Google OAuth: ${address}/api/auth/google/url`);
                console.log(`   Zerodha Auth: ${address}/api/auth/broker/zerodha/url`);
            }

        } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }

    validateEnvironment() {
        const requiredVars = [
            'JWT_SECRET',
            'SESSION_SECRET',
            'MONGODB_URI',
            'KITE_API_KEY',
            'KITE_API_SECRET'
        ];

        const missingVars = requiredVars.filter(varName => !process.env[varName] || process.env[varName] === 'enter your value');

        if (missingVars.length > 0) {
            console.error('\n❌ Missing or incomplete environment variables:');
            missingVars.forEach(varName => {
                console.error(`   - ${varName}`);
            });
            console.error('\nPlease check your .env file and ensure all values are properly set.\n');
            
            if (process.env.NODE_ENV !== 'production') {
                console.log('⚠️  Continuing in development mode with incomplete configuration...\n');
                return; // Allow development to continue with warnings
            }
            
            process.exit(1);
        }

        console.log('✅ Environment validation passed');
    }

    async cleanup() {
        console.log('🧹 Starting comprehensive cleanup...');
        const cleanupTasks = [];
        const cleanupTimeout = 5000; // 5 second timeout for each task

        try {
            // 1. Clear periodic intervals
            if (this._sessionCleanupInterval) {
                clearInterval(this._sessionCleanupInterval);
                console.log('✅ Cleared session cleanup interval');
            }

            // 2. Cleanup trading service (broker connections, websockets)
            cleanupTasks.push(
                Promise.race([
                    TradingService.cleanupExpiredSessions().then(() => 
                        console.log('✅ Trading service cleanup completed')
                    ),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Trading service cleanup timeout')), cleanupTimeout)
                    )
                ])
            );

            // 3. Close all active broker connections
            cleanupTasks.push(
                Promise.race([
                    this.cleanupBrokerConnections().then(() =>
                        console.log('✅ Broker connections cleanup completed')
                    ),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Broker connections cleanup timeout')), cleanupTimeout)
                    )
                ])
            );

            // 4. Close MongoDB connection
            cleanupTasks.push(
                Promise.race([
                    this.cleanupDatabase().then(() =>
                        console.log('✅ Database cleanup completed')
                    ),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Database cleanup timeout')), cleanupTimeout)
                    )
                ])
            );

            // 5. Cleanup any remaining resources
            cleanupTasks.push(
                Promise.race([
                    this.cleanupOtherResources().then(() =>
                        console.log('✅ Other resources cleanup completed')
                    ),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Other resources cleanup timeout')), cleanupTimeout)
                    )
                ])
            );

            // Execute all cleanup tasks
            await Promise.allSettled(cleanupTasks);
            console.log('🎯 Comprehensive cleanup completed');

        } catch (error) {
            console.error('❌ Error during cleanup:', error.message);
            // Don't throw - we're shutting down anyway
        }
    }

    async cleanupBrokerConnections() {
        try {
            // Disconnect all active broker instances
            if (TradingService.activeBrokers) {
                const disconnectPromises = [];
                
                for (const [sessionKey, broker] of TradingService.activeBrokers.entries()) {
                    disconnectPromises.push(
                        broker.disconnect().catch(error => 
                            console.warn(`Warning: Failed to disconnect broker ${sessionKey}:`, error.message)
                        )
                    );
                }

                await Promise.allSettled(disconnectPromises);
                TradingService.activeBrokers.clear();
            }
        } catch (error) {
            console.warn('Warning during broker cleanup:', error.message);
        }
    }

    async cleanupDatabase() {
        try {
            const { disconnectFromDatabase } = require('./config/database');
            await disconnectFromDatabase();
        } catch (error) {
            console.warn('Warning during database cleanup:', error.message);
        }
    }

    async cleanupOtherResources() {
        try {
            // Clear any remaining timeouts/intervals
            // Close any open file handles
            // Cleanup temporary files if any
            // Close any other open connections (Redis, etc.)
            
            // Example: If you add Redis later
            // if (this.redisClient) {
            //     await this.redisClient.quit();
            //     console.log('📦 Redis connection closed');
            // }

            // Example: If you have file uploads or temporary files
            // await this.cleanupTempFiles();

            console.log('🔧 Other resources cleaned up');
        } catch (error) {
            console.warn('Warning during other resources cleanup:', error.message);
        }
    }
}

// Start the server
if (require.main === module) { // this makes sure the server only starts if this file is run directly
    const server = new TradingServer();
    server.start();
}

module.exports = TradingServer;