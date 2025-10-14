// server.js
// Fastify + Zerodha (Kite Connect) data backend with:
// 1) Token store abstraction (dev: file; prod: Redis placeholder)
// 2) Symbol -> instrument_token helper (instruments cache + refresh endpoint)
// 3) WebSocket ticker starter (KiteTicker) you can extend to broadcast to clients
//
// .env example:
// PORT=3000
// NODE_ENV=development
// KITE_API_KEY=your_api_key
// KITE_API_SECRET=your_api_secret
// KITE_REDIRECT_URL=http://localhost:3000/auth/callback
// # For future prod Redis (TODO):
// REDIS_URL=redis://localhost:6379

import Fastify from 'fastify';
import { config } from 'dotenv';
import { KiteConnect, KiteTicker } from 'kiteconnect';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// import Redis from 'ioredis'; // <-- TODO: uncomment when wiring Redis for production

config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({ logger: true });

const {
  PORT = 3000,
  NODE_ENV = 'development',
  KITE_API_KEY,
  KITE_API_SECRET,
  KITE_REDIRECT_URL,
  // REDIS_URL, // <-- TODO: use in production
} = process.env;

if (!KITE_API_KEY || !KITE_API_SECRET || !KITE_REDIRECT_URL) {
  app.log.warn('[env] Missing KITE_API_* or KITE_REDIRECT_URL. Check your .env.');
}

/* -------------------------------------------------------------------------- */
/*                               TOKEN STORE                                   */
/* -------------------------------------------------------------------------- */

// Single logical key that documents env backends:
const TOKEN_KEY = 'token:{development:file, production:redis}';

class TokenStore {
  constructor(env = 'development') {
    this.env = env;
    this.filePath = path.join(__dirname, '.kite_token');
    // this.redis = env === 'production' ? new Redis(REDIS_URL) : null; // <-- TODO (prod)
  }

  async get() {
    if (this.env === 'production') {
      // TODO(prod): return await this.redis.get(TOKEN_KEY);
      // Fallback to file while Redis is not wired:
      return this.#getFromFile();
    }
    return this.#getFromFile();
  }

  async set(value) {
    if (this.env === 'production') {
      // TODO(prod): await this.redis.set(TOKEN_KEY, value);
      await this.#setToFile(value); // temporary fallback
      return;
    }
    await this.#setToFile(value);
  }

  #getFromFile() {
    try {
      return fs.readFileSync(this.filePath, 'utf8').trim();
    } catch {
      return '';
    }
  }

  async #setToFile(value) {
    await fs.promises.writeFile(this.filePath, value ?? '', 'utf8');
  }
}

const tokenStore = new TokenStore(NODE_ENV);
let ACCESS_TOKEN = await tokenStore.get();

/* -------------------------------------------------------------------------- */
/*                          KITE CLIENT + SMALL HELPERS                        */
/* -------------------------------------------------------------------------- */

