// services/matchReportWriter.js
// STEP 2: Generate full match report using interpretation + raw data

const { client } = require('../utils/openai');

const RUN2_PROMPT_VERSION = 'run2-evidence-writer-2026-08-24.2';

/**
 * Build the curated Run 2 evidence view directly from canonical Run 1 fields.
 * Additive only: not yet wired into buildReportPrompt().
 */
function buildCuratedRun1Evidence(interpretation) {
  const socialEvidence = (interpretation.social_context || [])
    .filter(source => source.suitable_for_report === true)
    .map(source => ({
      tweet_id: source.tweet_id,
      source: source.source,
      relevant_match_event: source.relevant_match_event,
      observation_type: source.observation_type,
      factual_context: source.factual_context,
      adds_information_beyond_structured_data: source.adds_information_beyond_structured_data,
      confidence: source.confidence,
      relevance: source.relevance,
      suitable_for_report: source.suitable_for_report,
      reason: source.reason
    }));

  return {
    match_evidence: {
      match_facts: interpretation.match_facts,
      scoring_evidence: interpretation.scoring_evidence,
      match_progression: interpretation.match_progression,
      statistical_evidence: interpretation.statistical_evidence,
      pressure_evidence: interpretation.pressure_evidence,
      market_evidence: interpretation.market_evidence,
      player_context: interpretation.player_context
    },
    social_evidence: socialEvidence,
    story_opportunities: interpretation.story_opportunities || [],
    narrative_warnings: interpretation.narrative_warnings || []
  };
}

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
  trace = null,
  isCup = false,
  competitionName = 'Unknown',
  competitionStage = 'Unknown'
}) {
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
    // The narrative interpretation (from Step 1) - legacy shape, unchanged, still drives the prompt.
    narrative: interpretation,
    // Additive, not yet consumed by the prompt: curated view of the canonical Run 1 fields for inspection/testing.
    curated: buildCuratedRun1Evidence(interpretation),
  };

  const prompt = buildReportPrompt(evidence, teamFocus, potm, isCup);
  const model = process.env.REPORT_MODEL || 'gpt-4o-mini';
  const systemPrompt = 'You are a precise football report writer. Turn the supplied structured evidence into concise, original journalism. Do not research beyond the supplied evidence. Return only JSON.';
  const runStartedAt = new Date();

  if (trace) {
    trace.prompt_version = RUN2_PROMPT_VERSION;
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

  for (let repairAttempt = 0; repairAttempt < 2; repairAttempt++) {
    const reportValidationIssues = validateGeneratedReport(report, authoritativeMatchFacts);
    if (reportValidationIssues.length === 0) break;
    report = await repairGeneratedReport({
      report,
      authoritativeMatchFacts,
      issues: reportValidationIssues,
      model,
      trace
    });
  }

  // Validate required fields
  if (!report.headline || !report.summary_paragraphs || !report.player_of_the_match) {
    throw new Error('Report missing required fields');
  }

  // Add metadata
  report.meta = {
    generated_by: model,
    generated_at: new Date().toISOString(),
    pipeline_version: '2.0',
    interpretation_model: interpretation.model
  };

  if (trace) {
    trace.completed_at = new Date();
    trace.output = report;
  }

  return report;
}

function validateGeneratedReport(report, authoritativeMatchFacts) {
  const issues = [];
  const reportText = JSON.stringify(report).toLowerCase();
  const finalScore = authoritativeMatchFacts?.final_score;
  const scoringEvents = authoritativeMatchFacts?.scoring_events || [];

  if (finalScore && !reportText.includes(`${finalScore.home}-${finalScore.away}`)) {
    issues.push(`The final score must be stated as ${finalScore.home}-${finalScore.away}.`);
  }

  const scorerCounts = scoringEvents.reduce((counts, event) => {
    const scorer = String(event.scorer || '').toLowerCase();
    if (scorer) counts[scorer] = (counts[scorer] || 0) + 1;
    return counts;
  }, {});
  for (const [scorer, count] of Object.entries(scorerCounts)) {
    if (count === 1 && new RegExp(`${escapeRegExp(scorer)}.{0,80}(two|twice|brace|second goal|goals)`, 'i').test(reportText)) {
      issues.push(`${scorer} is recorded as scoring once; remove any claim that they scored twice or scored multiple goals.`);
    }
  }

  if (/\b(table|promotion|league position|title challenge|strong season ahead)\b/i.test(reportText)) {
    issues.push('Remove unsupported claims about league position, promotion, title challenges, or season ambitions unless explicitly supported by Run 1 evidence.');
  }

  if (/\b(aspirations|campaign|all three points|resilience|character|tactical masterstroke|showcased|demonstrated|crucial|pivotal|thriller)\b/i.test(reportText)) {
    issues.push('Replace generic or unsupported editorial language with the specific supported match action and consequence. Remove unsupported league or season conclusions.');
  }

  if (/\blate goals\b/i.test(reportText) && scoringEvents.length > 0) {
    const lateScorers = scoringEvents.filter(event => event.minute >= 80);
    const distinctLateScorers = new Set(lateScorers.map(event => event.scorer));
    if (lateScorers.length < 2 || distinctLateScorers.size < 2) {
      issues.push('Do not describe the match as having late goals in the plural unless multiple distinct late scoring events support that wording.');
    }
  }

  if (/\bsecure\b.{0,30}\b(victory|win)\b.{0,30}\bover\b/i.test(report.headline || '')) {
    issues.push('Replace the generic secure victory over headline with a specific supported match angle.');
  }

  return issues;
}

