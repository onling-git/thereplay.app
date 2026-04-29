// server.js
// Load environment-specific .env file
const environment = process.env.NODE_ENV || 'local';
const path = require('path');
const envFile = environment === 'production' ? '.env.production' 
  : environment === 'staging' ? '.env.staging'
  : environment === 'local' ? '.env.local'
  : '.env';

require('dotenv').config({ path: path.join(__dirname, envFile) });

console.log(`[server] Starting in ${environment} mode, using ${envFile}`);
console.log(`[server] Database: ${process.env.DBURI?.split('@')[1]?.split('?')[0] || 'unknown'}`);

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const session = require('express-session');

const { connectDB, closeDB } = require('./db/connect');
const swaggerUi = require('swagger-ui-express');
const { openapiSpec } = require('./docs/openapi');
const requireApiKey = require('./middleware/apiKey')();


const app = express();

// Trust proxy - required for Railway and other reverse proxy environments
// Use more specific trust proxy setting for better security
app.set('trust proxy', 1);

// --- CORS middleware (must be first) ---
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://localhost:3000',
    'https://virtuous-exploration-production.up.railway.app',
    'https://thereplay.app',
    'https://www.thereplay.app',
    'http://thereplay.app', // For development/testing
    'http://www.thereplay.app' // For development/testing
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
};

app.use(cors(corsOptions));
// Handle preflight requests for all routes
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    cors(corsOptions)(req, res, next);
  } else {
    next();
  }
});

// --- other middleware ---
app.use(express.json());
app.use(helmet());
app.use(morgan('tiny'));

// Session middleware for anonymous user preferences
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// --- sensitive routes limiter (before mounts) ---
const adminLimiter = rateLimit({
  windowMs: 60_000,
  max: 1000,
  message: { error: 'Rate limit exceeded. Try again shortly.' },
});


app.use('/api/sync', adminLimiter);
app.use('/api/reports', adminLimiter);

