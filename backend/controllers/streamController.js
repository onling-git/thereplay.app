// controllers/streamController.js
const Match = require('../models/Match');
const policy = require('../services/coveragePolicy');
const { matchFilter, markMatch } = require('../utils/publicCoverage');
const { startChangeStream, subscribe, unsubscribe } = require('../live/changeStreamBroadcaster');

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
  let initial;
  try {
    initial = await policy.assertPublicMatch(matchId);
  } catch (error) {
    return res.status(error.statusCode || error.status || 503).json({ error: error.message });
  }
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
    const doc = markMatch(initial, await policy.getCoverage());
    send('init', stripForClient(doc));

    // If match already finished, send a final 'complete' event and close cleanly.
    try {
      const payload = stripForClient(doc);
      const finished = payload && (
        (payload.match_status && String(payload.match_status.state).toLowerCase() === 'finished') ||
        (payload.match_status && String(payload.match_status.short_name).toUpperCase() === 'FT')
      );
      if (finished) {
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

  // Keep change-stream delivery; check coverage before each public payload.
  try {
    await startChangeStream();
    subscribe(matchId, res, async () => {
      const scope = await policy.getCoverage();
      const current = await Match.findOne(await matchFilter({ match_id: matchId })).lean();
      return current ? stripForClient(markMatch(current, scope)) : null;
    });
    const heartbeat = setInterval(async () => {
      try {
        await policy.assertPublicMatch(matchId);
        res.write(':\n\n');
      } catch (error) {
        console.warn('[sse] Closing unavailable match stream:', error.message);
        clearInterval(heartbeat);
        unsubscribe(matchId, res);
        res.end();
      }
    }, 25000);
    res.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe(matchId, res);
    });
    return;
  } catch (error) {
    console.warn('[sse] Change stream unavailable; using covered polling:', error.message);
  }

  let pollingFallback = null;
  try {
    const heartbeat = setInterval(() => res.write(':\n\n'), 25000);
    let last = null;
    let polling = false;
    pollingFallback = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const scope = await policy.getCoverage();
        const doc = await Match.findOne(await matchFilter({ match_id: matchId })).lean();
        if (!doc) {
          clearInterval(pollingFallback);
          clearInterval(heartbeat);
          res.end();
          return;
        }
        const cur = stripForClient(markMatch(doc, scope));
        if (changed(last, cur)) {
          send('update', cur);
          last = cur;
        }
      } catch (dbErr) {
        console.warn('[sse] polling fallback DB error for', matchId, dbErr && dbErr.message ? dbErr.message : dbErr);
        clearInterval(pollingFallback);
        clearInterval(heartbeat);
        res.end();
      } finally {
        polling = false;
      }
    }, 2000);

    res.on('close', () => {
      clearInterval(pollingFallback);
      clearInterval(heartbeat);
      try { res.end(); } catch (e) {}
    });
    return;
  } catch (error) {
    res.end();
  }
};
