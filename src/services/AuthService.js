const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { google } = require('googleapis');
const User = require('../models/User');
const TradingSession = require('../models/TradingSession');
const BrokerFactory = require('../brokers/BrokerFactory');

class AuthService {
    constructor() {
        this.googleOAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URL
        );
    }

    // Generate JWT token
    generateToken(userId) {
        return jwt.sign(
            { userId },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
    }

    // Generate session token for broker connections
    generateSessionToken() {
        return jwt.sign(
            { type: 'broker_session', timestamp: Date.now() },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
    }

    // Register new user
    async register(userData) {
        try {
            // Check if user already exists
            const existingUser = await User.findByEmailOrUsername(userData.email);
            if (existingUser) {
                throw new Error('User with this email or username already exists');
            }

            // Create new user
            const user = new User({
                username: userData.username,
                email: userData.email,
                password: userData.password,
                firstName: userData.firstName,
                lastName: userData.lastName
            });

            await user.save();

            // Generate token
            const token = this.generateToken(user._id);

            return {
                success: true,
                user: user.toJSON(),
                token
            };
        } catch (error) {
            throw new Error(`Registration failed: ${error.message}`);
        }
    }

    // Login with username/email and password
    async login(credentials) {
        try {
            const { identifier, password } = credentials;

            // Find user by email or username
            const user = await User.findByEmailOrUsername(identifier);
            if (!user) {
                throw new Error('Invalid credentials');
            }

            // Check password
            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                throw new Error('Invalid credentials');
            }

            // Generate token
            const token = this.generateToken(user._id);

            return {
                success: true,
                user: user.toJSON(),
                token
            };
        } catch (error) {
            throw new Error(`Login failed: ${error.message}`);
        }
    }

    // Get Google OAuth URL
    getGoogleAuthUrl() {
        const scopes = [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email'
        ];

        return this.googleOAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent'
        });
    }

    // Handle Google OAuth callback
    async handleGoogleCallback(code) {
        try {
            // Get tokens from Google
            const { tokens } = await this.googleOAuth2Client.getToken(code);
            this.googleOAuth2Client.setCredentials(tokens);

            // Get user info from Google
            const oauth2 = google.oauth2({ version: 'v2', auth: this.googleOAuth2Client });
            const { data: googleUser } = await oauth2.userinfo.get();

            // Check if user exists with this Google ID
            let user = await User.findByGoogleId(googleUser.id);

            if (!user) {
                // Check if user exists with this email
                const existingUser = await User.findOne({ email: googleUser.email });
                
                if (existingUser) {
                    // Link Google account to existing user
                    existingUser.googleId = googleUser.id;
                    if (googleUser.picture) {
                        existingUser.profilePicture = googleUser.picture;
                    }
                    user = await existingUser.save();
                } else {
                    // Create new user
                    user = new User({
                        googleId: googleUser.id,
                        email: googleUser.email,
                        username: this.generateUsernameFromEmail(googleUser.email),
                        firstName: googleUser.given_name || 'User',
                        lastName: googleUser.family_name || '',
                        profilePicture: googleUser.picture
                    });
                    await user.save();
                }
            } else {
                // Update profile picture if changed
                if (googleUser.picture && user.profilePicture !== googleUser.picture) {
                    user.profilePicture = googleUser.picture;
                    await user.save();
                }
            }

            // Generate JWT token
            const token = this.generateToken(user._id);

            return {
                success: true,
                user: user.toJSON(),
                token
            };
        } catch (error) {
            throw new Error(`Google authentication failed: ${error.message}`);
        }
    }

    // Authenticate with broker (Zerodha)
    async authenticateWithBroker(userId, brokerType, requestToken) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Create broker instance
            const brokerConfig = this.getBrokerConfig(brokerType);
            const broker = BrokerFactory.createBroker(brokerType, brokerConfig);

            let sessionData;

            if (brokerType === 'zerodha') {
                // Generate session for Zerodha
                sessionData = await broker.generateSession(requestToken);
                
                // Test connection
                broker.setAccessToken(sessionData.access_token);
                const profile = await broker.getProfile();

                // Save broker account to user
                await user.addBrokerAccount({
                    brokerType,
                    brokerId: profile.user_id,
                    accessToken: sessionData.access_token,
                    refreshToken: sessionData.refresh_token
                });

                // Create trading session
                const sessionToken = this.generateSessionToken();
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours from now

                const tradingSession = new TradingSession({
                    userId: user._id,
                    brokerType,
                    sessionToken,
                    accessToken: sessionData.access_token,
                    refreshToken: sessionData.refresh_token,
                    expiresAt,
                    metadata: {
                        brokerProfile: profile
                    }
                });

                await tradingSession.save();

                return {
                    success: true,
                    session: {
                        sessionToken,
                        expiresAt,
                        brokerProfile: profile
                    }
                };
            }

            throw new Error(`Broker ${brokerType} not supported yet`);
        } catch (error) {
            throw new Error(`Broker authentication failed: ${error.message}`);
        }
    }

    // Get broker login URL
    getBrokerLoginUrl(brokerType) {
        try {
            const brokerConfig = this.getBrokerConfig(brokerType);
            const broker = BrokerFactory.createBroker(brokerType, brokerConfig);
            
            if (brokerType === 'zerodha') {
                return broker.getLoginUrl();
            }
            
            throw new Error(`Broker ${brokerType} not supported yet`);
        } catch (error) {
            throw new Error(`Failed to get broker login URL: ${error.message}`);
        }
    }

    // Logout and invalidate sessions
    async logout(userId, brokerType = null) {
        try {
            if (brokerType) {
                // Logout from specific broker
                await TradingSession.updateMany(
                    { userId, brokerType, isActive: true },
                    { $set: { isActive: false } }
                );
            } else {
                // Logout from all brokers
                await TradingSession.updateMany(
                    { userId, isActive: true },
                    { $set: { isActive: false } }
                );
            }

            return { success: true };
        } catch (error) {
            throw new Error(`Logout failed: ${error.message}`);
        }
    }

    // Helper methods
    getBrokerConfig(brokerType) {
        switch (brokerType) {
            case 'zerodha':
                return {
                    apiKey: process.env.KITE_API_KEY,
                    apiSecret: process.env.KITE_API_SECRET,
                    redirectUrl: process.env.KITE_REDIRECT_URL
                };
            default:
                throw new Error(`Unsupported broker: ${brokerType}`);
        }
    }

    generateUsernameFromEmail(email) {
        const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        const randomSuffix = Math.floor(Math.random() * 1000);
        return `${baseUsername}${randomSuffix}`;
    }
}

module.exports = new AuthService();