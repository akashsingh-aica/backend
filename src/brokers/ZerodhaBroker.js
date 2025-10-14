const KiteConnect = require('kiteconnect').KiteConnect;
const KiteTicker = require('kiteconnect').KiteTicker;
const BaseBroker = require('./BaseBroker');

class ZerodhaBroker extends BaseBroker {
    constructor(config) {
        super(config);
        this.kc = new KiteConnect({
            api_key: config.apiKey
        });
        this.ticker = null;
        this.accessToken = null;
        this.subscribedInstruments = new Set();
    }

    async connect() {
        try {
            if (!this.accessToken) {
                throw new Error('Access token not set. Please authenticate first.');
            }
            
            this.kc.setAccessToken(this.accessToken);
            
            // Test connection by getting user profile
            const profile = await this.kc.getProfile();
            this.isConnected = true;
            
            console.log('Zerodha broker connected successfully');
            return { success: true, profile };
        } catch (error) {
            this.isConnected = false;
            throw new Error(`Failed to connect to Zerodha: ${error.message}`);
        }
    }

    async disconnect() {
        try {
            if (this.ticker) {
                this.ticker.disconnect();
                this.ticker = null;
            }
            
            this.isConnected = false;
            this.accessToken = null;
            console.log('Zerodha broker disconnected successfully');
            
            return { success: true };
        } catch (error) {
            throw new Error(`Failed to disconnect from Zerodha: ${error.message}`);
        }
    }

    setAccessToken(accessToken) {
        this.accessToken = accessToken;
        this.kc.setAccessToken(accessToken);
    }

    getLoginUrl() {
        return this.kc.getLoginURL();
    }

    async generateSession(requestToken) {
        try {
            const response = await this.kc.generateSession(requestToken, this.config.apiSecret);
            this.accessToken = response.access_token;
            this.kc.setAccessToken(this.accessToken);
            return response;
        } catch (error) {
            throw new Error(`Failed to generate session: ${error.message}`);
        }
    }

    async getProfile() {
        this._ensureConnected();
        try {
            return await this.kc.getProfile();
        } catch (error) {
            throw new Error(`Failed to get profile: ${error.message}`);
        }
    }

    async getPositions() {
        this._ensureConnected();
        try {
            return await this.kc.getPositions();
        } catch (error) {
            throw new Error(`Failed to get positions: ${error.message}`);
        }
    }

    async getHoldings() {
        this._ensureConnected();
        try {
            return await this.kc.getHoldings();
        } catch (error) {
            throw new Error(`Failed to get holdings: ${error.message}`);
        }
    }

    async placeOrder(orderParams) {
        this._ensureConnected();
        try {
            return await this.kc.placeOrder(orderParams.variety, orderParams);
        } catch (error) {
            throw new Error(`Failed to place order: ${error.message}`);
        }
    }

    async getOrders() {
        this._ensureConnected();
        try {
            return await this.kc.getOrders();
        } catch (error) {
            throw new Error(`Failed to get orders: ${error.message}`);
        }
    }

    async getInstruments(exchange = null) {
        this._ensureConnected();
        try {
            return await this.kc.getInstruments(exchange);
        } catch (error) {
            throw new Error(`Failed to get instruments: ${error.message}`);
        }
    }

    async connectWebSocket() {
        if (!this.accessToken) {
            throw new Error('Access token not set for WebSocket connection');
        }

        try {
            this.ticker = new KiteTicker({
                api_key: this.config.apiKey,
                access_token: this.accessToken
            });

            // Set up event handlers
            this.ticker.on('ticks', (ticks) => {
                this._handleTicks(ticks);
            });

            this.ticker.on('connect', () => {
                console.log('WebSocket connected to Zerodha');
            });

            this.ticker.on('disconnect', () => {
                console.log('WebSocket disconnected from Zerodha');
            });

            this.ticker.on('error', (error) => {
                console.error('WebSocket error:', error);
            });

            this.ticker.on('close', () => {
                console.log('WebSocket connection closed');
            });

            // Connect to WebSocket
            this.ticker.connect();
            
            return { success: true };
        } catch (error) {
            throw new Error(`Failed to connect WebSocket: ${error.message}`);
        }
    }

    async subscribeToTicker(instruments) {
        if (!this.ticker) {
            throw new Error('WebSocket not connected');
        }

        try {
            // Convert instruments to array if it's a single instrument
            const instrumentsArray = Array.isArray(instruments) ? instruments : [instruments];
            
            // Subscribe to instruments
            this.ticker.subscribe(instrumentsArray);
            
            // Set mode to quote for detailed data
            this.ticker.setMode(this.ticker.modeLTP, instrumentsArray);
            
            // Add to subscribed instruments set
            instrumentsArray.forEach(instrument => {
                this.subscribedInstruments.add(instrument);
            });
            
            console.log(`Subscribed to instruments: ${instrumentsArray.join(', ')}`);
            return { success: true, instruments: instrumentsArray };
        } catch (error) {
            throw new Error(`Failed to subscribe to ticker: ${error.message}`);
        }
    }

    async unsubscribeFromTicker(instruments) {
        if (!this.ticker) {
            throw new Error('WebSocket not connected');
        }

        try {
            const instrumentsArray = Array.isArray(instruments) ? instruments : [instruments];
            
            this.ticker.unsubscribe(instrumentsArray);
            
            // Remove from subscribed instruments set
            instrumentsArray.forEach(instrument => {
                this.subscribedInstruments.delete(instrument);
            });
            
            console.log(`Unsubscribed from instruments: ${instrumentsArray.join(', ')}`);
            return { success: true, instruments: instrumentsArray };
        } catch (error) {
            throw new Error(`Failed to unsubscribe from ticker: ${error.message}`);
        }
    }

    getSubscribedInstruments() {
        return Array.from(this.subscribedInstruments);
    }

    _handleTicks(ticks) {
        // Emit ticks for subscribers (can be extended with EventEmitter pattern)
        console.log('Received ticks:', ticks.length);
        // You can add custom logic here to process ticks
        // For example, save to database, emit to websocket clients, etc.
    }

    _ensureConnected() {
        if (!this.isConnected || !this.accessToken) {
            throw new Error('Broker not connected. Please authenticate first.');
        }
    }
}

module.exports = ZerodhaBroker;