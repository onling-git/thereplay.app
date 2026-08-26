// services/matchInterpretation.js
// STEP 1: Fast interpretation of raw match data into structured narrative

const { client } = require('../utils/openai');

const RUN1_PROMPT_VERSION = 'run1-2026-08-24';

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
  competitionStage = 'Unknown',
  trace = null
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
        const eventType = (e.type || '').toLowerCase().replace(/[\s-]/g, '_');
        return ['goal', 'owngoal', 'own_goal', 'penalty', 'penalty_goal', 'penalty_shootout_goal', 'yellowcard', 'redcard', 'substitution'].includes(eventType);
      })
      .slice(0, 50)
      .map(e => ({
        event_id: e.id || null,
        minute: e.minute,
        extra_minute: e.extra_minute,
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
  const model = process.env.INTERPRETATION_MODEL || 'gpt-4o-mini';
  const systemPrompt = 'You are a match analyst extracting narrative structure from match data. Return only JSON.';
  const runStartedAt = new Date();

  if (trace) {
    trace.prompt_version = RUN1_PROMPT_VERSION;
    trace.prompt_hash = require('crypto').createHash('sha256').update(prompt).digest('hex');
    trace.model = model;
    trace.system_prompt = systemPrompt;
    trace.started_at = runStartedAt;
    trace.input_snapshot = evidence;
    trace.prompt = prompt;
  }

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3, // Low temperature for consistent structure
    max_tokens: 3000,
    response_format: { type: 'json_object' } // Force JSON output
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('No interpretation output from model');
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

  interpretation = normalizeSocialContext(interpretation, tweets);

  // Add metadata
  interpretation.generated_at = new Date().toISOString();
  interpretation.model = model;

  if (trace) {
    trace.completed_at = new Date();
    trace.output = interpretation;
  }

  return interpretation;
}

// Keep only useful, source-linked observations in the canonical Run 1 output.
function normalizeSocialContext(interpretation, tweets = []) {
  const candidates = Array.isArray(interpretation.social_context)
    ? interpretation.social_context
    : (Array.isArray(interpretation.selected_tweets) ? interpretation.selected_tweets : []);
  const seen = new Set();
  const socialContext = [];

  for (const candidate of candidates) {
    const tweetId = candidate.tweet_id || null;
    if (tweetId && seen.has(String(tweetId))) continue;
    if (tweetId) seen.add(String(tweetId));

    const factualContext = candidate.factual_context || candidate.observation || null;
    const reason = candidate.reason || candidate.why_selected || 'No inclusion or exclusion reason provided';
    const containsOpinionLanguage = /\b(probably|deserved|clinical|crucial|resilient|resilience|lovely|brilliant|excellent|poor)\b/i.test(factualContext || '');
    const sourceTweet = tweets.find(tweet => String(tweet.tweet_id) === String(tweetId));
    const sourceText = sourceTweet?.text || '';
    const containsObservableDetail = /\b(pass|shot|finish|finished|block|chance|cross|tackle|defend|pressure|build-up|movement|save|header|penalty|intercept|run into space)\b/i.test(sourceText);
    const simpleAlertSource = sourceText.length > 0 && sourceText.length < 100 && !containsObservableDetail;
    const opinionOnlySource = sourceText.length > 0 && !containsObservableDetail &&
      /\b(best|signing|three in three|hell of|boost|brilliant|great|lovely|clinical)\b/i.test(sourceText);
    const observationType = containsOpinionLanguage
      ? 'mixed'
      : ((opinionOnlySource || simpleAlertSource) ? 'opinion' : (candidate.observation_type || 'fact'));
    socialContext.push({
      tweet_id: tweetId,
      source: {
        author_name: candidate.source?.author_name || candidate.author || null,
        handle: candidate.source?.handle || null,
        publication: candidate.source?.publication || null,
        original_post_url: candidate.source?.original_post_url || null
      },
      original_language: candidate.original_language || null,
      relevant_match_event: candidate.relevant_match_event || null,
      observation_type: observationType,
      factual_context: factualContext,
      adds_information_beyond_structured_data: candidate.adds_information_beyond_structured_data === true,
      confidence: candidate.confidence || 'low',
      relevance: candidate.relevance || 'low',
      suitable_for_report: candidate.suitable_for_report === true &&
        candidate.adds_information_beyond_structured_data === true &&
          observationType === 'fact' &&
          !opinionOnlySource &&
          !simpleAlertSource,
        reason: containsOpinionLanguage || opinionOnlySource || simpleAlertSource
        ? `${reason}; contains unsupported evaluative or opinion language`
        : reason
    });
  }

  interpretation.social_context = socialContext
    .filter(source => source.suitable_for_report)
    .slice(0, 3);

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
STEP 1 PROMPT – Extract Match Evidence and Context (JSON)

You are a professional football journalist tasked with analyzing match events to create a structured, evidence-based narrative for ${teamFocus}.

Your job in Step 1 is to establish what the evidence says. Read the raw match data (events, goals, cards, substitutions, lineups, player ratings, match stats, and reporter tweets) and output structured evidence and context for Step 2. Run 1 must not write the final article, optimise for entertainment, or imitate journalism.

IMPORTANT: Step 1 **does not write the final report**. Only produce the structured JSON.

---

MATCH CONTEXT:
${teamFocus} (playing as ${focused_side}) ${resultText} ${scoreText}
Competition: ${evidence.match.competition} - ${evidence.match.stage}

INPUT DATA:
${JSON.stringify(evidence, null, 2)}

---

REQUIREMENTS

1. Evidence-stage rules:
  - Facts must come from authoritative match data or a clearly identified supporting source.
  - Separate FACT from INTERPRETATION in the structured fields.
  - Never invent narrative significance. If evidence is insufficient, say so explicitly.
  - Do not repeat the same observation across fields unless it serves a different purpose.
  - Use specific observations instead of generic football language or cliches.
  - Do not write polished article prose or attempt to make the report entertaining.
  - Do not use social-media source wording as final article wording.
  - Do NOT invent goals, scorers, minutes, events, tactics, statistics, or quotes.

2. Match summary:
  - Provide 2–3 concise factual sentences explaining what actually happened.
  - Reconcile the summary with the complete final score in the match data.
  - Do not use generic praise, speculation, or unsupported significance.

3. Respect competition type:
   - **Cup competitions**: Use language like "progress," "advance," "crash out," "knockout progression." NEVER mention points, table position, or league standings.
   - **League competitions**: You may mention table impact if supported by evidence, but avoid inventing stakes.
   - Always include the competition name and stage (from match context above).

4. First-half and second-half stories:
  - Explain important progression and meaningful changes in each half; do not simply list events.
  - Use statistics in the second-half story only where they genuinely explain a change.
  - Do not infer dominance from possession or one statistic alone.
  - Record factual observations separately from interpretation and evidence basis.

5. Turning point:
  - Identify the most meaningful turning point or period and explain why it changed the match.
  - If there is no clear turning point, say so.
  - Do not automatically call a late goal the turning point merely because it was late.

6. Decisive sequence:
  - Explain how the match was ultimately decided and account for what happened afterwards.
  - Distinguish restoring a lead, extending a lead, equalising, a late winner, and sealing the final result.

7. Statistical context:
  - Select only statistics that genuinely explain something about the match.
  - State what each selected statistic tells us; do not dump values.

8. Market context:
  - Use available pre-match odds to establish expectations where relevant.
  - Odds describe market expectations, not what should have happened.
  - Do not call a result surprising, unexpected, or a shock unless the available evidence supports it.

9. Pressure context:
  - Use Pressure Index data where it adds meaningful insight into the manner of the match.
  - State what the data supports and do not infer tactical conclusions from Pressure Index alone.

10. Player of the Match context:
  - Explain why the selected player stands out using available evidence.
  - Do not simply repeat the rating or invent contributions.

11. Headline angle:
  - Identify the factual/narrative angle that is genuinely most interesting.
  - Do not write the final headline.
  - Explicitly classify the angle where supported: late winner, late equaliser, restored lead, final sealing goal, comeback, comfortable victory, narrow victory, or no clear angle.
  - A goal is not a late winner or final sealing goal if another confirmed scoring event follows it. Describe the complete late scoring sequence instead.

12. Narrative warnings:
  - Explicitly flag unsupported descriptions Run 2 must not use.
  - Flag comeback unless the eventual winner was behind; winner unless no later goal changes the final result; dominant without evidence beyond possession; tactical masterstroke without specific evidence; unexpected/shock without supported expectations; and crucial/pivotal/decisive when not established.
  - Flag unsupported claims about league position, promotion ambitions, or other stakes.

13. Scoring evidence:
  - Preserve every confirmed scoring event and its score state before and after.
    - Include converted penalties and own goals in scoring_evidence; never treat the ordinary goal list as complete if the timeline contains another scoring event.
    - Use event_id from the input when available rather than inventing one.
  - Do not claim a player scored twice unless the authoritative input contains two scoring events for that player.
  - If source data is incomplete or contradictory, record the uncertainty in match_facts.data_quality and narrative_warnings rather than guessing.

14. Match progression:
  - Record only meaningful phase changes and defensible relationships between evidence.
  - Do not turn the phases into polished article prose.
15. Supporting events:
   - Include goals, penalties, red cards, yellow cards, major chances.
   - Provide minute, player, and context (e.g., "61' – Cyle Larin scored for Southampton to restore two-goal lead").
  - Explain why each selected moment mattered to the score, momentum, pressure, tactics, or result when the evidence supports it; do not merely repeat the event.
   - Reference tweets only if explicitly available, as context.

16. **Evaluate social sources as additional match context** (max 2-3 useful sources):
   - Choose tweets that add valuable ACTION DETAILS (not just reactions/emotions)
   - Prefer tweets describing: goals (foot, placement, buildup), tactical observations, match-turning moments
   - Look for tweets with specific details like: shot placement, player movement, pass sequences, defensive errors
  - Treat each post as a source of possible additional context, never as prose to reproduce.
  - Preserve the source ID, author, handle/account, publication where available, and original URL from the input.
  - Link each useful observation to the relevant match event, period, or situation using authoritative event data where possible.
  - Extract and report the underlying factual or contextual information contained in the source in original language.
  - Do NOT ask yourself to rewrite the tweet or produce a lightly edited version of it.
  - Do NOT reproduce the tweet's wording, distinctive phrases, sentence structure, metaphors, or writing style
  - Do NOT include the full tweet text or quote any part of it
  - Strip unsupported evaluative or promotional language such as "lovely", "crucial", "clinical", or "resilient"; retain the observable action and its supported match consequence instead.
  - Preserve the source author name, Twitter handle/account, and original post URL from the input
  - Assign confidence (high, medium, or low) to your factual extraction
  - Assign relevance (high, medium, or low) to the report's match narrative
  - If a source says a block or chance was "crucial" or "shows resilience", classify that as opinion or mixed and extract only the observable action (for example, "Wood made a sliding block that denied a Stoke chance").
  - State whether the observation adds meaningful information beyond structured match data.
  - Set suitable_for_report to true only when the observation is credible, match-relevant, and adds meaningful supported context beyond structured data; otherwise set it to false.
  - Reject simple score updates, generic reactions, celebrations, unsupported opinions, and repeated structured information.
  - Treat a source as adding information when it supplies supported detail absent from the event record, such as build-up, player movement, defensive context, shot placement, or finish location; a source is not redundant merely because it describes a goal already recorded.
  - Example of the required level of transformation: source detail about a splitting Downes pass releasing Larin behind the defence and a finish underneath the goalkeeper becomes "Downes' pass released Larin into space behind the Stoke defence, with Azaz involved in the build-up. Larin finished underneath the goalkeeper." Do not retain the source's adjectives or sentence structure.
  - Provide a reason for inclusion or exclusion for every supplied source.
  - Only select tweets from credible reporters that will enhance the final report with factual detail
   - Should mention how the team established control, reacted to setbacks, and finished the match.

17. **Tactical context** (optional):
   - Include any notable substitutions, formation changes, or patterns of play clearly supported by events.
   - If discussing coaching decisions or tactical changes, use the manager's name from the match context when available (e.g., "Manager [Name]'s tactical switch" rather than generic "coaching staff").
   - When relevant, you may reference the venue name (e.g., "at [Venue Name]") for context, but only if it adds value to the narrative.

18. **Source evaluation (optional)**:
  - If tweets exist in the evidence, select up to 2 that add context to key plays or shots.
  - Record only a neutral factual/contextual extraction in the original language; do not reproduce or quote the tweet.
  - Do not imitate the reporter's distinctive wording or writing style.
  - Include source metadata and make an explicit suitability decision for each selected item.

19. **Player context**: populate only player_context using available evidence; do not invent contributions.

20. **Market and Pressure evidence** (additional analytical layer):

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
  "match_facts": {
    "teams": { "home": "string", "away": "string" },
    "factual_summary": "2-3 concise factual sentences, not polished article prose",
    "final_score": { "home": number, "away": number },
    "competition": "string",
    "stage": "string or null",
    "result_for_focused_team": "won, lost, drew, or unknown",
    "data_quality": { "status": "complete, partial, or insufficient", "warnings": ["string"] }
  },
  "scoring_evidence": [
    {
      "event_id": "string or null",
      "minute": number,
      "added_minute": "number or null",
      "team": "home or away",
      "scorer": "string",
      "score_before": "string or null",
      "score_after": "string or null",
      "event_type": "goal, own_goal, penalty, or other",
      "structured_details": { "assist": "string or null", "build_up": "string or null", "shot_type": "string or null", "finish_detail": "string or null" },
      "supporting_context": ["source-linked factual observations"],
      "evidence_status": "confirmed, partial, or uncertain"
    }
  ],
  "match_progression": {
    "phases": [
      { "period": "first_half or second_half", "facts": ["specific observations"], "supported_changes": ["changes in score, pressure, or match state"], "evidence_basis": ["event/statistic/source references"] }
    ],
    "relationships": ["only defensible relationships between events and supporting evidence"],
    "uncertainties": ["incomplete or contradictory evidence"]
  },
  "statistical_evidence": [
    { "name": "string", "value": "number or string", "observation": "what was observed", "what_it_explains": "why it helps explain the match", "use_in_report": boolean, "confidence": "high, medium, or low" }
  ],
  "pressure_evidence": {
    "available": boolean,
    "useful_observations": [ { "period": "string", "observation": "supported pressure observation", "relationship_to_match": "supported relationship or null", "evidence_basis": ["pressure summary references"], "confidence": "high, medium, or low" } ],
    "unsupported_conclusions": ["claims Pressure Index cannot establish"]
  },
  "market_evidence": {
    "available": boolean,
    "pre_match_expectation": { "focused_team": "string or null", "win_probability": "number or null", "expectation_level": "strong_favourite, slight_favourite, even, underdog, or null" },
    "supported_observation": "string or null",
    "useful_context": "string or null",
    "use_in_report": boolean,
    "confidence": "high, medium, or low"
  },
  "social_context": [
    {
      "tweet_id": "string or null",
      "source": { "author_name": "string or null", "handle": "string or null", "original_post_url": "string or null" },
      "publication": "string or null",
      "relevant_match_event": "specific event, period, or situation, or null",
      "observation_type": "fact, opinion, or mixed",
      "factual_context": "underlying factual/contextual information in original language, expressed freshly and neutrally",
      "adds_information_beyond_structured_data": "boolean",
      "confidence": "high, medium, or low",
      "relevance": "high, medium, or low",
      "suitable_for_report": boolean,
      "reason": "specific reason for inclusion or exclusion"
    }
  ],
  "player_context": {
    "player": "string or null",
    "rating": "number or null",
    "evidence": ["available evidence explaining why the player stands out"],
    "supported_reason": "supported explanation or null",
    "confidence": "high, medium, or low"
  },
  "story_opportunities": [
    { "opportunity": "possible evidence-supported story angle, not a headline", "supporting_evidence": ["references to fields or events"], "why_it_may_matter": "supported editorial relevance", "strength": "high, medium, or low", "use_in_report": boolean, "risks": ["claims to avoid"] }
  ],
  "narrative_warnings": [
    {
      "claim": "comeback, winner, dominant, tactical masterstroke, unexpected, shock, crucial, pivotal, decisive, league position, promotion ambitions, or another claim",
      "status": "prohibited, unsupported, or permitted_with_evidence",
      "reason": "specific evidence-based reason"
    }
  ],
  "evidence_richness": { "level": "low, medium, or high", "usable_story_elements": ["specific evidence elements Run 2 may use"] }
}

---

NOTES FOR THE MODEL

- Make the evidence and context specific enough for Step 2 to write from, but do not write the final article.
- Include only factual, supported context. Do **not** exaggerate a goal as a "screamer" or a "magnificent strike" unless supported by tweet context.
- If tweets exist, integrate only their neutral factual/contextual extractions into key moments or tactical notes as context. Do not reproduce tweet wording, distinctive phrases, sentence structure, metaphors, or writing style.
- Ensure JSON is fully populated so Step 2 can output a 700–900 word narrative.
- Tweet context must remain in the tweet's original language, but must be freshly expressed and neutral rather than copied or stylistically imitated.
- \`market_and_pressure_research\` is additional analytical context, not a replacement for anything above.
  Never state or imply that a higher Pressure Index share makes a team "better" or "deserving" - it
  describes match dynamics only, not quality.

Return ONLY valid JSON. Do NOT include explanations, comments, or markdown formatting.
`.trim();
}

module.exports = {
  interpretMatch
};