// --- health ---
app.get('/health', (_req, res) => {
  console.log('[health] Health check requested');
  res.json({ ok: true, service: 'api', env: process.env.NODE_ENV || 'dev', timestamp: new Date().toISOString() });
});
app.get('/api/health', (_req, res) => {
  console.log('[health] API health check requested');
  res.json({ ok: true, timestamp: new Date().toISOString() });
});
app.get('/healthz', (_req, res) => {
  console.log('[health] Healthz check requested');
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Add a super simple test endpoint
app.get('/test', (_req, res) => {
  console.log('[test] Test endpoint requested');
  res.json({ message: 'Railway is working!', timestamp: new Date().toISOString() });
});

// --- docs ---
// Allow docs JSON only if admin key present in production-ish environments
app.get('/api/openapi.json', requireApiKey, (_req, res) => res.json(openapiSpec));
app.use('/api/docs', requireApiKey, swaggerUi.serve, swaggerUi.setup(openapiSpec, {
  explorer: true,
  swaggerOptions: { persistAuthorization: true }
}));


// --- safe mount helper ---
function mount(path, file) {
  try {
    const router = require(file);
    app.use(path, router);
    console.log(`[routes] mounted ${path} -> ${file}`);
  } catch (err) {
    console.warn(`[routes] skipped ${path} (cannot load ${file}):`, err.message);
  }
}

function shouldCompress (req, res) {
  // don’t compress SSE
  if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
    return false;
  }
  return compression.filter(req, res);
}

app.use(compression({ filter: shouldCompress }));

// --- routes (excluding subscription routes that depend on DB) ---
mount('/api/sync/catalog', './routes/syncCatalogRoutes');
mount('/api/reports',       './routes/reportRoutes');
mount('/api/reports/v2',    './routes/reportsV2'); // NEW: 2-step pipeline reports
mount('/api/reports',       './routes/reportRssRoutes'); // Match reports RSS feeds
mount('/api/sync',          './routes/syncRoutes');
mount('/api/sync',          './routes/syncOrchestratorRoutes');
mount('/api/admin',         './routes/adminRoutes');
mount('/api/admin/teams',   './routes/adminTeamRoutes'); // Team admin endpoints
mount('/api/admin/rss',     './routes/adminRssRoutes'); // RSS admin endpoints
mount('/api/admin/team-feeds', './routes/adminTeamFeedRoutes'); // Team-feed subscriptions
mount('/api/admin/twitter', './routes/adminTwitterRoutes'); // Twitter admin endpoints
mount('/api/live',          './routes/liveRoutes');
mount('/api/teams',         './routes/teamNewsRoutes'); // Team news with RSS
mount('/api/teams/cache',   './routes/teamCacheRoutes'); // Mount before general teams routes
mount('/api/teams',         './routes/teamRoutes');
mount('/api/leagues',       './routes/leaguesRoutes');
mount('/api/fixtures',      './routes/fixturesRoutes');
mount('/api/countries',     './routes/countriesRoutes');
mount('/api/news',          './routes/newsRoutes');
mount('/api/rss-feeds',     './routes/rssFeedRoutes');
mount('/api/users',         './routes/userRoutes'); // User authentication and account management
mount('/api/favorites',     './routes/favoriteMatchRoutes'); // Favorite matches functionality
mount('/api/tweets',        './routes/tweetRoutes'); // Twitter/social media integration
mount('/api/privacy',       './routes/privacyRoutes'); // Privacy and cookie consent
mount('/api/standings',     './routes/standingsRoutes'); // League standings
mount('/api/cups',          './routes/cupRoutes'); // Cup competitions
// Note: subscription routes mounted after DB connection
mount('/api/debug',         './routes/debugRoutes');
mount('/api/stream',        './routes/streamRoutes');
mount('/api/debug-local',   './routes/debugLocalRoutes');
mount('/api/overview',      './routes/overviewRoutes');
mount('/api',               './routes/matchRoutes'); // keep last

// Note: 404 handler moved to after subscription routes are mounted

// --- start ---
const PORT = process.env.PORT || 8000;

function validateEnv() {
  if (!process.env.DBURI) {
    console.warn('[startup] Warning: DBURI is not set. Server will fail to connect to DB.');
  }
  if (!process.env.ADMIN_API_KEY) {
    console.warn('[startup] Warning: ADMIN_API_KEY is not set. Admin routes/docs will be unprotected.');
  }
}

let server;
let cronStopper = null;

console.log('[debug] About to start async IIFE...');
console.log('[debug] Environment variables:');
console.log('[debug] - PORT:', process.env.PORT || 'not set (will use 8000)');
console.log('[debug] - NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('[debug] - DBURI:', process.env.DBURI ? 'set' : 'NOT SET');

(async () => {
  try {
    console.log('[startup] Starting server initialization...');
    validateEnv();

    console.log('[startup] Attempting database connection...');
    if (!process.env.DBURI) {
      throw new Error('DBURI environment variable is not set');
    }
    await connectDB(process.env.DBURI);
    console.log('[startup] ✅ Database connected successfully');

    // Mount subscription routes after DB connection (they depend on User model with indexes)
    mount('/api/subscription', './routes/subscriptionRoutes'); // Stripe subscription management

    // Set up 404 handler after all routes are mounted
    app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.originalUrl }));

    // Start change stream broadcaster so SSE clients get near-instant pushes (optional)
    try {
      const { startChangeStream } = require('./live/changeStreamBroadcaster');
      startChangeStream().catch(err => console.warn('[changeStream] failed to start on boot:', err?.message || err));
    } catch (e) {
      console.warn('[changeStream] broadcaster require failed:', e?.message || e);
    }

    console.log('[startup] Starting HTTP server...');
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[startup] ✅ Server is listening on port ${PORT}...`);
      console.log('[startup] 🚀 Application startup complete!');
    });
    
    server.on('error', (err) => {
      console.error('[server] Server error:', err);
      throw err;
    });
    
    // Disable automatic server socket timeout so long-lived SSE connections aren't abruptly closed by Node.
    try {
      server.timeout = 0; // 0 = no timeout
      console.log('[server] disabled automatic server timeout for long-lived connections');
    } catch (e) {
      console.warn('[server] could not disable timeout:', e && e.message ? e.message : e);
    }

    // Start crons AFTER server is listening
    try {
      const cronModule = require('./cron/index');
      if (typeof cronModule.startCrons === 'function') {
        cronModule.startCrons();
        if (typeof cronModule.stopCrons === 'function') cronStopper = cronModule.stopCrons;
        console.log('[cron] Scheduler started.');
      } else {
        console.warn('[cron] startCrons not exported as a function. Skipping.');
      }
    } catch (e) {
      console.warn('[cron] not started (missing or failed import):', e.message);
    }
  } catch (err) {
    console.error('[startup] ❌ Failed to start server:', err);
    console.error('[startup] Error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    process.exit(1);
  }
})();

async function shutdown(signal) {
  console.log(`[shutdown] Received ${signal}. Closing server...`);
  try {
    if (server && typeof server.close === 'function') {
      await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
      console.log('[shutdown] HTTP server closed');
    }
  } catch (err) {
    console.warn('[shutdown] Error closing HTTP server:', err?.message || err);
  }

  try {
    if (typeof cronStopper === 'function') {
      await cronStopper();
      console.log('[shutdown] Crons stopped');
    }
  } catch (err) {
    console.warn('[shutdown] Error stopping crons:', err?.message || err);
  }

  try {
    await closeDB();
  } catch (err) {
    // closeDB already logs, ignore here
  }

  console.log('[shutdown] Exiting process');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;

