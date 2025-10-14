// Base broker interface for extensibility
class BaseBroker {
    constructor(config) {
        this.config = config;
        this.isConnected = false;
    }

    // Abstract methods that all brokers must implement
    async connect() {
        throw new Error('connect() method must be implemented');
    }

    async disconnect() {
        throw new Error('disconnect() method must be implemented');
    }

    async getProfile() {
        throw new Error('getProfile() method must be implemented');
    }

    async getPositions() {
        throw new Error('getPositions() method must be implemented');
    }

    async getHoldings() {
        throw new Error('getHoldings() method must be implemented');
    }

    async placeOrder(orderParams) {
        throw new Error('placeOrder() method must be implemented');
    }

    async getOrders() {
        throw new Error('getOrders() method must be implemented');
    }

    // WebSocket methods
    async connectWebSocket() {
        throw new Error('connectWebSocket() method must be implemented');
    }

    async subscribeToTicker(instruments) {
        throw new Error('subscribeToTicker() method must be implemented');
    }

    async unsubscribeFromTicker(instruments) {
        throw new Error('unsubscribeFromTicker() method must be implemented');
    }
}

module.exports = BaseBroker;