function kite() {
  const kc = new KiteConnect({ api_key: KITE_API_KEY });
  if (ACCESS_TOKEN) kc.setAccessToken(ACCESS_TOKEN);
  return kc;
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

/* -------------------------------------------------------------------------- */
/*                       INSTRUMENTS CACHE + LOOKUP MAP                        */
/* -------------------------------------------------------------------------- */

const INSTRUMENTS_FILE = path.join(__dirname, '.instruments.json');
// Map key: "EXCHANGE:TRADINGSYMBOL" -> instrument_token (number)
let instrumentsMap = new Map();

function normalizeSymbol(sym) {
  // Accept "NSE:RELIANCE" or "RELIANCE" (defaults to NSE)
  if (!sym) return '';
  return sym.includes(':') ? sym.trim().toUpperCase() : `NSE:${sym.trim().toUpperCase()}`;
}

function buildMap(list) {
  const m = new Map();
  for (const row of list) {
    // row fields include: exchange, tradingsymbol, instrument_token, name, etc.
    const key = `${row.exchange}:${row.tradingsymbol}`.toUpperCase();
    m.set(key, row.instrument_token);
  }
  return m;
}

function loadInstrumentsFromDisk() {
  try {
    const raw = fs.readFileSync(INSTRUMENTS_FILE, 'utf8');
    const arr = JSON.parse(raw);
    instrumentsMap = buildMap(arr);
    app.log.info(`[instruments] Loaded ${instrumentsMap.size} from disk`);
  } catch {
    // ignore
  }
}

async function refreshInstruments() {
  const kc = kite();
  app.log.info('[instruments] Fetching instruments from Zerodha...');
  const list = await kc.getInstruments(); // returns big array
  instrumentsMap = buildMap(list);
  await fs.promises.writeFile(INSTRUMENTS_FILE, JSON.stringify(list, null, 2), 'utf8');
  app.log.info(`[instruments] Cached ${instrumentsMap.size} instruments to disk`);
}

function symbolToToken(symbolLike) {
  if (!instrumentsMap.size) loadInstrumentsFromDisk();
  const key = normalizeSymbol(symbolLike);
  return instrumentsMap.get(key); // may be undefined if not found
}

/* -------------------------------------------------------------------------- */
/*                             KITE TICKER (WS)                                */
/* -------------------------------------------------------------------------- */

let ticker = null;
const SUBSCRIBED = new Set(); // instrument_token numbers we want
let TICKER_READY = false;

function ensureTicker() {
  if (ticker) return ticker;
  if (!ACCESS_TOKEN) {
    app.log.warn('[ws] No ACCESS_TOKEN yet. Login first.');
    return null;
  }
  ticker = new KiteTicker({ api_key: KITE_API_KEY, access_token: ACCESS_TOKEN });

  ticker.on('connect', () => {
    TICKER_READY = true;
    app.log.info('[ws] Ticker connected');
    const tokens = Array.from(SUBSCRIBED);
    if (tokens.length) {
      ticker.subscribe(tokens);
      ticker.setMode(ticker.modeFull, tokens);
      app.log.info(`[ws] Re-subscribed ${tokens.length} tokens`);
    }
  });

  ticker.on('ticks', (ticks) => {
    // For now, we just log. TODO: broadcast via SSE/WebSocket to your clients.
    app.log.debug({ ticks }, '[ws] ticks');
  });

  ticker.on('error', (err) => app.log.error({ err }, '[ws] error'));
  ticker.on('close', () => {
    TICKER_READY = false;
    app.log.warn('[ws] Ticker connection closed');
  });

  ticker.connect();
  return ticker;
}

/* -------------------------------------------------------------------------- */
/*                                   ROUTES                                    */
/* -------------------------------------------------------------------------- */

app.get('/health', async () => ({ ok: true, env: NODE_ENV }));

// 1) Redirect user to Zerodha login
app.get('/auth/login', async (_, reply) => {
  const url = `https://kite.zerodha.com/connect/login?v=3&api_key=${KITE_API_KEY}`;
  reply.redirect(url);
});

// 2) Callback: exchange request_token -> access_token
app.get('/auth/callback', async (req, reply) => {
  const { request_token } = req.query;
  if (!request_token) return reply.code(400).send({ error: 'Missing request_token' });

  // checksum = sha256(api_key + request_token + api_secret)
  const checksum = sha256(`${KITE_API_KEY}${request_token}${KITE_API_SECRET}`);

  try {
    const kc = kite();
    const { access_token } = await kc.generateSession(request_token, KITE_API_SECRET, checksum);
    ACCESS_TOKEN = access_token;
    await tokenStore.set(access_token);
    app.log.info('[auth] Access token stored via TokenStore');

    // Kick/restart WS after auth
    if (ticker) {
      try { ticker.disconnect(); } catch {}
      ticker = null;
      TICKER_READY = false;
    }
    ensureTicker();

    return reply.send({ ok: true, access_token });
  } catch (err) {
    req.log.error(err, '[auth] Token exchange failed');
    return reply.code(500).send({ error: 'Token exchange failed', details: String(err) });
  }
});

// Who am I?
app.get('/api/profile', async (req, reply) => {
  if (!ACCESS_TOKEN) return reply.code(401).send({ error: 'Login first at /auth/login' });
  const kc = kite();
  const profile = await kc.getProfile();
  reply.send(profile);
});

// Quotes: ?i=NSE:RELIANCE&i=NSE:INFY (accepts multiple)
// NOTE: getQuote accepts exchange:symbol strings, so we forward as-is.
app.get('/api/quote', async (req, reply) => {
  if (!ACCESS_TOKEN) return reply.code(401).send({ error: 'Login first' });
  const { i } = req.query;
  const instruments = Array.isArray(i) ? i : [i].filter(Boolean);
  if (!instruments.length) return reply.code(400).send({ error: 'Pass ?i=EXCHANGE:TRADINGSYMBOL' });
  const kc = kite();
  const data = await kc.getQuote(instruments.map(normalizeSymbol));
  reply.send(data);
});

// Historical candles (requires instrument_token)
app.get('/api/historical', async (req, reply) => {
  if (!ACCESS_TOKEN) return reply.code(401).send({ error: 'Login first' });

  const { symbol, i, from, to, interval = 'day' } = req.query;
  // allow either ?symbol=NSE:RELIANCE OR ?i=738561
  let token = i ? Number(i) : symbolToToken(symbol);
  if (!token) return reply.code(400).send({ error: 'Provide ?symbol=EXCHANGE:TRADINGSYMBOL or ?i=instrument_token' });
  if (!from || !to) return reply.code(400).send({ error: 'Need from & to (YYYY-MM-DD)' });

  const kc = kite();
  const data = await kc.getHistoricalData(token, from, to, interval);
  reply.send(data);
});

// Refresh instruments cache from Zerodha (heavy; call sparingly)
app.post('/api/instruments/refresh', async (req, reply) => {
  if (!ACCESS_TOKEN) return reply.code(401).send({ error: 'Login first' });
  await refreshInstruments();
  reply.send({ ok: true, size: instrumentsMap.size });
});

// Lookup: symbol -> instrument_token
app.get('/api/instruments/lookup', async (req, reply) => {
  const { symbol } = req.query;
  if (!symbol) return reply.code(400).send({ error: 'Pass ?symbol=EXCHANGE:TRADINGSYMBOL' });
  const token = symbolToToken(symbol);
  if (!token) return reply.code(404).send({ error: 'Symbol not found. Try POST /api/instruments/refresh then retry.' });
  reply.send({ symbol: normalizeSymbol(symbol), instrument_token: token });
});

// WS subscribe starter (server-side ticker)
// body: { symbols: ["NSE:RELIANCE","NSE:INFY"] } OR { tokens: [738561, ...] }
app.post('/ws/subscribe', async (req, reply) => {
  if (!ACCESS_TOKEN) return reply.code(401).send({ error: 'Login first' });

  const { symbols = [], tokens = [] } = req.body || {};
  const resolved = [
    ...tokens.filter((t) => Number.isFinite(Number(t))).map((t) => Number(t)),
    ...symbols.map(symbolToToken).filter((t) => Number.isFinite(Number(t))),
  ];

  if (!resolved.length) {
    return reply.code(400).send({ error: 'Provide tokens or symbols' });
  }

  ensureTicker();
  if (!ticker) return reply.code(500).send({ error: 'Ticker not ready. Try again after auth.' });

  resolved.forEach((t) => SUBSCRIBED.add(t));
  if (TICKER_READY) {
    ticker.subscribe(resolved);
    ticker.setMode(ticker.modeFull, resolved);
  }
  // NOTE: Currently we only log incoming ticks.
  // TODO: Add a client-facing SSE/WS to forward these ticks to browsers.
  return reply.send({ ok: true, subscribed: Array.from(SUBSCRIBED) });
});

/* -------------------------------------------------------------------------- */
/*                                   BOOT                                      */
/* -------------------------------------------------------------------------- */

(async () => {
  // best effort: load instruments from disk early
  loadInstrumentsFromDisk();

  // try to start WS if we already have a token (dev convenience)
  if (ACCESS_TOKEN) ensureTicker();

  await app.listen({ port: Number(PORT) });
  app.log.info(`→ http://localhost:${PORT}`);
  app.log.info(`Login: http://localhost:${PORT}/auth/login`);
})();
