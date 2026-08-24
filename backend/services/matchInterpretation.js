// services/matchInterpretation.js
// STEP 1: Fast interpretation of raw match data into structured narrative

const { client } = require('../utils/openai');

// Translate the backend-computed odds consensus (models/Match.js `odds`) into evidence
// relative to the focused team. Never passes raw per-bookmaker rows to the model.
function buildMarketContext(odds, teamSide) {
  if (!odds || !odds.available) return { available: false };

  const opponentSide = teamSide === 'home' ? 'away' : 'home';
  const probs = odds.probabilities || {};

  let focused_team_expectation = 'evenly_matched';
  if (odds.favourite === teamSide) focused_team_expectation = 'favourite';
  else if (odds.favourite === opponentSide) focused_team_expectation = 'underdog';

  return {
    available: true,
    market_name: odds.market_name,
    bookmakers_used: odds.bookmakers_used,
    confidence: odds.confidence,
    probabilities: { home: probs.home ?? null, draw: probs.draw ?? null, away: probs.away ?? null },
    favourite: odds.favourite,
    favourite_strength: odds.favourite_strength,
    focused_team_expectation,
    focused_team_win_probability: probs[teamSide] ?? null,
    opponent_win_probability: probs[opponentSide] ?? null
  };
}

// Translate the backend-computed Pressure Index summary (models/Match.js `pressure_summary`)
// into evidence relative to the focused team. Never passes the raw minute-by-minute array.
function buildPressureContext(pressureSummary, teamSide) {
  if (!pressureSummary || !pressureSummary.available) return { available: false };

  return {
    available: true,
    overall_balance: pressureSummary.overall_balance || null,
    focused_team_pressure_share: pressureSummary.overall_balance?.[`${teamSide}_pct`] ?? null,
    sustained_pressure_periods: pressureSummary.sustained_pressure_periods || [],
    pressure_around_goals: pressureSummary.pressure_around_goals || [],
    pressure_after_leading: pressureSummary.pressure_after_leading || null
  };
}

/**
 * Analyze raw match data and generate a structured narrative interpretation.
 * Uses a cheaper/faster model to extract key narrative elements.
 * 
 * @param {Object} params - Input parameters
 * @param {Object} params.match - Match data from database
 * @param {Array} params.tweets - Relevant tweets
 * @param {String} params.teamFocus - Name of the focused team
 * @param {Boolean} params.isCup - Whether this is a cup competition
 * @param {String} params.competitionName - Name of competition
 * @param {String} params.competitionStage - Stage/round name
 * @returns {Promise<Object>} Structured narrative interpretation
 */
