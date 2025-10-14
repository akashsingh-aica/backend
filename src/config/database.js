const mongoose = require('mongoose');

async function connectToDatabase() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        
        if (!mongoUri) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };

        await mongoose.connect(mongoUri, options);
        
        console.log('✅ Connected to MongoDB successfully');
        
        // Handle connection events
        mongoose.connection.on('error', (error) => {
            console.error('❌ MongoDB connection error:', error);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('📡 MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('🔄 MongoDB reconnected');
        });

        // Note: Graceful shutdown is handled by the main server
        // to avoid conflicts with multiple signal handlers

    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error.message);
        process.exit(1);
    }
}

async function disconnectFromDatabase() {
    try {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('✅ MongoDB disconnected successfully');
        }
    } catch (error) {
        console.error('❌ Error disconnecting from MongoDB:', error.message);
        throw error;
    }
}

module.exports = {
    connectToDatabase,
    disconnectFromDatabase,
    mongoose
};