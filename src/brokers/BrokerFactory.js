const ZerodhaBroker = require('./ZerodhaBroker');

// Broker Factory Pattern for extensibility
class BrokerFactory {
    static createBroker(brokerType, config) {
        switch (brokerType.toLowerCase()) {
            case 'zerodha':
                return new ZerodhaBroker(config);
            // Add more brokers here in the future
            // case 'upstox':
            //     return new UpstoxBroker(config);
            // case 'angelone':
            //     return new AngelOneBroker(config);
            default:
                throw new Error(`Unsupported broker type: ${brokerType}`);
        }
    }

    static getSupportedBrokers() {
        return ['zerodha'];
        // Return all supported brokers in the future
        // return ['zerodha', 'upstox', 'angelone'];
    }
}

module.exports = BrokerFactory;