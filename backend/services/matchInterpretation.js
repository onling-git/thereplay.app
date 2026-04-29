// services/matchInterpretation.js
// STEP 1: Fast interpretation of raw match data into structured narrative

const { client } = require('../utils/openai');

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
      text: t.text,
      author: t.author?.name || t.author?.userName,
      sentiment: t.analysis?.sentiment,
      engagement: (t.likeCount || 0) + (t.retweetCount || 0)
    }))
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
   - Reference tweets only if explicitly available, as context.

5. Identify **decisive moment**:
   - Minute, description, and why it was decisive.
   - Optionally reference tweet if available (use "selected_tweets" for this).

6. Identify **momentum shifts**:
   - List moments where the flow of the game changed (team reduced deficit, scored to regain lead, etc.).

7. **Overall story**:
   - 2–3 sentences summarizing the match narrative.

8. **Select tweets** (max 2-3):
   - Choose tweets that add valuable ACTION DETAILS (not just reactions/emotions)
   - Prefer tweets describing: goals (foot, placement, buildup), tactical observations, match-turning moments
   - Look for tweets with specific details like: shot placement, player movement, pass sequences, defensive errors
   - Include exact tweet text verbatim, author name, and explain why_selected
   - Only select tweets from credible reporters that will enhance the final report with factual detail
   - Should mention how the team established control, reacted to setbacks, and finished the match.

8. **Tactical notes** (optional):
   - Include any notable substitutions, formation changes, or patterns of play clearly supported by events.
   - If discussing coaching decisions or tactical changes, use the manager's name from the match context when available (e.g., "Manager [Name]'s tactical switch" rather than generic "coaching staff").
   - When relevant, you may reference the venue name (e.g., "at [Venue Name]") for context, but only if it adds value to the narrative.

9. **Tweets (optional)**:
   - If tweets exist in the evidence, select up to 2 that add context to key plays or shots.
   - Do not fabricate quotes. Include them verbatim.

10. **Player of the Match reference** is **not needed in Step 1** (Step 2 will use ratings).

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
      "text": "string (exact tweet text verbatim)",
      "author": "string (reporter name from tweet author)",
      "why_selected": "string (reason - e.g., 'provides shot detail for Larin goal', 'tactical insight on pressing')"
    }
  ],
  "tactical_notes": ["string (optional, substitutions, formations, patterns of play)"]
}

---

NOTES FOR THE MODEL

- Make first-half and second-half summaries rich enough to generate a **full report in Step 2**.
- Include only factual, supported context. Do **not** exaggerate a goal as a "screamer" or a "magnificent strike" unless supported by tweet context.
- If tweets exist, integrate them into key moments or tactical notes as context, never as facts.
- Ensure JSON is fully populated so Step 2 can output a 700–900 word narrative.

TARGET WORD COUNT FOR STEP 2: 700–900 words

Return ONLY valid JSON. Do NOT include explanations, comments, or markdown formatting.
`.trim();
}

module.exports = {
  interpretMatch
};