async function repairGeneratedReport({ report, authoritativeMatchFacts, issues, model, trace }) {
  const repairPrompt = `
Correct the following draft report using only the authoritative facts and structured Run 1 evidence below.

AUTHORITATIVE FACTS:
${JSON.stringify(authoritativeMatchFacts, null, 2)}

DRAFT REPORT:
${JSON.stringify(report, null, 2)}

CORRECTIONS REQUIRED:
${issues.map(issue => `- ${issue}`).join('\n')}

Zero-tolerance language rules for the corrected output:
- Do not use "showcased", "demonstrated", "tactical acumen", "resilience", "character", "tactical masterstroke", "pivotal", "crucial", "vital", "impressive", "dominant", "statement", or "thriller" unless the supplied evidence explicitly supports the exact claim; prefer the observable event and consequence.
- Do not mention league position, promotion, title ambitions, or season aspirations unless explicitly supplied as supported Run 1 context.
- Do not describe a player as scoring multiple goals unless the authoritative scoring_events list contains multiple goals for that player.
- Preserve the complete final score and every confirmed scoring event, including later penalties.

Return the same strict JSON report structure. Preserve accurate material, change only unsupported or factually incorrect wording, and do not add new claims. Do not return commentary, markdown, or explanations outside JSON.
`.trim();

  if (trace) trace.repair_prompt = repairPrompt;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are correcting a football report for factual accuracy. Use only the supplied facts. Return only JSON.'
      },
      { role: 'user', content: repairPrompt }
    ],
    temperature: 0.1,
    max_tokens: 2500,
    response_format: { type: 'json_object' }
  });

  const repairedText = completion.choices?.[0]?.message?.content?.trim();
  if (!repairedText) return report;

  try {
    const repairedReport = JSON.parse(repairedText);
    return repairedReport && repairedReport.headline && repairedReport.summary_paragraphs
      ? repairedReport
      : report;
  } catch (error) {
    return report;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  const socialEvidence = evidence.curated?.social_evidence || [];
  const tweetGuidance = (socialEvidence.length > 0)
    ? `
CANDIDATE SOCIAL EVIDENCE (from Run 1 - candidate supporting sources, NOT mandatory inclusions; integrate naturally, DO NOT quote verbatim):
${socialEvidence.map((s, i) => {
  const author = s.source?.author_name || 'Reporter';
  const handle = s.source?.handle ? `@${s.source.handle.replace(/^@/, '')}` : 'unknown';
  return `${i + 1}. Tweet ID: ${s.tweet_id || 'unknown'}\n   Source: ${author} (${handle})\n   Original post: ${s.source?.original_post_url || 'URL unavailable'}\n   Relevant event: ${s.relevant_match_event || 'unknown'}\n   Factual/contextual extraction: "${s.factual_context || 'No factual context provided'}"\n   Confidence: ${s.confidence || 'unknown'}\n   Relevance: ${s.relevance || 'unknown'}\n   Reason: ${s.reason || 'No reason provided'}`;
}).join('\n\n')}

IMPORTANT SOCIAL EVIDENCE RULES:
- All sources are from CREDIBLE REPORTERS, not fans
- These are candidate supporting sources, not mandatory inclusions. Use a source only when it adds useful factual detail beyond the structured match data - do not use one simply because it is available.
- Integrate that context naturally into the match narrative at the moment it describes, rather than adding a separate social-media aside.
- Do not quote, closely reproduce, or stylistically imitate the source's wording, distinctive phrases, sentence structure, metaphors, or writing style.
- Do not invent information from a source, and do not treat generic reactions as evidence.
- Do not mention social media, X, reporters, or attribution merely for the sake of mentioning the source; include source attribution only when it adds meaningful credibility or context.
- Never let social evidence override authoritative match data such as official events, score, statistics, ratings, lineups, or other match records.
- When social evidence conflicts with authoritative match data, omit or qualify it and follow the authoritative data.
- Position useful social evidence chronologically (e.g., alongside the goal or moment it describes).
- Only include a tweet_id in used_social_source_ids when you actually use information from that source.

DETAILS TO EXTRACT AND USE (where the factual_context provides them):
- Foot used (left-foot, right-foot, header)
- Shot placement (top corner, bottom corner, across goal, near post, far post)
- Shot style (curled, driven, lifted, placed, rifled, smashed) - only if the source explicitly mentions it
- Player movement (sprinted, raced, cut inside, drifted wide)
- Buildup play (intercepted pass, counterattack, worked space, received through ball)
- Defensive context (loose pass, error, pressure, positioning)
`
    : 'No social evidence available. Do NOT mention social media, reporters, or X.';

  return `
Write a professional post-match report for ${teamFocus} supporters.

AUTHORITATIVE MATCH FACTS (source of truth):
${JSON.stringify(evidence.authoritative_match_facts, null, 2)}

AUTHORITATIVE DATA RULE (apply before reading any narrative):
- The final_score above is the only source of truth for the final result.
- The scoring_events array contains the complete confirmed scoring sequence, including converted penalties. The goals array contains confirmed goal-event details.
- Run 1's narrative fields are editorial assistance, not additional match records. If they conflict with the final_score, goals, goal_events_reconciled, or validation_warnings, ignore the conflicting narrative claim.
- If goal_events_reconciled is false or validation_warnings are present, the goal-event feed is incomplete but scoring_events may still contain additional confirmed scoring events. Do not infer or describe any event absent from both ledgers, and do not allow social context to fill gaps or alter the score. Account for every confirmed scoring event in the article and key moments.
- Social context cannot fill an authoritative data gap or change the score.

MATCH DATA:
${JSON.stringify(evidence.match_summary, null, 2)}

MATCH EVIDENCE (from Run 1 research - use only where consistent with the authoritative facts):
${JSON.stringify(evidence.curated?.match_evidence || {}, null, 2)}

STORY OPPORTUNITIES (Run 1's candidate angles - verify each against AUTHORITATIVE MATCH FACTS and scoring evidence before using; you may reject all of them):
${JSON.stringify(evidence.curated?.story_opportunities || [], null, 2)}

NARRATIVE WARNINGS (guardrails - not prose to reproduce):
${JSON.stringify(evidence.curated?.narrative_warnings || [], null, 2)}

PLAYER OF THE MATCH:
Player: ${potm.player || 'TBD'}
Rating: ${potm.rating || 'N/A'}
Reason: ${potm.reason || 'Highest-rated player'}

${competitionGuidance}

${tweetGuidance}

---

WRITING REQUIREMENTS:

Run 1 has already researched and interpreted the match. You are the writer, not the researcher.
Use the structured Run 1 evidence as the primary basis for the article. Do not independently discover the narrative from raw match data; no raw event, statistics, ratings, or lineup dump is supplied here.

1. STORY SELECTION
  - Run 1 provides candidate story opportunities rather than a predetermined headline or story. Choose the strongest evidence-supported angle from STORY OPPORTUNITIES, then verify it against AUTHORITATIVE MATCH FACTS and the scoring evidence before using it.
  - You are choosing the story, not simply rewriting a Run 1 conclusion. Reject a story opportunity if the evidence does not support it.
  - Example: a goal that materially establishes or restores the winning team's decisive advantage, particularly late in the match, can reasonably be called a "late winner" even if a subsequent goal (e.g., a stoppage-time penalty) only extends the margin. Do not apply "winner" language mechanically to an earlier or mid-match goal simply because that team eventually won - only use it when that specific goal materially changed the likely outcome, especially close to full time.
  - Example: if an opportunity says "comfortable victory" but match_progression indicates a much closer contest, do not use that angle merely because Run 1 suggested it.
  - If no opportunity is sufficiently strong, write the report from the strongest factual match progression instead. Do not introduce generic drama just to create a stronger headline.
  - Scoring hierarchy when labelling events (opener, equaliser, restored lead, late winner, final sealing goal, etc.): authoritative_match_facts is the final authority for the score and scoring events; scoring_evidence provides additional structured context around those events; story_opportunities never override either. Do not infer these labels from a story opportunity alone.

2. HEADLINE
  - Generate a concise headline reflecting the story angle chosen in Section 1.
  - Do not invent a stronger narrative than the evidence supports or use adjectives merely to add excitement.
  - First cross-check the angle against AUTHORITATIVE MATCH FACTS. If the chosen angle conflicts with those facts or the event ledger is incomplete, use a narrower factual angle or a restrained result headline.
  - Never use "comeback" unless the scoring sequence in authoritative_match_facts confirms the eventual winner was behind at some point.
  - Only describe a goal as the final goal or sealing goal if it is in fact the last recorded scoring event; do not apply those two labels to an earlier goal.
  - "Winner", "winning goal", or "decisive goal" language may be used for a goal that materially establishes or restores the winning team's decisive advantage, particularly late in the match - a later goal that merely extends the margin (e.g., a stoppage-time penalty) does not automatically disqualify that description. Do not apply this language mechanically to an earlier or mid-match goal simply because that team eventually won.
  - Never invent any of these classifications if the event ledger is incomplete - only apply them when the supporting scoring sequence is confirmed.
  - Do not call the result comfortable, dominant, or convincing unless the supplied evidence specifically supports it beyond the scoreline.
  - Avoid generic constructions such as "[Team] Secure [Adjective] Victory Over [Opponent]" except as a sparse-data fallback.

3. MAIN MATCH REPORT
  - Your job is to interpret and explain the match using evidence, not to maximize coverage of Run 1 fields. Primary question: what actually made this match interesting or significant, and which evidence lets you explain that clearly?
  - Before writing, assess how rich the supplied evidence actually is: how much of scoring_evidence has structured_details/supporting_context populated, whether match_progression contains real facts and relationships, whether pressure_evidence/market_evidence/social_evidence contain genuinely useful observations, and how many story_opportunities are supported. Let this assessment set the report's depth.
  - Report depth should be proportional to evidence richness. A high-evidence match should normally receive 4-5 substantive paragraphs. A medium-evidence match should normally receive 3-4. A low-evidence match may remain at 2-3.
  - Every paragraph must add interpretation, explanation, context, or meaningful new information. Do not increase length by restating established facts, repeating scorelines unnecessarily, or converting individual Run 1 fields into separate sentences.
  - If a sentence has already established that a team scored and the resulting score, the next sentence must not simply restate that same event.
  - Do not structure the article as event -> explanation -> event -> explanation. Build each paragraph around a clear editorial purpose; combine related events and evidence when that produces a clearer account of match development.
  - Use each event once at its appropriate narrative moment. Do not repeat a goal because it appears in multiple evidence fields.
  - Explain cause and effect, especially the difference between restoring a lead, extending a lead, equalising, and sealing the final result.
  - If the event feed is incomplete, use the authoritative final score but do not invent missing scorers, timings, or sequences. Describe only the supplied scoring events and state their confirmed score effect; do not imply the last listed event was the match's final scoring event.

4. EVIDENCE AND TONE
  - Distinguish clearly between: (a) what happened (confirmed facts), (b) what the evidence suggests (supported interpretation), and (c) what cannot be safely inferred.
  - Every factual or evaluative claim must be supported by the supplied evidence or the authoritative match facts.
  - Use specific observations and explain why important events mattered; omit unsupported conclusions.
  - Do not invent emotional, tactical, or psychological explanations (for example confidence, control, dominance, intent, belief, momentum, character, resilience) unless the supplied evidence explicitly supports that interpretation.
  - Do not use causal language (for example "this led to", "this paid off", "this caused") unless the evidence supports a genuine causal relationship. A temporal sequence alone is not sufficient proof of causation.
  - Do not manufacture drama, promotion/title ambitions, tactical claims, or statistics.
  - Avoid generic AI football language, padding, repetition, and unsupported claims of dominance or deservedness.

5. MATCH CONTEXT / ANALYSIS
  - Actively evaluate the supplied evidence before writing - do not treat optional evidence as merely available if needed; deliberately check each source below for genuinely useful content rather than defaulting to the goals alone.
  - Use evidence selectively: include a data point only if it materially improves the explanation. Do not insert a statistic, pressure metric, market number, or social reference merely because it exists.
  - Goal detail: use scoring_evidence[].structured_details (assist, build_up, shot_type, finish_detail) whenever it provides meaningful detail about how a goal was created or scored, and use scoring_evidence[].supporting_context where it adds factual detail that would otherwise be missing - name the players involved only when that exact relationship is evidenced.
  - Protect factual relationships. Do not upgrade weaker signals into stronger claims unless explicitly supported: involvement -> assist, proximity -> causation, pressure -> dominance, sequence -> causation, rating -> explanation of performance.
  - Integrate only meaningful supported analysis into the main report paragraphs.
  - Use match_evidence.match_progression to explain how the match developed over time, rather than simply listing goals - changes in match state, pressure/control where supported, relationships between events, and uncertainties.
  - Statistics: use match_evidence.statistical_evidence only where a statistic actually explains something relevant to the match.
  - Pressure: prefer match_evidence.pressure_evidence.useful_observations when they explain a concrete phase shift (for example a sustained period before a late breakthrough). Do not use generic pressure-share figures when they add little explanatory value, and do not use Pressure Index as proof of tactical intent.
  - Market: use match_evidence.market_evidence whenever the pre-match expectation provides useful context for interpreting the result and use_in_report is true. Do not turn market expectations into statements about what "should" have happened.
  - Social: use social_evidence only when it adds specific information beyond the structured data (see SOURCES below).

6. PLAYER OF THE MATCH
  - Use the supplied Player of the Match evidence and explain why the player stands out.
  - You may use match_evidence.player_context as supporting evidence where relevant, but do not infer additional contributions simply because a player has a high rating.
  - Do not invent actions or contributions.

7. KEY MOMENTS
  - Provide a concise chronological list of important events from the supplied evidence and the authoritative goal ledger.
  - Reconcile it with the complete final score and do not turn it into a second match report.

8. SOURCES
  - Use the CANDIDATE SOCIAL EVIDENCE above as the source of supporting social context.
  - Include a source's tweet_id in used_social_source_ids only when you actually use information from that source in the report.
  - Use the source metadata provided, do not reproduce or closely imitate source wording, and do not list a source merely because it is available.

9. CONTROLLED LANGUAGE
  - The terms "showcased", "demonstrated", "tactical acumen", "resilience", "character", "tactical masterstroke", "pivotal", "crucial", "decisive", "vital", "impressive", "dominant", "statement", "thriller", and "comeback" require concrete supporting evidence. Prefer precise facts instead.

10. NARRATIVE WARNINGS
  - NARRATIVE WARNINGS above are guardrails, not prose to reproduce.
  - status "prohibited": never make that claim.
  - status "unsupported": omit the claim unless it is independently supported by AUTHORITATIVE MATCH FACTS or other supplied evidence.
  - status "permitted_with_evidence": only use the claim when the supplied evidence actually supports it.

11. FINAL VALIDATION
  - Before returning JSON, check the final score, scoring sequence, scorers, timings, chosen story angle, no false comeback/winner/sealing claim, no duplicated event, no unsupported claim, and no reproduced social-source wording.
  - Check that no sentence merely repeats an already-established scoring fact without adding new meaning.
  - Check that player-event relationships are not inferred beyond evidence (for example do not transfer one player's build-up involvement or assist on one goal to a different goal).
  - Check that temporal ordering has not been presented as causation unless the evidence supports that causal claim.
  - If authoritative_match_facts.validation_warnings are present, check that no headline or paragraph claims more about the missing event data than the authoritative facts establish.
  - Remove any claim that cannot be supported by the supplied evidence or authoritative match facts.

---

OUTPUT (strict JSON):

{
  "headline": "A specific, evidence-supported headline reflecting the genuinely interesting aspect of the match; use a restrained result-over-opponent fallback only when the data provides no stronger angle",
  "summary_paragraphs": [
    "Opening/early match development (70-120 words)",
    "A significant response or change in the match (70-120 words)",
    "Statistical/pressure/market context that explains what happened, where the evidence supports it (70-120 words)",
    "The decisive or most significant sequence (70-120 words)",
    "Optional 5th paragraph only if the evidence supports further distinct content"
  ],
  "key_moments": [
    "5' - [Event description]",
    "34' - [Event description]"
  ],
  "commentary": [],
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

Target length: quality over volume. Let evidence richness determine length; concise reports are preferred when they carry more meaning per sentence. A shorter report is better than a longer padded one.
No markdown. No extra text outside JSON.
`.trim();
}

module.exports = {
  writeMatchReport
};
