const mongoose = require('mongoose');
const Match = require('../models/Match');
const EventEmitter = require('events');
const redis = require('redis');

// subscribers: matchId -> Set of res objects (SSE responses)
const subscribers = new Map();
let changeStream = null;
const emitter = new EventEmitter();

// Redis pub/sub client (optional)
let redisPub = null;
let redisSub = null;
const REDIS_CHANNEL = process.env.REDIS_CHANNEL || 'match_changes_v1';

async function initRedis() {
  if (!process.env.REDIS_URL) return;
  if (redisPub) return;
  try {
    redisPub = redis.createClient({ url: process.env.REDIS_URL });
    redisSub = redis.createClient({ url: process.env.REDIS_URL });
    redisPub.on('error', (e) => console.warn('[redis] pub error', e?.message || e));
    redisSub.on('error', (e) => console.warn('[redis] sub error', e?.message || e));
    await redisPub.connect();
    await redisSub.connect();
    await redisSub.subscribe(REDIS_CHANNEL, (message) => {
      try {
        const doc = JSON.parse(message);
        // broadcast to local subscribers
        broadcastToSubscribers(doc);
      } catch (e) {
        console.warn('[redis] invalid message', e?.message || e);
      }
    });
    console.log('[redis] pub/sub connected');
  } catch (e) {
    console.warn('[redis] could not connect:', e?.message || e);
    try { if (redisPub) await redisPub.disconnect(); } catch (e) {}
    try { if (redisSub) await redisSub.disconnect(); } catch (e) {}
    redisPub = redisSub = null;
  }
}

function subscribe(matchId, res) {
  const id = String(matchId);
  let set = subscribers.get(id);
  if (!set) {
    set = new Set();
    subscribers.set(id, set);
  }
  set.add(res);
}

function unsubscribe(matchId, res) {
  const id = String(matchId);
  const set = subscribers.get(id);
  if (!set) return;
  set.delete(res);
  if (!set.size) subscribers.delete(id);
}

function broadcastToSubscribers(doc) {
  if (!doc) return;
  const id = String(doc.match_id);
  const set = subscribers.get(id);
  if (!set) return;
  const payload = {
    match_id: doc.match_id,
    minute: doc.minute,
    added_time: doc.added_time,
    score: doc.score,
    events: doc.events,
    comments: doc.comments,
    match_status: doc.match_status,
    home_team: doc.home_team,
    away_team: doc.away_team,
  };
  for (const res of set) {
    try {
      res.write(`event: update\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (e) {
      // If write fails, assume client disconnected — remove subscriber and try to end response
      try {
        const addr = res?.req?.socket?.remoteAddress || res?.socket?.remoteAddress || 'unknown';
        console.warn('[sse] write failed to subscriber, removing. addr=', addr, e && e.message ? e.message : e);
      } catch (ee) {}
      try { set.delete(res); } catch (ee) {}
      try { res.end(); } catch (ee) {}
    }
  }
  // also publish to redis so other instances receive this change
  if (redisPub) {
    try {
      redisPub.publish(REDIS_CHANNEL, JSON.stringify(payload)).catch(() => {});
    } catch (e) { /* ignore */ }
  }
}

async function startChangeStream() {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    throw new Error('Mongoose not connected');
  }

  if (changeStream) return; // already running

  try {
    changeStream = Match.watch([
      { $match: { operationType: { $in: ['insert', 'update', 'replace'] } } },
    ], { fullDocument: 'updateLookup' });

    // try to init redis pub/sub if configured
    initRedis().catch(err => console.warn('[changeStream] redis init failed:', err?.message || err));

    changeStream.on('change', (change) => {
      const doc = change.fullDocument;
      if (!doc) return;
      // broadcast to subscribers for this match
      broadcastToSubscribers(doc);
      // emit for any other listeners
      emitter.emit('change', doc);
        // If match reached finished state, trigger report generation asynchronously
        try {
          const s = String(doc?.match_status?.state || doc?.status || '').toLowerCase();
          const isFinished = s === 'ft' || s === 'finished' || s.includes('fulltime') || s === 'f';
          // Only trigger when finished and reports not already present
          if (isFinished) {
            const hasReports = doc?.reports && ((doc.reports.home && doc.reports.away) || doc.reports.generated_at);
            if (!hasReports) {
              // debounce per-match to avoid duplicate generation from multiple change events
              if (!global.__autoReportLocks) global.__autoReportLocks = new Set();
              const lockKey = String(doc.match_id);
              if (global.__autoReportLocks.has(lockKey)) {
                // already working on this match
              } else {
                global.__autoReportLocks.add(lockKey);
                (async () => {
                  try {
                    // Ensure match is fully synced (lineup/ratings) before generating reports
                    try {
                      const { syncFinishedMatch } = require('../controllers/matchSyncController');
                      await syncFinishedMatch(doc.match_id, { forFinished: true });
                    } catch (e) {
                      console.warn('[changeStream] syncFinishedMatch failed (continuing to report gen):', e?.message || e);
                    }

                    const { generateBothReports } = require('../controllers/reportController');
                    await generateBothReports(doc.match_id);
                    console.log('[changeStream] auto-generated reports for', doc.match_id);
                  } catch (e) {
                    console.warn('[changeStream] auto-generate reports failed for', doc.match_id, e?.message || e);
                  } finally {
                    // release lock after short delay to allow further updates to be handled later
                    setTimeout(() => global.__autoReportLocks.delete(lockKey), 60 * 1000);
                  }
                })();
              }
            }
          }
        } catch (e) {
          console.warn('[changeStream] report trigger check failed', e?.message || e);
        }
    });

    changeStream.on('error', (err) => {
      console.error('[changeStream] error', err);
      try {
        changeStream.close();
      } catch (e) {}
      changeStream = null;
      // consumers can decide how to fallback; we keep emitter for manual emits
    });

    console.log('[changeStream] started for Match collection');
  } catch (e) {
    // if change streams unsupported (e.g., standalone mongod), propagate
    changeStream = null;
    console.warn('[changeStream] could not start:', e.message || e);
    throw e;
  }
}

function stopChangeStream() {
  if (changeStream) {
    try { changeStream.close(); } catch (e) {}
    changeStream = null;
  }
  subscribers.clear();
}

function inspectStatus(matchId) {
  const id = String(matchId);
  const set = subscribers.get(id);
  return {
    changeStreamRunning: !!changeStream,
    subscriberCount: set ? set.size : 0
  };
}

module.exports = { subscribe, unsubscribe, startChangeStream, stopChangeStream, emitter, inspectStatus };
