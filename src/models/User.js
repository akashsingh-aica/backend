const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Schema
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 30
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: function() {
            return !this.googleId; // Password required only if not Google user
        },
        minlength: 6
    },
    googleId: {
        type: String,
        sparse: true // Allows null values but ensures uniqueness when present
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    profilePicture: {
        type: String,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    brokerAccounts: [{
        brokerType: {
            type: String,
            required: true,
            enum: ['zerodha', 'upstox', 'angelone'] // Add more as needed
        },
        brokerId: {
            type: String,
            required: true
        },
        accessToken: {
            type: String,
            required: false
        },
        refreshToken: {
            type: String,
            required: false
        },
        isActive: {
            type: Boolean,
            default: true
        },
        connectedAt: {
            type: Date,
            default: Date.now
        },
        lastUsed: {
            type: Date,
            default: Date.now
        }
    }],
    preferences: {
        defaultBroker: {
            type: String,
            enum: ['zerodha', 'upstox', 'angelone'],
            default: 'zerodha'
        },
        theme: {
            type: String,
            enum: ['light', 'dark'],
            default: 'light'
        },
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            push: {
                type: Boolean,
                default: true
            }
        }
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            delete ret.password;
            delete ret.__v;
            // Remove sensitive broker data from JSON output
            if (ret.brokerAccounts) {
                ret.brokerAccounts.forEach(account => {
                    delete account.accessToken;
                    delete account.refreshToken;
                });
            }
            return ret;
        }
    }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ 'brokerAccounts.brokerType': 1, 'brokerAccounts.brokerId': 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to add broker account
userSchema.methods.addBrokerAccount = function(brokerData) {
    // Remove existing account for same broker if exists
    this.brokerAccounts = this.brokerAccounts.filter(
        account => account.brokerType !== brokerData.brokerType
    );
    
    // Add new broker account
    this.brokerAccounts.push({
        brokerType: brokerData.brokerType,
        brokerId: brokerData.brokerId,
        accessToken: brokerData.accessToken,
        refreshToken: brokerData.refreshToken,
        isActive: true,
        connectedAt: new Date(),
        lastUsed: new Date()
    });
    
    return this.save();
};

// Instance method to get broker account
userSchema.methods.getBrokerAccount = function(brokerType) {
    return this.brokerAccounts.find(
        account => account.brokerType === brokerType && account.isActive
    );
};

// Instance method to remove broker account
userSchema.methods.removeBrokerAccount = function(brokerType) {
    this.brokerAccounts = this.brokerAccounts.filter(
        account => account.brokerType !== brokerType
    );
    return this.save();
};

// Static method to find user by email or username
userSchema.statics.findByEmailOrUsername = function(identifier) {
    return this.findOne({
        $or: [
            { email: identifier },
            { username: identifier }
        ],
        isActive: true
    });
};

// Static method to find user by Google ID
userSchema.statics.findByGoogleId = function(googleId) {
    return this.findOne({ googleId, isActive: true });
};

module.exports = mongoose.model('User', userSchema);