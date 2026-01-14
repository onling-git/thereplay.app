// controllers/reportController.js
const Match = require('../models/Match');
const Team = require('../models/Team');
const Report = require('../models/Report');
const Tweet = require('../models/Tweet');
const { 
  generateMatchReportJsonLd, 
  extractMatchEventsForJsonLd, 
  generateKeywords 
} = require('../utils/jsonLdSchema');
const { 
  generateMatchReportJsonLd, 
  extractMatchEventsForJsonLd, 
  generateKeywords 
} = require('../utils/jsonLdSchema');

let openai = null;
try {
  // Newer openai usage: instantiate OpenAI client directly
  const OpenAI = require('openai');
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (e) {
  console.warn('[reportController] OpenAI client init failed:', e.message);
  openai = null;
}

// Helpers
function humanizeSlug(slug) {
  if (!slug) return null;
  return String(slug).replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

function slugifyName(name) {
  if (!name) return null;
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Normalize strings that represent null/empty from model output into real null
function normalizeNullableString(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    const low = t.toLowerCase();
    if (low === 'null' || low === 'none' || low === 'n/a' || low === 'nil') return null;
    return t;
  }
  return v;
}

// Pick MOM candidate based on DB ratings
function computeMomCandidate(playerRatings = []) {
  if (!playerRatings || !playerRatings.length) return null;
  const sorted = [...playerRatings].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return sorted[0].player;
}

// Pick MOM candidate for a specific team (prefer players whose rating.team matches teamName)
function computeMomCandidateForTeam(playerRatings = [], teamName, match = null) {
  if (!playerRatings || !playerRatings.length) return null;

  // 1) prefer ratings that explicitly list the team
  let byTeam = playerRatings.filter(r => r.team && String(r.team).toLowerCase() === String(teamName || '').toLowerCase());
  if (byTeam.length) {
    const sorted = [...byTeam].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return sorted[0].player;
  }

  // 2) if ratings don't have team, try to resolve using match.lineup (match should be a plain object)
  if (match && match.lineup) {
    const teamPlayers = new Set(((match.lineup.home || []).map(p => String(p.name || p.player || '').toLowerCase())).concat((match.lineup.away || []).map(p => String(p.name || p.player || '').toLowerCase())));
    // collect team-specific names
    const teamSide = String(teamName || '').toLowerCase();
    const sideList = (String(teamSide) === String(match.home_team_slug || '').toLowerCase() || String(teamName || '').toLowerCase() === String(match.home_team || '').toLowerCase()) ? (match.lineup.home || []) : (match.lineup.away || []);
    const sideNames = new Set((sideList || []).map(p => String(p.name || p.player || '').toLowerCase()));
    const bySide = playerRatings.filter(r => sideNames.has(String(r.player || '').toLowerCase()));
    if (bySide.length) {
      const sorted = [...bySide].sort((a, b) => (b.rating || 0) - (a.rating || 0));
      return sorted[0].player;
    }
  }

  // 3) fallback: no team-resolved ratings — return null to avoid cross-team selection
  return null;
}

// Find a numeric rating for a player name/id from match.player_ratings or match.lineup
function findRatingForPlayer(match, playerNameOrId) {
  if (!match) return null;
  const nameKey = playerNameOrId ? String(playerNameOrId).toLowerCase().trim() : null;
  // search player_ratings first (preferred)
  if (Array.isArray(match.player_ratings) && match.player_ratings.length) {
    for (const r of match.player_ratings) {
      const rName = (r.player || r.player_name || '').toString().toLowerCase();
      const pid = r.player_id || r.playerId || r.id || null;
      if ((nameKey && rName === nameKey) || (pid && String(pid) === String(playerNameOrId))) {
        const rating = (r.rating !== undefined && r.rating !== null && !isNaN(Number(r.rating))) ? Number(r.rating) : null;
        if (rating !== null) return rating;
      }
    }
  }
  // fallback: inspect match.lineup arrays
  // Consider both match.lineup (normalized) and match.lineups (raw) to find names/player_ids
  const lineupFromNested = (match.lineup && ((match.lineup.home || []).concat(match.lineup.away || []))) || [];
  const lineupRaw = Array.isArray(match.lineups) ? match.lineups.slice() : [];
  const lineupAll = lineupFromNested.concat(lineupRaw || []);
  if (Array.isArray(lineupAll) && lineupAll.length) {
    // 1) try direct match on player_name
    for (const p of lineupAll) {
      const pName = (p.player_name || p.name || p.player || '').toString().toLowerCase();
      if (nameKey && pName === nameKey) {
        const rating = (p.rating !== undefined && p.rating !== null && !isNaN(Number(p.rating))) ? Number(p.rating) : null;
        if (rating !== null) return rating;
        // if lineup has player_id, try to find rating in match.player_ratings by id
        const pid = p.player_id || p.playerId || p.id || null;
        if (pid && Array.isArray(match.player_ratings)) {
          const found = match.player_ratings.find(rr => rr.player_id && String(rr.player_id) === String(pid) && rr.rating !== undefined && rr.rating !== null && !isNaN(Number(rr.rating)));
          if (found) return Number(found.rating);
        }
      }
    }
    // 2) try matching by provided playerNameOrId if it's an id
    if (playerNameOrId && !isNaN(Number(playerNameOrId))) {
      const pidKey = String(playerNameOrId);
      // check player_ratings
      if (Array.isArray(match.player_ratings)) {
        const found = match.player_ratings.find(rr => rr.player_id && String(rr.player_id) === pidKey && rr.rating !== undefined && rr.rating !== null && !isNaN(Number(rr.rating)));
        if (found) return Number(found.rating);
      }
      // check lineup
      const foundLine = lineupAll.find(p => (p.player_id && String(p.player_id) === pidKey));
      if (foundLine) {
        const rating = (foundLine.rating !== undefined && foundLine.rating !== null && !isNaN(Number(foundLine.rating))) ? Number(foundLine.rating) : null;
        if (rating !== null) return rating;
      }
    }
  }
  return null;
}

// Compute POTM for home and away by sorting provider ratings globally and picking highest-rated per team
function computePotmFromRatings(match) {
  const ratings = Array.isArray(match.player_ratings) ? match.player_ratings.slice() : [];
  const homeId = match.home_team_id ?? match.homeId ?? (match.teams && match.teams.home && match.teams.home.team_id) ?? null;
  const awayId = match.away_team_id ?? match.awayId ?? (match.teams && match.teams.away && match.teams.away.team_id) ?? null;
  // Build a quick lookup from match.lineup (if present) so we can resolve player names by id
  const lineupMap = {};
  if (match && match.lineup) {
    const allPlayers = (match.lineup.home || []).concat(match.lineup.away || []);
    for (const p of allPlayers) {
      if (!p) continue;
      const id = (p.player_id ?? p.playerId ?? p.id);
      if (id !== undefined && id !== null) lineupMap[String(id)] = p.player_name || p.name || p.player || null;
    }
  }

  // Helper to normalise name and rating from provider shapes. If the rating item lacks a name
  // but has a player_id that exists in the lineup, prefer the lineup's player_name so shapes match.
  const normalise = (r) => {
    if (!r) return null;
    let name = r.player || r.player_name || r.name || r.playerName || null;
    const ratingRaw = (r.rating !== undefined && r.rating !== null) ? r.rating : (r.value !== undefined && r.value !== null ? r.value : null);
    const rating = (ratingRaw !== null && !isNaN(Number(ratingRaw))) ? Number(ratingRaw) : null;
    const team = r.team_id ?? r.teamId ?? null;
    const player_id = r.player_id || r.playerId || r.id || null;
    // if no name on the rating object, try to resolve from the lineup map using player_id
    if ((!name || String(name).trim() === '') && player_id && lineupMap[String(player_id)]) {
      name = lineupMap[String(player_id)];
    }
    return { name, rating, team, player_id };
  };

  // sort by numeric rating descending, treating null/NaN as -Infinity so they fall to the end
  const numeric = ratings.slice().map(r => ({ raw: r, norm: normalise(r) })).filter(x => x.norm && x.norm.rating !== null).sort((a,b) => (b.norm.rating - a.norm.rating));
  const result = { home: { player: null, rating: null, reason: null }, away: { player: null, rating: null, reason: null } };

  // fast path: pick first matching team entry for each side
  for (const entry of numeric) {
    const r = entry.raw;
    const norm = entry.norm;
    
    if (norm.team !== undefined && norm.team !== null) {
      if (result.home.player === null && String(norm.team) === String(homeId)) {
        result.home = { player: norm.name || null, rating: norm.rating, reason: norm.rating !== null ? `Highest rating (${norm.rating})` : null };
      }
      if (result.away.player === null && String(norm.team) === String(awayId)) {
        result.away = { player: norm.name || null, rating: norm.rating, reason: norm.rating !== null ? `Highest rating (${norm.rating})` : null };
      }
    }
    if (result.home.player !== null && result.away.player !== null) break;
  }

  // If either side is still missing a name but we have a rating, try to resolve the player name from match.lineup by player_id or matching rating
  const resolveFromLineup = (teamSide, sideId) => {
    if (!match.lineup) return;
    const all = (match.lineup.home || []).concat(match.lineup.away || []);
    // try by player_id
    if (sideId && Array.isArray(ratings)) {
      for (const r of ratings) {
        const norm = normalise(r);
        if (!norm) continue;
        if (String(norm.team) === String(sideId) && norm.player_id) {
          const found = all.find(p => String(p.player_id) === String(norm.player_id));
          if (found) return { player: found.player_name || found.name || norm.name || null, rating: norm.rating };
        }
      }
    }
    // try by rating match
    for (const p of all) {
      const pRating = (p.rating !== undefined && p.rating !== null && !isNaN(Number(p.rating))) ? Number(p.rating) : null;
      if (pRating !== null) {
        // if this player has the same rating as our derived rating, assume it's the same
        if (teamSide.rating !== null && Math.abs(teamSide.rating - pRating) < 0.001) {
          return { player: p.player_name || p.name || null, rating: pRating };
        }
      }
    }
    return null;
  };

  if ((result.home.player === null || result.home.rating === null) && match.lineup) {
    const resolved = resolveFromLineup(result.home, homeId);
    if (resolved) result.home = { player: resolved.player || result.home.player, rating: resolved.rating ?? result.home.rating, reason: result.home.reason || (resolved.rating !== null ? `Highest rating (${resolved.rating})` : null) };
  }
  if ((result.away.player === null || result.away.rating === null) && match.lineup) {
    const resolved2 = resolveFromLineup(result.away, awayId);
    if (resolved2) result.away = { player: resolved2.player || result.away.player, rating: resolved2.rating ?? result.away.rating, reason: result.away.reason || (resolved2.rating !== null ? `Highest rating (${resolved2.rating})` : null) };
  }

  return result;
}

// Compute a single global POTM across all ratings/lineups regardless of team
function computeGlobalPotmFromRatings(match) {
  const ratings = Array.isArray(match.player_ratings) ? match.player_ratings.slice() : [];
  const normalise = (r) => {
    if (!r) return null;
    const name = r.player || r.player_name || r.name || r.playerName || null;
    const ratingRaw = (r.rating !== undefined && r.rating !== null) ? r.rating : (r.value !== undefined && r.value !== null ? r.value : null);
    const rating = (ratingRaw !== null && !isNaN(Number(ratingRaw))) ? Number(ratingRaw) : null;
    const player_id = r.player_id || r.playerId || r.id || null;
    return { name, rating, player_id };
  };
  // find best by numeric rating first
  let best = null;
  for (const r of ratings) {
    const norm = normalise(r);
    if (!norm) continue;
    if (norm.rating !== null) {
      if (!best || (norm.rating > best.rating)) best = { player: norm.name || null, rating: norm.rating, player_id: norm.player_id };
    }
  }
  // fallback: try to find from match.lineup if best not found or lacks name
  if ((!best || !best.player) && match.lineup) {
    const all = (match.lineup.home || []).concat(match.lineup.away || []);
    for (const p of all) {
      const pRating = (p.rating !== undefined && p.rating !== null && !isNaN(Number(p.rating))) ? Number(p.rating) : null;
      if (pRating !== null) {
        if (!best || pRating > (best.rating || -Infinity)) best = { player: p.player_name || p.name || null, rating: pRating, player_id: p.player_id || null };
      }
    }
  }
  if (!best) return { player: null, rating: null, reason: null };
  return { player: best.player || null, rating: best.rating ?? null, reason: best.rating !== null ? `Highest rating (${best.rating})` : null };
}



// Prepare evidence for the model
function shortEvidence(match, tweets = []) {
  const events = match.events || [];
  const stats = match.player_stats || [];
  const ratings = match.player_ratings || [];
  const comments = match.comments || [];
  const lineups = match.lineups || [];
  const normalizedLineup = match.lineup || null;

  return {
    match_summary: {
      match_id: match.match_id,
      date: match.date,
      home_team: match.home_team || (match.teams && match.teams.home && match.teams.home.team_name) || 'Home Team',
      away_team: match.away_team || (match.teams && match.teams.away && match.teams.away.team_name) || 'Away Team',
      score: match.score || {}
    },
    // Include match statistics (possession, shots, etc.)
    match_statistics: match.statistics || match.stats || null,
    events: events.slice(0, 200).map(e => {
      // Try to determine which team the player belongs to
      let playerTeam = null;
      if (e.player && normalizedLineup) {
        // Check if player is in home lineup
        const inHome = (normalizedLineup.home || []).some(p => 
          String(p.player_name || '').toLowerCase().includes(String(e.player || '').toLowerCase()) ||
          String(e.player || '').toLowerCase().includes(String(p.player_name || '').toLowerCase())
        );
        // Check if player is in away lineup
        const inAway = (normalizedLineup.away || []).some(p => 
          String(p.player_name || '').toLowerCase().includes(String(e.player || '').toLowerCase()) ||
          String(e.player || '').toLowerCase().includes(String(p.player_name || '').toLowerCase())
        );
        
        if (inHome) playerTeam = match.home_team || (match.teams && match.teams.home && match.teams.home.team_name) || 'Home Team';
        else if (inAway) playerTeam = match.away_team || (match.teams && match.teams.away && match.teams.away.team_name) || 'Away Team';
      }
      
      return {
        minute: e.minute,
        type: e.type,
        player: e.player,
        team: playerTeam,
        result: e.result,
        info: e.info
      };
    }),
    player_stats: stats.slice(0, 200),
    player_ratings: ratings.slice(0, 200).map(r => {
      let playerName = r.player || r.player_name;
      
      // If no name in rating, try to resolve from lineups using player_id
      if (!playerName && r.player_id && lineups.length > 0) {
        const lineupPlayer = lineups.find(p => String(p.player_id) === String(r.player_id));
        if (lineupPlayer) {
          playerName = lineupPlayer.player_name || lineupPlayer.name || lineupPlayer.player;
        }
      }
      
      return {
        player: playerName,
        rating: r.rating,
        team_id: r.team_id,
        source: r.source
      };
    }),
    comments: comments.slice(0, 200),
    lineups: lineups.slice(0, 200),
    // Include normalized lineup with ratings if available
    lineup: normalizedLineup ? {
      home: (normalizedLineup.home || []).slice(0, 20).map(p => ({
        player_name: p.player_name,
        jersey_number: p.jersey_number,
        position_id: p.position_id,
        rating: p.rating
      })),
      away: (normalizedLineup.away || []).slice(0, 20).map(p => ({
        player_name: p.player_name,
        jersey_number: p.jersey_number,
        position_id: p.position_id,
        rating: p.rating
      }))
    } : null,
    // Include relevant tweets for additional context
    tweets: tweets.slice(0, 15).map(t => ({
      text: t.text,
      author: t.author?.name || t.author?.userName,
      created_at: t.created_at,
      engagement: {
        likes: t.likeCount || 0,
        retweets: t.retweetCount || 0,
        replies: t.replyCount || 0
      },
      is_match_related: t.analysis?.is_match_related || false,
      sentiment: t.analysis?.sentiment || 'neutral',
      collection_phase: t.collection_context?.collected_for || 'general'
    }))
  };
}

// Prompt instructions
const PROMPT_REQUIREMENTS = `
Integrated Prompt: Team-Centric Post-Match Report (JSON Output)
SYSTEM / INSTRUCTION PROMPT

You are a professional football journalist writing a team-focused post-match report for supporters of the specified team.

Your tone should resemble a UK local newspaper match report:

Clear, chronological storytelling

Evidence-first and factual

Mildly analytical but restrained

Written for fans of the team being reported on

No exaggeration, no invented context

You must use ONLY the evidence provided in the EVIDENCE section
(events, player_stats, match_statistics, comments, lineups, player_ratings, tweets).

🚫 Do not invent:

Scores, scorers, minutes, substitutions, injuries

Tactical systems not supported by events

Crowd chants, boardroom pressure, or emotions

Quotes unless explicitly present in tweets

If the evidence does not support a field, use null or an empty array.

OUTPUT FORMAT (STRICT)

Return ONLY a valid JSON object with exactly the following keys:

{
  "headline": "string",
  "summary_paragraphs": ["string"],
  "key_moments": ["string"],
  "commentary": ["string"],
  "player_of_the_match": {
    "player": "string",
    "reason": "string"
  },
  "sources": ["string"]
}

TEAM FOCUS (CRITICAL)

This report is written from the perspective of the specified team:

The team being reported on is the main subject of every section

Describe the match primarily through their performance, decisions, and moments

Opponents should only be referenced as they affect the team's story

If the team loses, the tone should remain professional and analytical — not hostile or dismissive

If the team wins, avoid hype; emphasise control, resilience, or execution

Think: "How would a local paper write this for the club's fans?"

CONTENT RULES BY SECTION
1. headline

Must accurately reflect the result from the team's perspective

Examples:

"Late pressure tests Saints as cup progress secured"

"Missed chances prove costly as Saints exit at third round"

Do not include invented stakes or opinions

2. summary_paragraphs (2–4 short paragraphs)

Written in traditional match-report style

Focus on:

Result and overall narrative

Momentum shifts affecting the team

Key contributors (based on events and ratings)

You may integrate 1–2 tweets total across the entire report:

Use only if tweets exist in the evidence

Quote them verbatim

Attribute professionally:

"As reporter John Smith noted on social media…"

Tweets are context only, never match facts

3. key_moments

One-line entries with minute included

Include all major moments supported by evidence:

Goals

Red cards

Penalties

Major chances

Write them from the team's perspective

e.g. "59' – Saints concede from close range after sustained pressure"

4. commentary (2–6 short editorial lines)

Factual performance observations about the team

Base statements on:

Match events

Player ratings

Match statistics

Commentary timeline

You may reference one tweet here only if not already used

No tactical claims unless clearly supported by substitutions or event patterns

5. player_of_the_match

Must use ONLY SportMonks player_ratings

Select the highest-rated player

Do not allow tweets to influence selection

Reason must reference:

Rating

Match involvement supported by events

Use the term "Player of the Match" (never "Man of the Match")

6. sources

Short list naming evidence types actually used

Example:

"SportMonks match events"

"SportMonks player ratings"

"SportMonks match statistics"

"Official match commentary"

"Verified reporter tweets"

TWEET INTEGRATION RULES (STRICT)

Maximum 1–2 tweets across entire output

Use only if tweets exist in evidence

Never fabricate quotes

Tweets:

Add atmosphere, reaction, or expert observation

Do not establish facts

If no tweets are available:

Do not reference social media at all

FINAL INSTRUCTION

Target total length: ~700–900 words

Perspective: third person

Output JSON only

No markdown, no explanations, no extra keys
`;

async function generateReport(req, res) {
  try {
    const { teamSlug, matchId } = req.params;
    const reportDoc = await generateReportFor(matchId, teamSlug);
    if (reportDoc === null) return res.json({ ok: true, skipped: true });
    return res.json({ ok: true, report: reportDoc });
  } catch (err) {
    console.error('generateReport error:', err?.response?.data || err);
    return res.status(500).json({ error: 'Failed to generate report', detail: err.message || err });
  }
}

// Helper: generate a report for a single match and team (teamSlug can be slug or name)
async function generateReportFor(matchId, teamSlug) {
  // mimic the route behavior but return report doc or throw
  const match = await Match.findOne({ match_id: Number(matchId) }).lean();
  if (!match) throw new Error('Match not found');

  // teamSlug may be a synthetic placeholder like '__home_<id>' or '__away_<id>' when match lacks slugs
  let team = null;
  let targetTeamName = null;
  if (String(teamSlug || '').startsWith('__home_')) {
    targetTeamName = match.home_team || (match.teams && match.teams.home && match.teams.home.team_name) || 'Home Team';
  } else if (String(teamSlug || '').startsWith('__away_')) {
    targetTeamName = match.away_team || (match.teams && match.teams.away && match.teams.away.team_name) || 'Away Team';
  } else {
    team = await Team.findOne({ slug: teamSlug }).lean();
    targetTeamName = team?.name;
    if (!targetTeamName) {
      // derive from match slugs/names if team wasn't found
      if (String(teamSlug).toLowerCase() === String(match.home_team_slug).toLowerCase()) targetTeamName = match.home_team || (match.teams && match.teams.home && match.teams.home.team_name) || null;
      else if (String(teamSlug).toLowerCase() === String(match.away_team_slug).toLowerCase()) targetTeamName = match.away_team || (match.teams && match.teams.away && match.teams.away.team_name) || null;
      else targetTeamName = teamSlug || (match.teams && match.teams.home && match.teams.home.team_name) || 'Home Team'; // fallback to slug text or nested team name
    }
  }

  const momCandidate = computeMomCandidateForTeam(match.player_ratings, targetTeamName, match);
  
  // Fetch relevant tweets for this match and team
  let relevantTweets = [];
  try {
    if (team?.id) {
      // Try to get tweets for this specific match first
      const matchTweets = await Tweet.findForReport(team.id, match.date, {
        preMatchHours: 24,
        postMatchHours: 6,
        limit: 20
      });
      relevantTweets = matchTweets || [];
      
      // If NO tweets found for match, try to collect them automatically
      if (relevantTweets.length === 0 && team.twitter?.tweet_fetch_enabled) {
        console.log(`🐦 No tweets found for ${team.name} vs match ${match.match_id}, attempting automatic collection...`);
        
        try {
          const twitterService = require('../utils/twitterService');
          const { transformAndSaveTweet } = require('./tweetController');
          
          // Collect tweets for this specific match timeframe
          const tweetResults = await twitterService.searchTeamTweets({
            name: team.name,
            hashtag: team.twitter.hashtag,
            reporters: team.twitter.reporters || []
          }, {
            since: new Date(match.date.getTime() - 6 * 60 * 60 * 1000), // 6 hours before
            until: new Date(match.date.getTime() + 3 * 60 * 60 * 1000), // 3 hours after
            queryType: 'Latest'
          });
          
          // Process and save the tweets
          let savedCount = 0;
          if (tweetResults.tweets && tweetResults.tweets.length > 0) {
            for (const tweetData of tweetResults.tweets.slice(0, 10)) { // Limit to 10 tweets
              try {
                // Check if tweet already exists
                const existingTweet = await Tweet.findOne({ tweet_id: tweetData.id });
                if (!existingTweet) {
                  await transformAndSaveTweet(tweetData, team, match);
                  savedCount++;
                }
              } catch (saveError) {
                console.warn(`Failed to save tweet ${tweetData.id}:`, saveError.message);
              }
            }
            
            console.log(`🐦 Successfully collected ${savedCount} new tweets for ${team.name}`);
            
            // Re-query for tweets after collection
            if (savedCount > 0) {
              const newMatchTweets = await Tweet.findForReport(team.id, match.date, {
                preMatchHours: 24,
                postMatchHours: 6,
                limit: 20
              });
              relevantTweets = newMatchTweets || [];
            }
          }
        } catch (collectError) {
          console.warn(`Failed to auto-collect tweets for ${team.name}:`, collectError.message);
        }
      }
      
      // If we still don't have enough match-specific tweets, get general team tweets
      if (relevantTweets.length < 5) {
        const teamTweets = await Tweet.findByTeamAndDateRange(
          team.id, 
          new Date(match.date.getTime() - 48 * 60 * 60 * 1000), // 48 hours before
          new Date(match.date.getTime() + 12 * 60 * 60 * 1000), // 12 hours after
          { limit: 15, matchRelated: false }
        );
        
        // Combine and deduplicate
        const allTweets = [...relevantTweets, ...(teamTweets || [])];
        const seenIds = new Set();
        relevantTweets = allTweets.filter(tweet => {
          if (seenIds.has(tweet.tweet_id)) return false;
          seenIds.add(tweet.tweet_id);
          return true;
        }).slice(0, 15);
      }
    }
  } catch (tweetError) {
    console.warn(`Failed to fetch tweets for report ${match.match_id}/${teamSlug}:`, tweetError.message);
    relevantTweets = [];
  }
  
  const evidence = shortEvidence(match, relevantTweets);\n  \n  // Log tweet collection status for debugging\n  console.log(`📊 Report generation for ${targetTeamName} vs match ${match.match_id}:`);\n  console.log(`   📱 Tweets found: ${relevantTweets.length}`);\n  console.log(`   📊 Events: ${(match.events || []).length}`);\n  console.log(`   ⭐ Player ratings: ${(match.player_ratings || []).length}`);
  // Hoist potmForReport as a single POTM object
  let potmForReport = { player: null, rating: null, reason: null, sources: {} };

  // Legacy normalization removed - handled by the more robust normalization logic below

  // If provider ratings exist on the match, derive POTM for the focused side (home/away)
  if (Array.isArray(match.player_ratings) && match.player_ratings.length) {
    const derived = computePotmFromRatings(match);
    // decide whether this report is for the home side or away side by comparing the targetTeamName
    const tName = String(targetTeamName || '').toLowerCase();
    const homeName = String(match.home_team || '').toLowerCase();
    const awayName = String(match.away_team || '').toLowerCase();
    const nestedHomeName = (match.teams && match.teams.home && String(match.teams.home.team_name || '').toLowerCase()) || '';
    const nestedAwayName = (match.teams && match.teams.away && String(match.teams.away.team_name || '').toLowerCase()) || '';
    const isHomeFocus = (tName && (tName === homeName || tName === nestedHomeName));

    const chosen = isHomeFocus ? derived.home : derived.away;
    if (!potmForReport.player && chosen && chosen.player) {
      potmForReport = { player: chosen.player || null, rating: chosen.rating ?? null, reason: chosen.reason || null, sources: {} };
    } else if (!potmForReport.player) {
      // fallback: use the global highest if team-specific is not available
      const global = computeGlobalPotmFromRatings(match);
      if (global && global.player) potmForReport = { player: global.player || null, rating: global.rating ?? null, reason: global.reason || null, sources: {} };
    }

    // if we have a player name but no rating, attempt to resolve numeric rating from provider data
    if (potmForReport.player && (potmForReport.rating === null || potmForReport.rating === undefined)) {
      const rr = findRatingForPlayer(match, potmForReport.player);
      if (rr !== null) potmForReport.rating = rr;
    }
  }

  const prompt = `
${PROMPT_REQUIREMENTS}

TEAM_FOCUS: "${targetTeamName}"

EVIDENCE:
${JSON.stringify(evidence, null, 2)}

POTM_CANDIDATE: "${momCandidate || 'null'}"

Instructions:
- Write the report from the perspective of TEAM_FOCUS and bias slightly in favour of TEAM_FOCUS (highlight their best player and explain Player of the Match using provided evidence).
- Use ONLY the evidence above. If evidence contradicts POTM_CANDIDATE choose the player best supported by events/stats/ratings and explain why.
- Consider player_ratings when determining Player of the Match - highest-rated players should be strong candidates.
- Do not invent players, scores, or minutes.
- Return ONLY the JSON object.
`.trim();

  const completion = await openai.chat.completions.create({
    model: process.env.REPORT_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a concise sports reporter focused on evidence-based output.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0,
    max_tokens: 1200
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('No model output');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
    if (!parsed) throw new Error('Invalid model output');
  }

  // Select tweets for frontend embedding
  const embeddedTweets = [];
  if (relevantTweets && relevantTweets.length > 0) {
    // Sort tweets by engagement and recency for better selection
    const sortedTweets = relevantTweets
      .filter(tweet => tweet.text && tweet.author && tweet.tweet_id)
      .sort((a, b) => {
        const aEngagement = (a.likeCount || 0) + (a.retweetCount || 0) + (a.replyCount || 0);
        const bEngagement = (b.likeCount || 0) + (b.retweetCount || 0) + (b.replyCount || 0);
        return bEngagement - aEngagement; // Higher engagement first
      });

    // Select top 2-3 tweets for embedding
    const tweetsToEmbed = sortedTweets.slice(0, 3);
    
    for (const tweet of tweetsToEmbed) {
      embeddedTweets.push({
        tweet_id: tweet.tweet_id,
        text: tweet.text,
        author: {
          name: tweet.author.name || tweet.author.userName,
          userName: tweet.author.userName,
          profilePicture: tweet.author.profilePicture,
          isBlueVerified: tweet.author.isBlueVerified || false
        },
        created_at: tweet.created_at,
        engagement: {
          likes: tweet.likeCount || 0,
          retweets: tweet.retweetCount || 0,
          replies: tweet.replyCount || 0
        },
        url: tweet.url || `https://twitter.com/i/status/${tweet.tweet_id}`,
        embed_context: tweet.analysis?.sentiment === 'positive' ? 'fan_reaction' : 'social_commentary',
        placement_hint: 'after_summary'
      });
    }
  }

  const teamFocus = team?.name || targetTeamName;
  // Idempotency for programmatic generate: if match already has a report for this team, return it
  try {
    const normalizedSlug = String(team?.slug || teamSlug || '').toLowerCase();
    const homeSlug = String(match.home_team_slug || '').toLowerCase();
    const awaySlug = String(match.away_team_slug || '').toLowerCase();
    if (match.reports) {
      if (homeSlug && normalizedSlug === homeSlug && match.reports.home) {
        // already exists; signal skipped with null
        return null;
      }
      if (awaySlug && normalizedSlug === awaySlug && match.reports.away) {
        return null;
      }
    }
  } catch (e) {
    console.warn('generateReportFor idempotency check failed (non-fatal):', e?.message || e);
  }

  // normalize team slug for uniqueness; prefer nested match.teams.* when available
  let normalizedTeamSlug2 = team?.slug || teamSlug || null;
  if ((!normalizedTeamSlug2 || String(normalizedTeamSlug2).startsWith('__')) && match && match.teams) {
    if (match.teams.home && match.teams.home.team_slug && targetTeamName === (match.teams.home.team_name || match.home_team)) normalizedTeamSlug2 = match.teams.home.team_slug;
    if (match.teams.away && match.teams.away.team_slug && targetTeamName === (match.teams.away.team_name || match.away_team)) normalizedTeamSlug2 = match.teams.away.team_slug;
  }
  normalizedTeamSlug2 = normalizedTeamSlug2 ? String(normalizedTeamSlug2).toLowerCase().trim() : null;
  let reportDoc = null;
  // hoist these so we can reference them after the try/catch when patching the persisted doc
  let finalTeamFocus2 = null;
  let playerRatingsToUse2 = [];
  let finalMotm2 = null;
  let createDoc2 = null;

  try {
  // Ensure team_focus is present (prefer resolved team name over model output)
  finalTeamFocus2 = (parsed.team_focus && String(parsed.team_focus).trim()) ? parsed.team_focus : teamFocus;

    // If the match doesn't already have provider-shaped player_ratings, try to extract them
    // from `match.lineups` details (SportMonks stores rating in details[*].data.value, type_id 118).
    try {
      if ((!Array.isArray(match.player_ratings) || !match.player_ratings.length) && Array.isArray(match.lineups) && match.lineups.length) {
        const extracted = [];
        for (const p of match.lineups) {
          // prefer top-level rating if present, otherwise fall back to details
          let rVal = null;
          if (p && (p.rating !== undefined && p.rating !== null) && !isNaN(Number(p.rating))) rVal = Number(p.rating);
          else if (Array.isArray(p.details) && p.details.length) {
            const det = p.details.find(d => d.type_id === 118) || p.details[0];
            if (det && det.data && (det.data.value !== undefined && det.data.value !== null) && !isNaN(Number(det.data.value))) rVal = Number(det.data.value);
          }
          if (rVal !== null) {
            extracted.push({
              player: p.player_name || p.player || null,
              player_id: p.player_id || null,
              team_id: p.team_id || null,
              rating: rVal,
              lineup_id: p.id || p.lineup_id || null,
              detail_id: (p.details && p.details[0] && p.details[0].id) || null,
              source: 'sportmonks:lineup_detail'
            });
          }
        }
        if (extracted.length) {
          match.player_ratings = extracted;
          try {
            await Match.findOneAndUpdate({ match_id: match.match_id }, { $set: { player_ratings: match.player_ratings } });
          } catch (e) {
            console.warn('Failed to persist extracted player_ratings to Match:', e?.message || e);
          }
        }
      }
    } catch (e) {
      console.warn('Error while extracting player_ratings from match.lineups:', e?.message || e);
    }

    // Debug: log match lineup status
    console.log(`[DEBUG] Match ${match.match_id} lineup status:`);
    console.log(`[DEBUG] Has lineup: ${!!match.lineup}`);
    console.log(`[DEBUG] Has lineups array: ${Array.isArray(match.lineups)}`);
    console.log(`[DEBUG] Lineups length: ${match.lineups?.length || 0}`);
    if (match.lineup) {
      console.log(`[DEBUG] Existing lineup: ${match.lineup.home?.length || 0} home, ${match.lineup.away?.length || 0} away`);
    }

    // Normalize lineup structure if it doesn't exist or if existing lineup is malformed (all players in away team)
    const needsNormalization = (!match.lineup && Array.isArray(match.lineups)) || 
                               (match.lineup && match.lineup.home && match.lineup.home.length === 0 && match.lineup.away && match.lineup.away.length > 0);
    
    if (needsNormalization && Array.isArray(match.lineups)) {
      try {
        const homeId = match.home_team_id ?? match.homeId ?? (match.teams && match.teams.home && match.teams.home.team_id) ?? null;
        const awayId = match.away_team_id ?? match.awayId ?? (match.teams && match.teams.away && match.teams.away.team_id) ?? null;
        
        // Only proceed if we can extract valid team IDs
        if (!homeId || !awayId) {
          console.log(`[LINEUP-NORM] Skipping normalization for match ${match.match_id} - missing team IDs (home: ${homeId}, away: ${awayId})`);
          return; // Exit early to avoid overwriting good data
        }
        
        console.log(`[LINEUP-NORM] Starting normalization for match ${match.match_id}`);
        console.log(`[LINEUP-NORM] Home ID: ${homeId}, Away ID: ${awayId}`);
        console.log(`[LINEUP-NORM] Total lineups: ${match.lineups.length}`);

        
        const normalizeLineup = (players, teamId) => {
          const filtered = players.filter(p => p.team_id === teamId);
          console.log(`[LINEUP-NORM] Team ${teamId}: ${filtered.length} players`);
          return filtered.map(p => ({
            player_name: p.player_name || p.name,
            jersey_number: p.jersey_number,
            position_id: p.position_id,
            player_id: p.player_id,
            rating: null // will be populated below
          }));
        };

        const newHome = homeId ? normalizeLineup(match.lineups, homeId) : [];
        const newAway = awayId ? normalizeLineup(match.lineups, awayId) : [];
        
        // Safety check: only overwrite if we actually found players
        if (newHome.length === 0 && newAway.length === 0) {
          console.log(`[LINEUP-NORM] Skipping normalization for match ${match.match_id} - no players found for either team`);
          return; // Exit early to avoid overwriting good data with empty arrays
        }

        match.lineup = {
          home: newHome,
          away: newAway
        };
        
        console.log(`[LINEUP-NORM] Result: ${match.lineup.home.length} home, ${match.lineup.away.length} away`);

        // Add ratings to lineup if available
        if (Array.isArray(match.player_ratings)) {
          for (const rating of match.player_ratings) {
            const playerId = rating.player_id;
            if (playerId) {
              // Find player in home lineup
              const homePlayer = match.lineup.home.find(p => p.player_id === playerId);
              if (homePlayer && rating.rating !== null && rating.rating !== undefined) {
                homePlayer.rating = Number(rating.rating);
              }
              
              // Find player in away lineup
              const awayPlayer = match.lineup.away.find(p => p.player_id === playerId);
              if (awayPlayer && rating.rating !== null && rating.rating !== undefined) {
                awayPlayer.rating = Number(rating.rating);
              }
            }
          }
        }

        // Save normalized lineup to database for future use
        try {
          await Match.findOneAndUpdate(
            { match_id: match.match_id }, 
            { $set: { lineup: match.lineup } }
          );
          console.log(`✓ Normalized lineup saved for match ${match.match_id}: ${match.lineup.home.length} home, ${match.lineup.away.length} away`);
        } catch (e) {
          console.warn('Failed to persist normalized lineup to Match:', e?.message || e);
        }
      } catch (e) {
        console.warn('Error normalizing lineup structure:', e?.message || e);
      }
    }

    // Choose player_ratings: DO NOT SYNTHESIZE. Always prefer provider-shaped `match.player_ratings`.
    // We no longer require provider-shaped player_ratings for a report. Accept parsed.potm (team-specific)
    // or parsed.man_of_the_match as a legacy fallback. Provider player_ratings on match (if present)
    // will still be used to derive POTM for each side but are not embedded into the Report document.
    playerRatingsToUse2 = Array.isArray(match.player_ratings) ? match.player_ratings.slice() : [];

    // parsed.potm is expected to be { home: {player, reason, rating?}, away: {player, reason, rating?} }
    let parsedPotm = parsed.potm || null;
    if (!parsedPotm && parsed.player_of_the_match && parsed.player_of_the_match.player) {
      // single POTM -> assign to focused side
      parsedPotm = {};
      // normalize the player/reason strings (model sometimes emits 'null' or empty strings)
      const potm = {
        player: normalizeNullableString(parsed.player_of_the_match.player),
        reason: normalizeNullableString(parsed.player_of_the_match.reason)
      };
      if (finalTeamFocus2 && String(finalTeamFocus2).toLowerCase() === String(match.home_team || '').toLowerCase()) parsedPotm.home = potm;
      else parsedPotm.away = potm;
    }
    // Legacy fallback for old "man_of_the_match" field
    if (!parsedPotm && parsed.man_of_the_match && parsed.man_of_the_match.player) {
      parsedPotm = {};
      const motm = {
        player: normalizeNullableString(parsed.man_of_the_match.player),
        reason: normalizeNullableString(parsed.man_of_the_match.reason)
      };
      if (finalTeamFocus2 && String(finalTeamFocus2).toLowerCase() === String(match.home_team || '').toLowerCase()) parsedPotm.home = motm;
      else parsedPotm.away = motm;
    }
    if (!finalMotm2 || !finalMotm2.player) {
      if (playerRatingsToUse2 && playerRatingsToUse2.length) {
        const sorted = [...playerRatingsToUse2].filter(p => typeof p.rating === 'number').sort((a, b) => (b.rating || 0) - (a.rating || 0));
        if (sorted.length) {
          finalMotm2 = { player: sorted[0].player || null, reason: `Highest rating (${sorted[0].rating})` };
        }
      }
    }

    // We will not store normalized player_ratings on the Report document. If provider ratings exist on `match`
    // they remain on the Match document. For the Report, pass through any commentary and key_moments from the model.
    const normalizedRatings = [];

    // Determine report-level team_id (required by Report schema)
    let reportTeamId = null;
    try {
      const homeId = match.home_team_id ?? match.homeId ?? (match.teams && match.teams.home && match.teams.home.team_id) ?? null;
      const awayId = match.away_team_id ?? match.awayId ?? (match.teams && match.teams.away && match.teams.away.team_id) ?? null;
      const homeSlug = String(match.home_team_slug || (match.teams && match.teams.home && match.teams.home.team_slug) || '').toLowerCase();
      const awaySlug = String(match.away_team_slug || (match.teams && match.teams.away && match.teams.away.team_slug) || '').toLowerCase();
      if (normalizedTeamSlug2 && homeSlug && normalizedTeamSlug2 === homeSlug) reportTeamId = homeId;
      else if (normalizedTeamSlug2 && awaySlug && normalizedTeamSlug2 === awaySlug) reportTeamId = awayId;
      else if (finalTeamFocus2 && String(finalTeamFocus2).toLowerCase() === String(match.home_team || match.teams?.home?.team_name || '').toLowerCase()) reportTeamId = homeId;
      else if (finalTeamFocus2 && String(finalTeamFocus2).toLowerCase() === String(match.away_team || match.teams?.away?.team_name || '').toLowerCase()) reportTeamId = awayId;

      // fallback: try to resolve from Team collection using slug
      if ((!reportTeamId || isNaN(reportTeamId)) && normalizedTeamSlug2) {
        const foundTeam = team || (await Team.findOne({ slug: normalizedTeamSlug2 }).lean());
        if (foundTeam && (foundTeam.id !== undefined && foundTeam.id !== null)) reportTeamId = foundTeam.id;
      }

      // fallback: if ratings carry a team_id, use that
      if ((!reportTeamId || isNaN(reportTeamId)) && Array.isArray(normalizedRatings) && normalizedRatings.length) {
        const rWithTeam = normalizedRatings.find(r => r.team_id);
        if (rWithTeam) reportTeamId = rWithTeam.team_id;
      }

      if ((!reportTeamId || isNaN(reportTeamId))) {
        throw new Error(`Unable to resolve report team_id for match ${match.match_id} and teamSlug ${teamSlug || normalizedTeamSlug2}`);
      }
    } catch (e) {
      // bubble up a clear error so callers know why create would fail
      throw e;
    }

    createDoc2 = {
      match_id: match.match_id,
      team_id: reportTeamId,
      team_focus: finalTeamFocus2,
      team_slug: normalizedTeamSlug2,
      headline: parsed.headline,
      summary_paragraphs: parsed.summary_paragraphs,
      key_moments: parsed.key_moments || [],
      commentary: parsed.commentary || [],
      comments: match.comments || [],
      player_ratings: Array.isArray(match.player_ratings) ? match.player_ratings : [],
      lineup: match.lineup || null,
      evidence_ref: { 
        events_count: evidence.events.length, 
        stats_count: evidence.player_stats.length,
        ratings_count: (match.player_ratings || []).length
      },
      meta: { generated_by: process.env.REPORT_MODEL || 'gpt-4o-mini' }
    };

    // Prefer updating an existing Report document (we create skeletons during sync). If a report
    // exists for this match+team, write generated output into `report.generated` and mark finalized.
    const existingReport = await Report.findOne({ match_id: match.match_id, team_slug: normalizedTeamSlug2 });
    if (existingReport) {
        // compute team-specific POTM: prefer parsed potm if present; otherwise derive from match.player_ratings if available
        let teamMotm = null;
      // Use team-specific POTM from computePotmFromRatings for proper home/away assignment
      const derivedPotm = computePotmFromRatings(match);
      
      // Determine if this report is for home or away team
      const tName = String(finalTeamFocus2 || '').toLowerCase();
      const homeName = String(match.home_team || '').toLowerCase();
      const awayName = String(match.away_team || '').toLowerCase();
      const nestedHomeName = (match.teams && match.teams.home && String(match.teams.home.team_name || '').toLowerCase()) || '';
      const nestedAwayName = (match.teams && match.teams.away && String(match.teams.away.team_name || '').toLowerCase()) || '';
      const isHomeFocus = (tName && (tName === homeName || tName === nestedHomeName));
      
      // Choose the appropriate team-specific POTM
      const teamSpecificPotm = isHomeFocus ? derivedPotm.home : derivedPotm.away;
      if (teamSpecificPotm && teamSpecificPotm.player) {
        potmForReport = { 
          player: teamSpecificPotm.player || null, 
          rating: teamSpecificPotm.rating ?? null, 
          reason: teamSpecificPotm.reason || null, 
          sources: {} 
        };
      } else if (parsedPotm) {
        // sanitize parsed POTM values coming from the model (it may emit the literal string "null")
        const parsedHome = parsedPotm.home ? { player: normalizeNullableString(parsedPotm.home.player), rating: parsedPotm.home.rating ?? null, reason: normalizeNullableString(parsedPotm.home.reason) } : null;
        const parsedAway = parsedPotm.away ? { player: normalizeNullableString(parsedPotm.away.player), rating: parsedPotm.away.rating ?? null, reason: normalizeNullableString(parsedPotm.away.reason) } : null;
        
        // Choose the POTM based on which team this report is for
        const teamSpecificParsedPotm = isHomeFocus ? parsedHome : parsedAway;
        if (teamSpecificParsedPotm && teamSpecificParsedPotm.player) {
          potmForReport = { player: teamSpecificParsedPotm.player, rating: teamSpecificParsedPotm.rating, reason: teamSpecificParsedPotm.reason, sources: {} };
        }
      }
      // backfill numeric rating from provider-shaped data (lineup/player_ratings) when possible
      if (potmForReport.player && (potmForReport.rating === null || potmForReport.rating === undefined)) {
        const rr = findRatingForPlayer(match, potmForReport.player);
        if (rr !== null) potmForReport.rating = rr;
      }

      // Generate content field from structured data
      const contentParts = [];
      if (parsed.headline) contentParts.push(parsed.headline);
      if (parsed.summary_paragraphs && parsed.summary_paragraphs.length) {
        contentParts.push(...parsed.summary_paragraphs);
      }
      if (parsed.key_moments && parsed.key_moments.length) {
        contentParts.push('Key Moments:');
        contentParts.push(...parsed.key_moments.map(moment => `• ${moment}`));
      }
      if (parsed.commentary && parsed.commentary.length) {
        contentParts.push('Commentary:');
        contentParts.push(...parsed.commentary);
      }
      if (parsed.player_of_the_match && parsed.player_of_the_match.player) {
        contentParts.push(`Player of the Match: ${parsed.player_of_the_match.player}${parsed.player_of_the_match.reason ? ` - ${parsed.player_of_the_match.reason}` : ''}`);
      }

      // Generate JSON-LD schema for SEO and rich results
      const matchEvents = extractMatchEventsForJsonLd(match);
      const keywords = generateKeywords(match, normalizedTeamSlug2);
      
      const reportUrl = `https://thefinalplay.com/reports/${normalizedTeamSlug2}/${match.match_id}`;
      const publishedAt = existingReport.created_at || new Date();
      const modifiedAt = new Date();
      
      const jsonLdSchema = generateMatchReportJsonLd({
        headline: parsed.headline || `${finalTeamFocus2} Match Report`,
        articleBody: contentParts.join('\n\n'),
        reportUrl,
        publishedAt,
        modifiedAt,
        images: [
          `https://thefinalplay.com/assets/teams/${normalizedTeamSlug2}-logo.png`,
          `https://thefinalplay.com/assets/default-match-image.jpg`
        ],
        keywords,
        match: {
          homeTeam: match.home_team || (match.teams?.home?.team_name),
          awayTeam: match.away_team || (match.teams?.away?.team_name),
          score: match.score ? `${match.score.home || 0}-${match.score.away || 0}` : null,
          kickoffTime: match.date,
          venue: match.venue?.name || match.stadium || 'Stadium',
          referee: match.referee?.name,
          league: match.league?.name || match.competition?.name,
          events: matchEvents,
          city: match.venue?.city,
          country: match.venue?.country || 'GB'
        }
      });

      const setObj = {
        ...createDoc2,
        generated: parsed,
        content: contentParts.join('\n\n'),
        potm: potmForReport,
        json_ld_schema: jsonLdSchema,
        status: 'final',
        finalized_at: new Date(),
        // Add RSS metadata
        meta: {
          ...(createDoc2.meta || {}),
          rss_ready: true,
          content_type: 'match_report',
          last_rss_update: new Date()
        }
      };
      await Report.findOneAndUpdate({ _id: existingReport._id }, { $set: setObj }, { new: true });
      reportDoc = await Report.findById(existingReport._id).lean();
    } else {
      // fallback: create a new report (should be rare because sync creates skeletons)
      // Generate content field from structured data
      const contentParts = [];
      if (parsed.headline) contentParts.push(parsed.headline);
      if (parsed.summary_paragraphs && parsed.summary_paragraphs.length) {
        contentParts.push(...parsed.summary_paragraphs);
      }
      if (parsed.key_moments && parsed.key_moments.length) {
        contentParts.push('Key Moments:');
        contentParts.push(...parsed.key_moments.map(moment => `• ${moment}`));
      }
      if (parsed.commentary && parsed.commentary.length) {
        contentParts.push('Commentary:');
        contentParts.push(...parsed.commentary);
      }
      if (parsed.player_of_the_match && parsed.player_of_the_match.player) {
        contentParts.push(`Player of the Match: ${parsed.player_of_the_match.player}${parsed.player_of_the_match.reason ? ` - ${parsed.player_of_the_match.reason}` : ''}`);
      }

      // Add embedded tweets to the generated structure
      parsed.embedded_tweets = embeddedTweets;
      
      // Update sources to include tweet authors for transparency
      if (embeddedTweets.length > 0 && parsed.sources) {
        const tweetSources = embeddedTweets.map(t => `@${t.author.userName}`);
        if (!parsed.sources.includes('social_media')) {
          parsed.sources.push('social_media');
        }
        // Store tweet IDs in potm sources for reference
        if (potmForReport && potmForReport.sources) {
          potmForReport.sources.tweets = embeddedTweets.map(t => t.tweet_id);
        }
      }
      
      // Generate JSON-LD schema for SEO and rich results
      const matchEvents = extractMatchEventsForJsonLd(match);
      const keywords = generateKeywords(match, normalizedTeamSlug2);
      
      const reportUrl = `https://thefinalplay.com/reports/${normalizedTeamSlug2}/${match.match_id}`;
      const publishedAt = new Date();
      
      const jsonLdSchema = generateMatchReportJsonLd({
        headline: parsed.headline || `${finalTeamFocus2} Match Report`,
        articleBody: contentParts.join('\n\n'),
        reportUrl,
        publishedAt,
        modifiedAt: publishedAt,
        images: [
          `https://thefinalplay.com/assets/teams/${normalizedTeamSlug2}-logo.png`,
          `https://thefinalplay.com/assets/default-match-image.jpg`
        ],
        keywords,
        match: {
          homeTeam: match.home_team || (match.teams?.home?.team_name),
          awayTeam: match.away_team || (match.teams?.away?.team_name),
          score: match.score ? `${match.score.home || 0}-${match.score.away || 0}` : null,
          kickoffTime: match.date,
          venue: match.venue?.name || match.stadium || 'Stadium',
          referee: match.referee?.name,
          league: match.league?.name || match.competition?.name,
          events: matchEvents,
          city: match.venue?.city,
          country: match.venue?.country || 'GB'
        }
      });
      
      createDoc2.generated = parsed;
      createDoc2.content = contentParts.join('\n\n');
      createDoc2.potm = potmForReport;
      createDoc2.json_ld_schema = jsonLdSchema;
      createDoc2.status = 'final';
      createDoc2.finalized_at = new Date();
      
      // Add RSS metadata for better RSS feed generation
      createDoc2.meta = {
        ...(createDoc2.meta || {}),
        rss_ready: true,
        content_type: 'match_report',
        last_rss_update: new Date()
      };
      
      reportDoc = await Report.create(createDoc2);
    }
  } catch (errCreate) {
    if (errCreate && (errCreate.code === 11000 || (errCreate.name === 'MongoServerError' && errCreate.code === 11000))) {
      console.warn('Report.create race detected (generateReportFor): fetching existing report', match.match_id, normalizedTeamSlug2);
      reportDoc = await Report.findOne({ match_id: match.match_id, team_slug: normalizedTeamSlug2 }).lean();
      if (!reportDoc) throw errCreate; // rethrow if something's inconsistent
    } else {
      throw errCreate;
    }
  }

  // Ensure the persisted report contains the resolved fields (team_focus, slug, ratings, motm)
  try {
    // build a safe set object from either createDoc2 (if present) or the hoisted variables
      const setObj2 = {
      team_focus: (createDoc2 && createDoc2.team_focus) || finalTeamFocus2 || teamFocus,
      team_slug: (createDoc2 && createDoc2.team_slug) || normalizedTeamSlug2,
      comments: (createDoc2 && createDoc2.comments) || match.comments || [],
      commentary: (createDoc2 && createDoc2.commentary) || parsed.commentary || [],
      potm: (createDoc2 && createDoc2.potm) || potmForReport || { player: null }
    };
    await Report.findOneAndUpdate({ _id: reportDoc._id }, { $set: setObj2 }, { new: true });
    reportDoc = await Report.findById(reportDoc._id).lean();
  } catch (e) {
    console.warn('Failed to patch report document (generateReportFor) with resolved fields:', e?.message || e);
  }
  // Build update payload for match: set reports.home or reports.away and POTM accordingly
  const set = {};
  const teamSlugNormalized = team?.slug;
  const homeSlug = String(match.home_team_slug || match.teams?.home?.team_slug || '').toLowerCase();
  const awaySlug = String(match.away_team_slug || match.teams?.away?.team_slug || '').toLowerCase();

  // prefer report's potm entry for POTM lookup
  const rptPotm = reportDoc.potm || null;
  const fallbackRating = (match.player_ratings || []);



  if (homeSlug && teamSlugNormalized === homeSlug) {
    set['reports.home'] = reportDoc._id;
    set['potm.home'] = {
      player: rptPotm?.player || '',
      rating: rptPotm?.rating ?? null,
      reason: rptPotm?.reason || '',
      source: rptPotm ? 'report' : 'db'
    };
  } else if (awaySlug && teamSlugNormalized === awaySlug) {
    set['reports.away'] = reportDoc._id;
    set['potm.away'] = {
      player: rptPotm?.player || '',
      rating: rptPotm?.rating ?? null,
      reason: rptPotm?.reason || '',
      source: rptPotm ? 'report' : 'db'
    };
  } else {
    // fallback: compare by name (check both legacy and nested team names)
    const homeTeamName = match.home_team || match.teams?.home?.team_name;
    const awayTeamName = match.away_team || match.teams?.away?.team_name;
    
    if (teamFocus === homeTeamName) {
      set['reports.home'] = reportDoc._id;
      set['potm.home'] = {
        player: reportDoc.potm?.player || '',
        rating: reportDoc.potm?.rating ?? null,
        reason: reportDoc.potm?.reason || '',
        source: reportDoc.potm ? 'report' : 'db'
      };
    } else if (teamFocus === awayTeamName) {
      set['reports.away'] = reportDoc._id;
      set['potm.away'] = {
        player: reportDoc.potm?.player || '',
        rating: reportDoc.potm?.rating ?? null,
        reason: reportDoc.potm?.reason || '',
        source: reportDoc.potm ? 'report' : 'db'
      };
    }
  }

  if (Object.keys(set).length) {
    // also set generated_at and model metadata on the match.reports object
    set['reports.generated_at'] = new Date();
    set['reports.model'] = reportDoc.meta?.generated_by || (process.env.OPENAI_MODEL || '');
    await Match.findOneAndUpdate({ match_id: match.match_id }, { $set: set });
  }

  return reportDoc;
}

// Generate both home and away reports for a match (returns array of report docs)
async function generateBothReports(matchId) {
  const match = await Match.findOne({ match_id: Number(matchId) }).lean();
  if (!match) throw new Error('Match not found');
  const homeSlug = match.home_team_slug || (match.teams && match.teams.home && match.teams.home.team_slug) || (match.home_team ? slugifyName(match.home_team) : `__home_${matchId}`);
  const awaySlug = match.away_team_slug || (match.teams && match.teams.away && match.teams.away.team_slug) || (match.away_team ? slugifyName(match.away_team) : `__away_${matchId}`);

  const results = [];
  // Only generate for sides that don't already have a report stored on the match
  try {
    if (!match.reports || !match.reports.home) {
      try {
        const r = await generateReportFor(matchId, homeSlug);
        if (r) results.push(r);
        else console.log(`generateBothReports: skipped home for ${matchId} (already exists)`);
      } catch (e) { console.warn('home report failed', e.message); }
    } else {
      console.log(`generateBothReports: skipping home for ${matchId} (already has report)`);
    }

    if (!match.reports || !match.reports.away) {
      try {
        const r2 = await generateReportFor(matchId, awaySlug);
        if (r2) results.push(r2);
        else console.log(`generateBothReports: skipped away for ${matchId} (already exists)`);
      } catch (e) { console.warn('away report failed', e.message); }
    } else {
      console.log(`generateBothReports: skipping away for ${matchId} (already has report)`);
    }
  } catch (e) {
    console.warn('generateBothReports encountered an error while checking/creating reports:', e?.message || e);
  }

  return results;
}

module.exports = { generateReport, generateReportFor, generateBothReports };
