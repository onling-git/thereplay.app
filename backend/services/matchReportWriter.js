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
  const author = t.author || 'Reporter';
  return `${i + 1}. Author: ${author}\n   Tweet: "${t.text}"\n   Context: ${t.why_selected}`;
}).join('\n\n')}

IMPORTANT TWEET INTEGRATION RULES:
- All tweets are from CREDIBLE REPORTERS, not fans
- Attribution: Use "As noted by [reporter name] on X" or "reported by [reporter name]"
- NEVER use: "supporters noted", "fans commented", "one fan said"
- Extract ALL action details: foot used, shot direction/placement, pass buildup, type of finish, movement
- Integrate these details naturally into your narrative at the exact moment they describe
- Position tweet content where it belongs chronologically (e.g., at the goal it describes)

EXAMPLES:
❌ BAD: "Supporters noted how Larin capitalized on a loose pass..."
✅ GOOD: "As noted by Alfie House on X, Larin intercepted a loose pass from O'Brien, sprinted into the box, and finished across the goal into the top corner, restoring Southampton's two-goal lead."

❌ BAD: "Larin scored" (generic, no detail)
✅ GOOD: "Larin capitalized on a defensive error, racing into the box before lifting a composed right-footed finish across goal into the top corner (reported by Alfie House)."

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

1. FOLLOW THE NARRATIVE STRUCTURE
   - Use the "overall_story" as your guiding thread
   - Build paragraphs around first_half → second_half → decisive_moment
   - Reference momentum_shifts naturally

2. EVIDENCE-FIRST
   - Do NOT invent shot quality ("rifled", "curled", "stunning")
   - Use: "finished from close range", "scored from inside the box"
   - Do NOT add crowd, emotions, or weather
   - If tweets exist, use them to add detail to goals/moments (paraphrased, not verbatim)

3. TERMINOLOGY RULES (STRICT - DO NOT DEVIATE):
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

4. REFEREE USAGE (OPTIONAL - USE ONLY WHEN EVIDENCE SUPPORTS):
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

5. INTEGRATE TWEETS NATURALLY (if available)
   - ALL tweets are from credible reporters, NOT fans
   - Attribution: "As noted by [reporter name] on X" or "(reported by [reporter name])"
   - Extract ALL details: foot, shot placement, movement, buildup, defensive context
   - Position tweet content at the exact moment in the narrative (e.g., at the goal it describes)
   - NEVER quote verbatim - paraphrase with full detail
   - Example: "As noted by Alfie House on X, Larin intercepted a loose pass from O'Brien, sprinted into the box, and finished with a right-footed shot across goal into the top corner"

6. NATURAL FLOW
   - Write chronologically but narratively (not a list)
   - Use transitions: "grew into the game", "responded well", "came under pressure"
   - 3-5 paragraphs, 70-120 words each

7. PLAYER OF THE MATCH
   - MUST use the player and rating provided above
   - Justify using events and performance from evidence

8. KEY MOMENTS
   - Chronological list (minute + event)
   - Major moments only (goals, red cards, decisive subs)

9. COMMENTARY
   - 3-5 analytical paragraphs
   - Focus on: performance, turning points, game management
   - Evidence-based observations only
   - When discussing tactical decisions or substitutions, use the manager's name if available (e.g., "Manager [Name]'s tactical switch" rather than "the coaching staff")
   - When relevant, you may reference the venue name for context (e.g., "at Bramall Lane"), but only if it adds value to the narrative

---

OUTPUT (strict JSON):

{
  "headline": "Match result + competition context from ${teamFocus}'s perspective",
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
  "commentary": [
    "Analytical paragraph 1",
    "Analytical paragraph 2",
    "Analytical paragraph 3"
  ],
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
