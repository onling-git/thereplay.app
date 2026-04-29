// controllers/streamController.js
const Match = require('../models/Match');
const { subscribe, unsubscribe, startChangeStream } = require('../live/changeStreamBroadcaster');

function stripForClient(m) {
  if (!m) return null;
  return {
    match_id: m.match_id,
    date: m.date,
    // provide legacy convenience fields derived from match_status for compatibility
    status: m.match_status?.name || m.match_status?.state || '',
    status_code: m.match_status?.short_name || m.match_status?.state || '',
    match_status: m.match_status || null,
    minute: m.minute,
    added_time: m.added_time,
    score: m.score,
    events: m.events,
    comments: m.comments || [],
    home_team: m.home_team,
    away_team: m.away_team,
    // Include full teams object for team_id and team_slug access
    teams: m.teams,
    // Include lineup data for lineups tab
    lineup: m.lineup,
    lineups: m.lineups,
    // Include statistics for stats tab
    statistics: m.statistics,
    // Include player ratings for lineup display
    player_ratings: m.player_ratings,
    // Include match info for additional context
    match_info: m.match_info,
  };
}
function changed(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

exports.streamMatch = async (req, res) => {
  const matchId = Number(req.params.matchId);
  if (!Number.isFinite(matchId)) {
    res.status(400).json({ error: 'matchId must be a number' });
    return;
  }
  console.log(`[sse] client connected for match ${matchId} from ${req.ip || req.connection?.remoteAddress || 'unknown'}`);
  // log response errors (for example: client network reset)
  res.on && res.on('error', (err) => {
    console.warn('[sse] response error:', err && err.message ? err.message : err);
  });

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // send initial snapshot from DB
  try {
    const doc = await Match.findOne({ match_id: matchId }).lean();
  send('init', stripForClient(doc));
    console.log(`[sse] sent initial snapshot for match ${matchId}`);

    // If match already finished, send a final 'complete' event and close cleanly.
    try {
      const payload = stripForClient(doc);
      const finished = payload && (
        (payload.match_status && String(payload.match_status.state).toLowerCase() === 'finished') ||
        (payload.match_status && String(payload.match_status.short_name).toUpperCase() === 'FT')
      );
      if (finished) {
        console.log(`[sse] match ${matchId} is finished; sending 'complete' and closing connection`);
        send('complete', payload);
        try { res.end(); } catch (e) {}
        return;
      }
    } catch (e) {
      console.warn('[sse] error while checking finished state:', e && e.message ? e.message : e);
    }
  } catch {
    console.warn(`[sse] failed to load initial match ${matchId}`);
    send('error', { message: 'Failed to load initial match' });
  }

  // try to ensure change stream is started (no-op if already running)
  let pollingFallback = null;
  try {
    await startChangeStream();
    // subscribe this client to receive updates pushed from the change stream
    subscribe(matchId, res);
    console.log(`[sse] subscribed client for match ${matchId}`);
  } catch (e) {
    // if change streams not available, fall back to polling per-client
    console.warn('[sse] startChangeStream/subscribe failed:', e && e.message ? e.message : e);
    const heartbeat = setInterval(() => res.write(':\n\n'), 25000);
    let last = null;
    pollingFallback = setInterval(async () => {
      try {
        const doc = await Match.findOne({ match_id: matchId }).lean();
        const cur = stripForClient(doc);
        if (changed(last, cur)) {
          send('update', cur);
          last = cur;
        }
      } catch (dbErr) {
        console.warn('[sse] polling fallback DB error for', matchId, dbErr && dbErr.message ? dbErr.message : dbErr);
      }
    }, 2000);

    req.on('close', () => {
      console.log(`[sse] client closed connection (polling fallback) for match ${matchId}`);
      clearInterval(pollingFallback);
      clearInterval(heartbeat);
      try { res.end(); } catch (e) {}
    });
    return;
  }

  // heartbeat to keep proxies alive
  const heartbeat = setInterval(() => res.write(':\n\n'), 25000);

  req.on('close', () => {
    console.log(`[sse] client connection closed for match ${matchId}`);
    try { unsubscribe(matchId, res); } catch (e) { console.warn('[sse] unsubscribe error:', e && e.message ? e.message : e); }
    clearInterval(heartbeat);
    try { res.end(); } catch (e) {}
  });
};
