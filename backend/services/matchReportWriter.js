// services/matchReportWriter.js
// STEP 2: Generate full match report using interpretation + raw data

const { client } = require('../utils/openai');

/**
 * Generate a complete match report using the narrative interpretation.
 * Uses a detailed prompt optimized for quality writing.
 * 
 * @param {Object} params - Input parameters
 * @param {Object} params.interpretation - Output from Step 1
 * @param {Object} params.match - Raw match data
 * @param {String} params.teamFocus - Name of the focused team
 * @param {Object} params.potm - Player of the match candidate {player, rating, reason}
 * @param {Object} params.authoritativeMatchFacts - Reconciled score and goal ledger from match data
 * @param {Boolean} params.isCup - Whether this is a cup competition
 * @param {String} params.competitionName - Name of competition
 * @param {String} params.competitionStage - Stage/round name
 * @returns {Promise<Object>} Full match report JSON
 */
async function writeMatchReport({
  interpretation,
  match,
  teamFocus,
  potm,
  authoritativeMatchFacts,
  isCup = false,
  competitionName = 'Unknown',
  competitionStage = 'Unknown'
}) {
  const events = match.events || [];
  const ratings = match.player_ratings || [];
  const stats = match.statistics || match.stats || {};
  const lineup = match.lineup || {};
  const coaches = match.coaches || [];
  
  // Extract coach/manager names for context
  const homeCoach = coaches.find(c => c.meta?.participant_id === match.teams?.home?.team_id);
  const awayCoach = coaches.find(c => c.meta?.participant_id === match.teams?.away?.team_id);
  const focusedCoachName = (teamFocus === match.home_team || teamFocus === match.teams?.home?.team_name) 
    ? (homeCoach ? (homeCoach.common_name || homeCoach.name || homeCoach.display_name) : null)
    : (awayCoach ? (awayCoach.common_name || awayCoach.name || awayCoach.display_name) : null);

  // Build comprehensive evidence
  const evidence = {
    match_summary: {
      match_id: match.match_id,
      date: match.date,
      home_team: match.home_team,
      away_team: match.away_team,
      score: match.score,
      competition: {
        name: competitionName,
        stage: competitionStage,
        is_cup: isCup,
        affects_league: !isCup
      },
      manager: focusedCoachName,
      venue: match.match_info?.venue?.name || null,
      referee: match.match_info?.referee?.common_name || match.match_info?.referee?.name || null
    },
    authoritative_match_facts: authoritativeMatchFacts,
    // The narrative interpretation (from Step 1)
    narrative: interpretation,
    // Events for detail
    events: events.slice(0, 100).map(e => ({
      minute: e.minute,
      type: e.type,
      player: e.player,
      info: e.info,
      result: e.result
    })),
    // Stats for context
    statistics: stats,
    // Player ratings
    player_ratings: ratings.slice(0, 50).map(r => ({
      player: r.player || r.player_name,
      rating: r.rating,
      team_id: r.team_id
    })),
    // Lineup for player context
    lineup: {
      home: (lineup.home || []).slice(0, 15).map(p => ({
        player_name: p.player_name,
        position_id: p.position_id,
        rating: p.rating
      })),
      away: (lineup.away || []).slice(0, 15).map(p => ({
        player_name: p.player_name,
        position_id: p.position_id,
        rating: p.rating
      }))
    }
  };

  const prompt = buildReportPrompt(evidence, teamFocus, potm, isCup);

  const completion = await client.chat.completions.create({
    model: process.env.REPORT_MODEL || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a professional football journalist writing team-centric match reports for UK audiences. Write in the style of Sky Sports or BBC Sport. Return only JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.4, // Slightly higher for natural writing
    max_tokens: 2500,
    response_format: { type: 'json_object' }
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('No report output from model');

  let report;
  try {
    report = JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      report = JSON.parse(match[0]);
    } else {
      throw new Error('Invalid report JSON output');
    }
  }

  // Validate required fields
  if (!report.headline || !report.summary_paragraphs || !report.player_of_the_match) {
    throw new Error('Report missing required fields');
  }

  // Add metadata
  report.meta = {
    generated_by: process.env.REPORT_MODEL || 'gpt-4o-mini',
    generated_at: new Date().toISOString(),
    pipeline_version: '2.0',
    interpretation_model: interpretation.model
  };

  return report;
}

/**
 * Build the report writing prompt
 */
function buildReportPrompt(evidence, teamFocus, potm, isCup) {
  const competitionGuidance = isCup
    ? `
🚨 CUP COMPETITION RULES:
- This is a CUP match (${evidence.match_summary.competition.name})
- NEVER mention: "three points", "league position", "table", "standings"
- USE: "progress", "advance", "knockout victory", "cup run"
- Mention the stage: "${evidence.match_summary.competition.stage}"
`
    : `
LEAGUE COMPETITION CONTEXT:
- This is a LEAGUE match
- You MAY mention: "three points", "league position", "table implications"
`;

  const tweetGuidance = (evidence.narrative.selected_tweets && evidence.narrative.selected_tweets.length > 0)
    ? `
SELECTED TWEETS (integrate naturally, DO NOT quote verbatim):
${evidence.narrative.selected_tweets.map((t, i) => {
  const author = t.source?.author_name || 'Reporter';
  const handle = t.source?.handle ? `@${t.source.handle.replace(/^@/, '')}` : 'unknown';
  return `${i + 1}. Tweet ID: ${t.tweet_id || 'unknown'}\n   Source: ${author} (${handle})\n   Original post: ${t.source?.original_post_url || 'URL unavailable'}\n   Factual/contextual extraction: "${t.factual_context || 'No factual context provided'}"\n   Confidence: ${t.confidence || 'unknown'}\n   Relevance: ${t.relevance || 'unknown'}\n   Suitable for report: ${t.suitable_for_report === true ? 'yes' : 'no'}\n   Context: ${t.why_selected || 'No reason provided'}`;
}).join('\n\n')}

IMPORTANT TWEET INTEGRATION RULES:
- All tweets are from CREDIBLE REPORTERS, not fans
- Use Run 1's extracted social context only when it materially improves the report with relevant factual or contextual detail.
- Integrate that context naturally into the match narrative at the moment it describes, rather than adding a separate social-media aside.
- Use only observations marked "Suitable for report: yes" and give greater weight to high-confidence, high-relevance observations.
- Preserve the extracted information's original language where useful, but express it in fresh, neutral wording.
- Do not quote, closely reproduce, or stylistically imitate the source's wording, distinctive phrases, sentence structure, metaphors, or writing style.
- Do not mention social media, X, reporters, or attribution merely for the sake of mentioning the source; include source attribution only when it adds meaningful credibility or context.
- Never let social context override authoritative match data such as official events, score, statistics, ratings, lineups, or other match records.
- When social context conflicts with authoritative match data, omit or qualify the social observation and follow the authoritative data.
- Position useful social context chronologically (e.g., alongside the goal or moment it describes).

DETAILS TO EXTRACT AND USE:
- Foot used (left-foot, right-foot, header)
- Shot placement (top corner, bottom corner, across goal, near post, far post)
- Shot style (curled, driven, lifted, placed, rifled, smashed) - only if tweet explicitly mentions
- Player movement (sprinted, raced, cut inside, drifted wide)
- Buildup play (intercepted pass, counterattack, worked space, received through ball)
- Defensive context (loose pass, error, pressure, positioning)
`
    : 'No tweets available. Do NOT mention social media, reporters, or X.';

  return `
Write a professional post-match report for ${teamFocus} supporters.

NARRATIVE STRUCTURE (from Step 1 analysis):
${JSON.stringify(evidence.narrative, null, 2)}

MATCH DATA:
${JSON.stringify(evidence.match_summary, null, 2)}

AUTHORITATIVE MATCH FACTS (source of truth):
${JSON.stringify(evidence.authoritative_match_facts, null, 2)}

Use the validated final score as the authoritative fact for the result. Use the goal ledger for scorer, team, and timing claims only where an event is present. If goal_events_reconciled is false or validation_warnings are present, the event feed is incomplete: report the authoritative score, do not infer missing goals, scorers, teams, or timings, and do not allow social context to fill those gaps or alter the score.

STATISTICS:
${JSON.stringify(evidence.statistics, null, 2)}

KEY EVENTS:
${JSON.stringify(evidence.events.filter(e => ['goal', 'yellowcard', 'redcard'].includes(e.type)), null, 2)}

PLAYER RATINGS (top performers):
${JSON.stringify(evidence.player_ratings.filter(r => r.rating >= 7.0), null, 2)}

PLAYER OF THE MATCH:
Player: ${potm.player || 'TBD'}
Rating: ${potm.rating || 'N/A'}
Reason: ${potm.reason || 'Highest-rated player'}

${competitionGuidance}

${tweetGuidance}

---

WRITING REQUIREMENTS:

1. HEADLINE
  - Make the headline specific to the genuinely interesting, evidence-supported aspect of this match, not just its result
  - Look first for a documented story such as a comeback, late equaliser or winner, decisive individual contribution, major swing in control, upset, costly card, unusual score progression, or meaningful competition consequence
  - Explain the angle accurately and avoid exaggeration, unexplained superlatives, and generic praise
  - Do not use the repetitive formula "${teamFocus} secure [adjective] victory over [opponent]" when the match evidence supports a more distinctive angle
  - Use that result-over-opponent formula only as a fallback when the available data does not reveal a genuinely interesting, supportable angle; keep it factual and restrained

2. FOLLOW THE NARRATIVE STRUCTURE
   - Use the "overall_story" as your guiding thread
   - Build paragraphs around first_half → second_half → decisive_moment
   - Reference momentum_shifts naturally
  - Integrate all useful match context and analysis directly into the main report paragraphs

3. EVIDENCE-FIRST
   - Do NOT invent shot quality ("rifled", "curled", "stunning")
   - Use: "finished from close range", "scored from inside the box"
   - Do NOT add crowd, emotions, or weather
  - If tweets exist, use only their neutral factual/contextual extractions to add detail to goals/moments; do not reproduce or stylistically imitate the source tweets
  - Run 1 social context is secondary evidence: authoritative match data always takes precedence
  - Every factual or evaluative claim must be supported by the match events, score progression, statistics, ratings, lineups, or approved social context
  - If the evidence does not support a claim, leave it out rather than filling the gap with conventional football language

4. EDITORIAL PRECISION
  - Avoid generic praise or stock phrases such as "showed character", "demonstrated resilience", "tactical masterstroke", "deserved victory", "clinical display", "professional performance", and "they wanted it more"
  - Do not use an evaluative phrase unless you immediately explain the specific evidence behind it; prefer the evidence itself over the label
  - For every major event, explain why it mattered to the match: how it changed the score, momentum, space, pressure, tactics, game state, or result
  - Do not merely restate that a goal, substitution, card, or chance occurred; connect it to its consequence when the available data supports one
  - Use precise descriptions of observable actions and match effects instead of emotional or promotional language

5. TERMINOLOGY RULES (STRICT - DO NOT DEVIATE):
   - ONLY use "opened the scoring" for the FIRST goal of the match (by either team)
   - ONLY use "doubled the lead" if a team goes from 1-goal lead to 2-goal lead (e.g., 1-0 → 2-0 or 2-1 → 3-1)
   - ONLY use "restored the lead" if a team HAD the lead, then CONCEDED to lose it, then SCORED AGAIN to regain it
     Example: Team A leads 1-0 → Team B equalises 1-1 → Team A scores 2-1 (this is "restored the lead")
   
   - If a team was BEHIND and goes AHEAD, use one of:
     * "completed the comeback"
     * "turned the game around"
     * "put them in front for the first time"
     * "gave them the lead"
     Example: Team A trails 0-1 → Team A scores 2-1 (this is NOT "restored the lead")
   
   - If a team equalises, use:
     * "levelled the score"
     * "equalised"
     * "drew level"
   
   - VERIFY the match score progression before using any phrase. Check who scored first.

6. REFEREE USAGE (OPTIONAL - USE ONLY WHEN EVIDENCE SUPPORTS):
   - The referee's name is available in match_summary (if provided): ${evidence.match_summary.referee || 'Not available'}
   - ONLY mention the referee when describing significant officiating decisions that are EXPLICITLY documented in the match events
   - Appropriate contexts: red cards, penalties awarded, penalty decisions, VAR reviews/overturns
   - Examples:
     * "Referee [Name] showed a red card to [Player]"
     * "Awarded a penalty after [Player] was fouled"
     * "[Name] pointed to the spot"
   - DO NOT mention the referee for:
     * General match control or performance
     * Yellow cards (unless part of a significant moment, e.g., second yellow leading to red)
     * Routine decisions
     * Speculation about decisions that could have been made
   - CRITICAL: If the event data doesn't explicitly show a penalty, VAR decision, or red card, DO NOT mention the referee
   - NEVER invent or assume referee decisions - only use what is clearly documented in the events

7. INTEGRATE TWEETS NATURALLY (if available)
  - Use Run 1's extracted social context only when it materially improves the match narrative
  - Integrate it into the relevant chronological passage in fresh, neutral wording, without creating a separate social-media section
  - Use only items marked suitable for the report, prioritising high-confidence and high-relevance observations
  - List the Tweet IDs you actually use in the article in used_social_source_ids; include no ID for an observation you do not use
  - Do not quote or closely reproduce the source, and do not imitate its distinctive wording or writing style
  - Do not mention social media, X, reporters, or attribution unless the source itself adds meaningful credibility or context
  - Never allow social context to override official match events, score, statistics, ratings, lineups, or other authoritative match data
  - If a social observation conflicts with authoritative match data, omit it or qualify it and follow the authoritative data

8. NATURAL FLOW
   - Write chronologically but narratively (not a list)
  - Use specific transitions that describe an evidenced change in control, territory, pressure, or game state
   - 3-5 paragraphs, 70-120 words each

9. PLAYER OF THE MATCH
   - MUST use the player and rating provided above
   - Justify using events and performance from evidence

10. KEY MOMENTS
   - Chronological list (minute + event)
   - Major moments only (goals, red cards, decisive subs)

11. MATCH CONTEXT / ANALYSIS
  - Integrate analysis into the main report paragraphs rather than producing a separate generic commentary section
  - Cover performance, turning points, game management, and relevant tactical decisions where supported by evidence
  - When discussing tactical decisions or substitutions, use the manager's name if available (e.g., "Manager [Name]'s tactical switch" rather than "the coaching staff")
  - When relevant, you may reference the venue name for context (e.g., "at Bramall Lane"), but only if it adds value to the narrative

12. MARKET & PRESSURE CONTEXT (use selectively, only if present in the narrative)
   - The narrative structure above may include a "market_and_pressure_research" field
     (pre-match market expectation and Pressure Index findings). Treat this as optional
     background, not a mandatory report element.
   - Only use it when it materially improves the reader's understanding of the result -
     e.g. the result was a significant upset, the underdog had to withstand or generated
     real pressure, or the scoreline understates/overstates how competitive the match was.
   - Do NOT mention it if the result and existing narrative already explain the match
     clearly (e.g. a strong favourite winning comfortably as expected needs no odds/pressure
     mention).
   - If used, express it through natural match analysis, not by naming the data source.
     Prefer "Palace were forced to withstand long spells of City pressure" over "The
     Pressure Index shows City had greater pressure." Never mention "bookmakers", "odds",
     "betting probabilities", "market expectations", or Pressure Index by name.
   - Avoid repetitive framing - do not default to phrases like "against the odds",
     "defied expectations", "despite being underdogs" every time this is used.
   - Do not overclaim: pressure/market data describes relative dynamics and pre-match
     expectation only - it does not prove which team was "better", "deserved" to win, or
     that a result was "lucky" or "flattering". Only state such conclusions if the rest of
     the evidence (events, stats, ratings) independently supports them.
   - If "market_and_pressure_research" is absent, unavailable, or marked
     "insufficient_data", say nothing about it - do not mention missing data, do not
     fabricate it, and write the report exactly as you would without this instruction.

---

OUTPUT (strict JSON):

{
  "headline": "A specific, evidence-supported headline reflecting the genuinely interesting aspect of the match; use a restrained result-over-opponent fallback only when the data provides no stronger angle",
  "summary_paragraphs": [
    "Opening + first half (70-120 words)",
    "Second half development (70-120 words)",
    "Decisive moment + conclusion (70-120 words)",
    "Optional 4th paragraph if needed",
    "Optional 5th paragraph if needed"
  ],
  "key_moments": [
    "5' - [Event description]",
    "34' - [Event description]"
  ],
  "used_social_source_ids": ["tweet_id values for social observations actually used in the article"],
  "player_of_the_match": {
    "player": "${potm.player || 'TBD'}",
    "reason": "Justification based on events and rating"
  },
  "sources": [
    "Match events",
    "Player ratings",
    "Other sources used"
  ]
}

Target length: 700-900 words total
No markdown. No extra text outside JSON.
`.trim();
}

module.exports = {
  writeMatchReport
};
