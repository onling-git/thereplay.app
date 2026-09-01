const { mergeComments } = require('./comments');

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeType(value) {
  return String(value || '').toLowerCase().replace(/[\s_-]/g, '');
}

function textForComment(comment) {
  return String(comment?.comment || comment?.comment_text || '').trim();
}

function sideForEvent(event, match) {
  const team = normalizeText(event.team || event.team_name || event.participant_id);
  const homeId = String(match.teams?.home?.team_id || match.home_team_id || '');
  const awayId = String(match.teams?.away?.team_id || match.away_team_id || '');
  if (team === 'home' || team === homeId || team === normalizeText(match.home_team)) return 'home';
  if (team === 'away' || team === awayId || team === normalizeText(match.away_team)) return 'away';
  return null;
}

function typeKeywords(eventType) {
  const type = normalizeType(eventType);
  if (type === 'goal') return ['goal', 'scores', 'scored', 'finish', 'finishes', 'finished'];
  if (type === 'penalty') return ['penalty', 'spot-kick', 'spot kick'];
  if (type === 'substitution') return ['substitute', 'substitution', 'comes on', 'replaces', 'is on'];
  if (type === 'yellowredcard' || type === 'redcard') return ['second yellow', 'yellow/red', 'sent off', 'red card', 'dismissed'];
  if (type === 'yellowcard') return ['yellow card', 'booked', 'caution'];
  return [];
}

function commentIsUnsafe(text) {
  const normalized = normalizeText(text);
  return !normalized ||
    /penalty shootout|shoot-out|shootout/.test(normalized) ||
    /match ends|game finishes|full-time|full time/.test(normalized);
}

function commentContradictsEvent(text, event, match) {
  const normalized = normalizeText(text);
  const eventType = normalizeType(event.type);
  if (eventType === 'penalty' && /shootout|shoot-out/.test(normalized)) return true;
  if (event.result && /\b\d+\s*[-:]\s*\d+\b/.test(normalized) && !normalized.includes(String(event.result).replace('-', '-'))) {
    const score = normalized.match(/\b\d+\s*[-:]\s*\d+\b/)?.[0]?.replace(/\s|:/g, '');
    if (score && score !== String(event.result)) return true;
  }
  const side = sideForEvent(event, match);
  const scorer = normalizeText(event.player_name || event.player);
  if ((eventType === 'goal' || eventType === 'penalty') && scorer && !normalized.includes(scorer)) {
    return true;
  }
  if (side === 'home' && normalized.includes('away lead') && eventType === 'goal') return true;
  return false;
}

function matchCommentToEvent(comment, events, match) {
  const text = textForComment(comment);
  const normalized = normalizeText(text);
  const minute = Number(comment?.minute);
  if (commentIsUnsafe(text) || !Number.isFinite(minute)) return null;

  const candidates = toArray(events)
    .filter(event => event.rescinded !== true)
    .map(event => {
      const eventMinute = Number(event.minute);
      if (!Number.isFinite(eventMinute) || Math.abs(eventMinute - minute) > 2) return null;
      const player = normalizeText(event.player_name || event.player);
      const relatedPlayer = normalizeText(event.related_player_name || event.related_player);
      const keywords = typeKeywords(event.type);
      const playerMatch = player && normalized.includes(player);
      const relatedMatch = relatedPlayer && normalized.includes(relatedPlayer);
      const keywordMatches = keywords.filter(keyword => normalized.includes(keyword)).length;
      const exactMinute = eventMinute === minute;
      const score = (playerMatch ? 80 : 0) + (relatedMatch ? 35 : 0) + (keywordMatches * 45) + (exactMinute ? 20 : 5);
      return { event, score, playerMatch, keywordMatches, exactMinute };
    })
    .filter(Boolean)
    .filter(candidate => candidate.score >= 100)
    .filter(candidate => !commentContradictsEvent(text, candidate.event, match))
    .sort((first, second) => second.score - first.score);

  const best = candidates[0];
  if (!best || !best.playerMatch || best.keywordMatches === 0) return null;
  return best;
}

