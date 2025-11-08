// live/liveRefresher.js
const { syncFixtureInternal } = require('../controllers/syncController');

let handle = null;
const liveSet = new Set();
let lastRun = null;
// Default to 15000ms (15s) for liverefresh ticks to reduce live latency
let intervalMsCurrent = 15000;

async function tick() {
  lastRun = new Date();
  for (const id of Array.from(liveSet)) {
    try {
      await syncFixtureInternal(id);
    } catch (e) {
      console.error(`[live] sync failed for ${id}:`, e?.message || e);
    }
  }
}

function start(intervalMs = 15000) {
  if (handle) return { ok: true, message: 'already running', intervalMs: intervalMsCurrent };
  intervalMsCurrent = intervalMs;
  handle = setInterval(tick, intervalMs);
  console.log(`🔄 Live refresher started (${intervalMs}ms)`);
  // run an immediate tick so newly-started live refresher doesn't wait for the
  // first interval to elapse before fetching updates.
  tick().catch(e => console.error('[live] initial tick failed:', e?.message || e));
  return { ok: true, intervalMs: intervalMsCurrent };
}

function stop() {
  if (handle) {
    clearInterval(handle);
    handle = null;
    console.log('🛑 Live refresher stopped');
  }
  liveSet.clear();
  return { ok: true };
}

function status() {
  return {
    running: Boolean(handle),
    size: liveSet.size,
    intervalMs: intervalMsCurrent,
    lastRun,
    fixtureIds: Array.from(liveSet),
  };
}

function add(id) {
  liveSet.add(String(id));
  return status();
}

function remove(id) {
  liveSet.delete(String(id));
  return status();
}

module.exports = { start, stop, status, add, remove };