async function interpretMatch({
  match,
  tweets = [],
  teamFocus,
  teamSide,
  isCup = false,
  competitionName = 'Unknown',
  competitionStage = 'Unknown'
}) {
  const events = match.events || [];
  const ratings = match.player_ratings || [];
  const stats = match.statistics || match.stats || {};
  const coaches = match.coaches || [];
  
  // Extract coach/manager names for both teams
  const homeCoach = coaches.find(c => c.meta?.participant_id === match.teams?.home?.team_id);
  const awayCoach = coaches.find(c => c.meta?.participant_id === match.teams?.away?.team_id);
  const focusedCoach = teamSide === 'home' ? homeCoach : awayCoach;
  
  // Determine match result from focused team's perspective
  const homeScore = match.score?.home || 0;
  const awayScore = match.score?.away || 0;
  const focusedScore = teamSide === 'home' ? homeScore : awayScore;
  const opponentScore = teamSide === 'home' ? awayScore : homeScore;
  
  let result;
  if (focusedScore > opponentScore) {
    result = 'won';
  } else if (focusedScore < opponentScore) {
    result = 'lost';
  } else {
    result = 'drew';
  }
  
  // Build concise evidence for interpretation
  const evidence = {
    match: {
      home: match.home_team,
      away: match.away_team,
      home_team_name: match.teams?.home?.team_name,
      away_team_name: match.teams?.away?.team_name,
      score: match.score,
      focused_team: teamFocus,
      focused_side: teamSide,
      result: result, // won/lost/drew
      competition: competitionName,
      stage: competitionStage,
      is_cup: isCup,
      manager: focusedCoach ? (focusedCoach.common_name || focusedCoach.name || focusedCoach.display_name) : null,
      venue: match.match_info?.venue?.name || null,
      referee: match.match_info?.referee?.common_name || match.match_info?.referee?.name || null
    },
    timeline: events
      .filter(e => {
        const eventType = (e.type || '').toLowerCase();
        return ['goal', 'yellowcard', 'redcard', 'substitution'].includes(eventType);
      })
      .slice(0, 50)
      .map(e => ({
        minute: e.minute,
        type: e.type,
        player: e.player || e.player_name,
        related_player: e.related_player || e.related_player_name,
        team: e.team,
        result: e.result,
        info: e.info
      })),
    stats: {
      possession: stats.possession,
      shots: stats.shots,
      shots_on_target: stats.shotsOnTarget,
      corners: stats.corners,
      fouls: stats.fouls
    },
    top_performers: ratings
      .filter(r => r.rating && r.rating >= 7.0)
      .slice(0, 10)
      .map(r => ({
        player: r.player || r.player_name,
        rating: r.rating,
        team_id: r.team_id
      })),
    tweets: tweets.slice(0, 10).map(t => ({
      tweet_id: t.tweet_id || t.id || null,
      source: {
        author_name: t.author?.name || null,
        handle: t.author?.userName || null,
        original_post_url: t.url || (t.tweet_id ? `https://twitter.com/i/status/${t.tweet_id}` : null)
      },
      original_language: t.lang || null,
      original_language_text: t.text,
      sentiment: t.analysis?.sentiment,
      engagement: (t.likeCount || 0) + (t.retweetCount || 0)
    })),
    // Additional analytical layer (backend pre-processed - see buildMarketContext/buildPressureContext).
    // Either block may be { available: false } when Sportmonks odds/Pressure Index coverage is missing.
    market_context: buildMarketContext(match.odds, teamSide),
    pressure_context: buildPressureContext(match.pressure_summary, teamSide)
  };

  const prompt = buildInterpretationPrompt(evidence, teamFocus);

  const completion = await client.chat.completions.create({
    model: process.env.INTERPRETATION_MODEL || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a match analyst extracting narrative structure from match data. Return only JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3, // Low temperature for consistent structure
    max_tokens: 1500,
    response_format: { type: 'json_object' } // Force JSON output
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('No interpretation output from model');

  let interpretation;
  try {
    interpretation = JSON.parse(text);
  } catch (e) {
    // Fallback: try to extract JSON from text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      interpretation = JSON.parse(match[0]);
    } else {
      throw new Error('Invalid interpretation JSON output');
    }
  }

  // Add metadata
  interpretation.generated_at = new Date().toISOString();
  interpretation.model = process.env.INTERPRETATION_MODEL || 'gpt-4o-mini';

  return interpretation;
}

/**
 * Build the interpretation prompt
 */
function buildInterpretationPrompt(evidence, teamFocus) {
  const { result, focused_side, score } = evidence.match;
  const resultText = result === 'won' ? 'WON' : result === 'lost' ? 'LOST' : 'DREW';
  const scoreText = `${score.home}-${score.away}`;
  
  return `
STEP 1 PROMPT – Generate Match Narrative (JSON)

You are a professional football journalist tasked with analyzing match events to create a structured, evidence-based narrative for ${teamFocus}.

Your job in Step 1 is to read the raw match data (events, goals, cards, substitutions, lineups, player ratings, match stats, and reporter tweets) and output a **structured JSON** that captures the match flow. This JSON will be used in Step 2 to generate a full team-centric post-match report in ~700–900 words.

IMPORTANT: Step 1 **does not write the final report**. Only produce the structured JSON.

---

MATCH CONTEXT:
${teamFocus} (playing as ${focused_side}) ${resultText} ${scoreText}
Competition: ${evidence.match.competition} - ${evidence.match.stage}

INPUT DATA:
${JSON.stringify(evidence, null, 2)}

---

REQUIREMENTS

1. Use only the evidence provided. Do NOT invent goals, scorers, minutes, events, tactics, or quotes.

2. Respect competition type:
   - **Cup competitions**: Use language like "progress," "advance," "crash out," "knockout progression." NEVER mention points, table position, or league standings.
   - **League competitions**: You may mention table impact if supported by evidence, but avoid inventing stakes.
   - Always include the competition name and stage (from match context above).

3. Capture **first-half and second-half summaries**:
   - Write **2–4 sentences per half**.
   - Include:
     - Goal sequences and build-up (shots, chances, counterattacks, pressing), if supported by events.
     - Defensive actions or near-misses.
     - Temporary swings in momentum.
   - Assign "momentum" as "home" or "away" depending on which team dominated.

4. Capture **key moments**:
   - Include goals, penalties, red cards, yellow cards, major chances.
   - Provide minute, player, and context (e.g., "61' – Cyle Larin scored for Southampton to restore two-goal lead").
  - Explain why each selected moment mattered to the score, momentum, pressure, tactics, or result when the evidence supports it; do not merely repeat the event.
   - Reference tweets only if explicitly available, as context.

5. Identify **decisive moment**:
   - Minute, description, and why it was decisive.
   - Optionally reference tweet if available (use "selected_tweets" for this).

6. Identify **momentum shifts**:
   - List moments where the flow of the game changed (team reduced deficit, scored to regain lead, etc.).

7. **Overall story**:
   - 2–3 sentences summarizing the match narrative.

8. **Extract tweet context** (max 2-3):
   - Choose tweets that add valuable ACTION DETAILS (not just reactions/emotions)
   - Prefer tweets describing: goals (foot, placement, buildup), tactical observations, match-turning moments
   - Look for tweets with specific details like: shot placement, player movement, pass sequences, defensive errors
  - Extract the underlying factual and contextual information in the tweet's original language
  - Do NOT reproduce the tweet's wording, distinctive phrases, sentence structure, metaphors, or writing style
  - Do NOT include the full tweet text or quote any part of it
  - Preserve the source author name, Twitter handle/account, and original post URL from the input
  - Assign confidence (high, medium, or low) to your factual extraction
  - Assign relevance (high, medium, or low) to the report's match narrative
  - Set suitable_for_report to true only when the observation is credible, match-relevant, and useful in a report; otherwise set it to false
  - Only select tweets from credible reporters that will enhance the final report with factual detail
   - Should mention how the team established control, reacted to setbacks, and finished the match.

8. **Tactical notes** (optional):
   - Include any notable substitutions, formation changes, or patterns of play clearly supported by events.
   - If discussing coaching decisions or tactical changes, use the manager's name from the match context when available (e.g., "Manager [Name]'s tactical switch" rather than generic "coaching staff").
   - When relevant, you may reference the venue name (e.g., "at [Venue Name]") for context, but only if it adds value to the narrative.

9. **Tweets (optional)**:
  - If tweets exist in the evidence, select up to 2 that add context to key plays or shots.
  - Record only a neutral factual/contextual extraction in the original language; do not reproduce or quote the tweet.
  - Do not imitate the reporter's distinctive wording or writing style.
  - Include source metadata and make an explicit suitability decision for each selected item.

10. **Player of the Match reference** is **not needed in Step 1** (Step 2 will use ratings).

11. **Market & Pressure research** (additional analytical layer - does not replace anything above):

    This section exists to help you connect three questions: **What was expected? What happened? How did it happen?**
    The evidence for this is provided as \`market_context\` (pre-match odds, already reduced to a market
    consensus by the backend) and \`pressure_context\` (Pressure Index, already reduced to deterministic
    summaries by the backend - you are never given raw odds rows or raw minute-by-minute pressure data).

    - If \`market_context.available\` is true, use \`focused_team_expectation\`, \`favourite_strength\` and the
      probabilities to describe what the market expected in plain language (e.g. "the market strongly
      favoured ${teamFocus}" or "bookmakers rated this an even contest").
    - If \`pressure_context.available\` is true, use \`overall_balance\`, \`sustained_pressure_periods\`,
      \`pressure_around_goals\` and \`pressure_after_leading\` to describe how the match unfolded dynamically -
      who applied sustained pressure, when, and whether pressure was building around the goals that were
      scored.
    - Combine the two with the actual result to produce a short, evidence-based research finding about
      whether the result matched, exceeded, or defied expectations, and whether the match dynamics support
      or complicate that reading. Examples of the kind of finding this can produce (illustrative only -
      do not force one of these onto data that doesn't support it, and do not treat this list as exhaustive
      or mandatory): expected victory, unexpected victory, significant upset, surprisingly competitive
      match, dominant favourite victory, narrow favourite victory, underdog victory under sustained
      pressure, underdog victory achieved while also applying strong pressure, result that broadly matched
      expectations. If none of these fit, write a brief custom description instead - do not force a label.
    - **Critical constraint**: Pressure Index measures relative match dynamics, not team quality or
      deservedness. Do NOT conclude that higher Pressure Index means "the better team" or "the deserved
      winner". A valid interpretation is descriptive ("the underdog won despite spending long periods
      under pressure"); an unsupported interpretation would be evaluative ("the favourite deserved to win
      because its Pressure Index was higher") unless other evidence (events, stats, ratings) independently
      supports that conclusion.
    - If \`market_context.available\` is false and/or \`pressure_context.available\` is false, do not
      fabricate the missing side - base \`expectation_vs_outcome\` only on what is available, and use
      "insufficient_data" as the classification if neither is available.

---

OUTPUT FORMAT (strict JSON)

Return ONLY a JSON object with the following structure:

{
  "first_half": {
    "summary": "string (2–4 sentences describing first-half events and flow)",
    "key_moments": ["string (minute – description)"],
    "momentum": "home or away"
  },
  "second_half": {
    "summary": "string (2–4 sentences describing second-half events and flow)",
    "key_moments": ["string (minute – description)"],
    "momentum": "home or away"
  },
  "decisive_moment": {
    "minute": number,
    "description": "string",
    "why_decisive": "string"
  },
  "overall_story": "string (2–3 sentences summarizing the match narrative)",
  "momentum_shifts": ["string (describe temporary swings in control)"],
  "selected_tweets": [
    {
      "tweet_id": "string or null",
      "source": {
        "author_name": "string or null (source author name from input)",
        "handle": "string or null (source Twitter handle/account from input)",
        "original_post_url": "string or null (original post URL from input)"
      },
      "original_language": "string or null (language code from input)",
      "factual_context": "string (neutral extraction of the underlying factual/contextual information, in the tweet's original language; do not quote or echo distinctive wording)",
      "confidence": "high, medium, or low",
      "relevance": "high, medium, or low",
      "suitable_for_report": "boolean",
      "why_selected": "string (reason - e.g., 'provides shot detail for Larin goal', 'tactical insight on pressing')"
    }
  ],
  "tactical_notes": ["string (optional, substitutions, formations, patterns of play)"],
  "market_and_pressure_research": {
    "market_context": {
      "available": boolean,
      "favourite": "home or away or none or null if unavailable",
      "favourite_strength": "strong, slight, toss_up, or null if unavailable",
      "focused_team_expectation": "favourite, underdog, evenly_matched, or null if unavailable",
      "summary": "string - one factual sentence describing pre-match market expectation, or null if unavailable"
    },
    "pressure_context": {
      "available": boolean,
      "summary": "string - one factual sentence describing overall pressure dynamics, or null if unavailable",
      "notable_periods": ["string - e.g. '58-74: sustained pressure from the away side'"],
      "goal_context": ["string - e.g. '61' goal followed 10 minutes of sustained pressure from the scoring team'"]
    },
    "expectation_vs_outcome": {
      "classification": "string - a short research finding (see guidance above), or 'insufficient_data' if both market_context and pressure_context are unavailable",
      "explanation": "string (1-3 sentences) - the reasoning behind the classification, citing specific market and/or pressure evidence. This is analytical, not polished prose - Step 2 will do the writing."
    }
  }
}

---

NOTES FOR THE MODEL

- Make first-half and second-half summaries rich enough to generate a **full report in Step 2**.
- Include only factual, supported context. Do **not** exaggerate a goal as a "screamer" or a "magnificent strike" unless supported by tweet context.
- If tweets exist, integrate only their neutral factual/contextual extractions into key moments or tactical notes as context. Do not reproduce tweet wording, distinctive phrases, sentence structure, metaphors, or writing style.
- Ensure JSON is fully populated so Step 2 can output a 700–900 word narrative.
- Tweet context must remain in the tweet's original language, but must be freshly expressed and neutral rather than copied or stylistically imitated.
- \`market_and_pressure_research\` is additional analytical context, not a replacement for anything above.
  Never state or imply that a higher Pressure Index share makes a team "better" or "deserving" - it
  describes match dynamics only, not quality.

TARGET WORD COUNT FOR STEP 2: 700–900 words

Return ONLY valid JSON. Do NOT include explanations, comments, or markdown formatting.
`.trim();
}

module.exports = {
  interpretMatch
};