function dedupeComments(comments) {
  const merged = mergeComments([], comments);
  const seen = new Set();
  return merged.filter(comment => {
    const key = `${Number(comment?.minute) || 0}|${normalizeText(textForComment(comment))}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasLaterScoringContribution(event, events) {
  const playerId = String(event.player_id || '');
  const playerName = normalizeText(event.player_name || event.player);
  const minute = Number(event.minute);
  if (!playerId && !playerName) return false;

  return toArray(events).some(candidate => {
    const type = normalizeType(candidate.type);
    const candidateMinute = Number(candidate.minute);
    const isScoring = type === 'goal' || type === 'penalty';
    const isLater = Number.isFinite(candidateMinute) && Number.isFinite(minute) && candidateMinute > minute;
    const scorerMatches = playerId && String(candidate.player_id || '') === playerId ||
      playerName && normalizeText(candidate.player_name || candidate.player) === playerName;
    const assistMatches = playerId && String(candidate.related_player_id || '') === playerId ||
      playerName && normalizeText(candidate.related_player_name || candidate.related_player) === playerName;
    return isScoring && isLater && (scorerMatches || assistMatches);
  });
}

function reportRelevance(event, events) {
  const type = normalizeType(event.type);
  if (type === 'goal' || type === 'penalty') return 3;
  if (type === 'yellowredcard' || type === 'redcard') return 2;
  if (type === 'substitution' && hasLaterScoringContribution(event, events)) return 2;
  return 0;
}

function addsDetailBeyondEvent(text, event) {
  const normalized = normalizeText(text);
  const type = normalizeType(event.type);
  const detailSignals = [
    'behind the defence', 'through ball', 'splitting pass', 'under the goalkeeper',
    'volley', 'long-range', 'top corner', 'one-on-one', 'blocked', 'saved',
    'off the post', 'off the bar', 'mistake', 'deflection', 'cross', 'counter'
  ];

  if (type === 'substitution' || type === 'yellowredcard' || type === 'redcard') return true;
  return detailSignals.some(signal => normalized.includes(signal));
}

function buildCommentEvidence(match, options = {}) {
  const limit = options.limit || 6;
  const evidence = [];
  const usedEventIds = new Set();

  const matches = dedupeComments(match.comments)
    .map(comment => ({ comment, matchResult: matchCommentToEvent(comment, match.events, match) }))
    .filter(item => item.matchResult && reportRelevance(item.matchResult.event, match.events) > 0)
    .sort((first, second) => {
      const relevanceDiff = reportRelevance(second.matchResult.event, match.events) - reportRelevance(first.matchResult.event, match.events);
      return relevanceDiff || second.matchResult.score - first.matchResult.score;
    });

  for (const { comment, matchResult } of matches) {
    const eventId = String(matchResult.event.id || '');
    if (!eventId || usedEventIds.has(eventId)) continue;

    evidence.push({
      evidence_id: `provider_comment_${eventId}`,
      event_id: matchResult.event.id,
      event_type: normalizeType(matchResult.event.type),
      minute: matchResult.event.minute,
      extra_minute: matchResult.event.extra_minute || null,
      side: sideForEvent(matchResult.event, match),
      player: matchResult.event.player_name || matchResult.event.player || null,
      factual_detail: textForComment(comment),
      confidence: matchResult.score >= 170 ? 'high' : 'medium',
      match_basis: {
        player_match: matchResult.playerMatch,
        keyword_matches: matchResult.keywordMatches,
        exact_minute: matchResult.exactMinute
      },
      use_in_report: matchResult.score >= 170 &&
        reportRelevance(matchResult.event, match.events) >= 2 &&
        addsDetailBeyondEvent(textForComment(comment), matchResult.event)
    });
    usedEventIds.add(eventId);
    if (evidence.length >= limit) break;
  }

  return evidence;
}

module.exports = { buildCommentEvidence };
