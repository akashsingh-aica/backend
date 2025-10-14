const mongoose = require('mongoose');

// Trading Session Schema to track active broker connections
const tradingSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    brokerType: {
        type: String,
        required: true,
        enum: ['zerodha', 'upstox', 'angelone']
    },
    sessionToken: {
        type: String,
        required: true,
        unique: true
    },
    accessToken: {
        type: String,
        required: true
    },
    refreshToken: {
        type: String
    },
    expiresAt: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    userAgent: String,
    ipAddress: String,
    metadata: {
        loginTime: {
            type: Date,
            default: Date.now
        },
        brokerProfile: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// Indexes
tradingSessionSchema.index({ userId: 1, brokerType: 1 });
tradingSessionSchema.index({ sessionToken: 1 });
tradingSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
tradingSessionSchema.index({ isActive: 1 });

// Instance method to update last activity
tradingSessionSchema.methods.updateActivity = function() {
    this.lastActivity = new Date();
    return this.save();
};

// Static method to find active session
tradingSessionSchema.statics.findActiveSession = function(userId, brokerType) {
    return this.findOne({
        userId,
        brokerType,
        isActive: true,
        expiresAt: { $gt: new Date() }
    });
};

// Static method to cleanup expired sessions
tradingSessionSchema.statics.cleanupExpiredSessions = function() {
    return this.updateMany(
        { expiresAt: { $lte: new Date() } },
        { $set: { isActive: false } }
    );
};

module.exports = mongoose.model('TradingSession', tradingSessionSchema);