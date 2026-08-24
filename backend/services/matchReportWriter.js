// services/matchReportWriter.js
// STEP 2: Generate full match report using interpretation + raw data

const { client } = require('../utils/openai');

const RUN2_PROMPT_VERSION = 'run2-evidence-writer-2026-08-24.2';

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
    // The narrative interpretation (from Step 1)
    narrative: interpretation,
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

STRUCTURED RUN 1 EVIDENCE (use only where consistent with the authoritative facts):
${JSON.stringify(evidence.narrative, null, 2)}

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

1. HEADLINE
  - Generate a concise headline from Run 1's verified headline_angle only.
  - Do not invent a stronger narrative than Run 1 supports or use adjectives merely to add excitement.
  - First cross-check the angle against AUTHORITATIVE MATCH FACTS. If Run 1's angle conflicts with those facts or the event ledger is incomplete, use a narrower factual angle or a restrained result headline.
  - Never use "comeback" unless Run 1's decisive sequence confirms the eventual winner was behind.
  - Never call a goal the winner, final goal, or sealing goal if a later scoring event is recorded or if the event ledger is incomplete.
  - Do not call the result comfortable, dominant, or convincing unless Run 1 supplies specific supporting evidence beyond the scoreline.
  - Avoid generic constructions such as "[Team] Secure [Adjective] Victory Over [Opponent]" except as a sparse-data fallback.

2. MAIN MATCH REPORT
  - Write 3-4 paragraphs forming one coherent narrative, not one paragraph per Run 1 field.
  - Answer: how the match began, what changed, what decided it, and what the evidence shows beyond the scoreline.
  - Use each event once at its appropriate narrative moment. Do not repeat a goal because it appears in multiple Run 1 fields.
  - Explain cause and effect, especially the difference between restoring a lead, extending a lead, equalising, and sealing the final result.
  - If the event feed is incomplete, use the authoritative final score but do not invent missing scorers, timings, or sequences. Describe only the supplied scoring events and state their confirmed score effect; do not imply the last listed event was the match's final scoring event.

3. EVIDENCE AND TONE
  - Every factual or evaluative claim must be supported by Run 1 evidence or the authoritative match facts.
  - Use specific observations and explain why important events mattered; omit unsupported conclusions.
  - Do not manufacture drama, promotion/title ambitions, tactical claims, or statistics.
  - Avoid generic AI football language, padding, repetition, and unsupported claims of dominance or deservedness.

4. MATCH CONTEXT / ANALYSIS
  - Integrate only meaningful supported analysis into the main report paragraphs.
  - Use statistical, market, Pressure Index, and social context only when Run 1 identifies what it explains and why it matters.
  - Do not treat possession alone as dominance or Pressure Index as team quality.

5. PLAYER OF THE MATCH
  - Use the supplied Player of the Match evidence and explain why the player stands out.
  - Do not invent actions or contributions.

6. KEY MOMENTS
  - Provide a concise chronological list of important events from Run 1 and the authoritative goal ledger.
  - Reconcile it with the complete final score and do not turn it into a second match report.

7. SOURCES
  - Include only social sources whose extracted context Run 1 marked suitable and that you actually use.
  - Use source metadata supplied by Run 1, do not reproduce or closely imitate source wording, and do not list merely available sources.

8. CONTROLLED LANGUAGE
  - The terms "showcased", "demonstrated", "tactical acumen", "resilience", "character", "tactical masterstroke", "pivotal", "crucial", "decisive", "vital", "impressive", "dominant", "statement", "thriller", and "comeback" require concrete Run 1 evidence. Prefer precise facts instead.

9. FINAL VALIDATION
  - Before returning JSON, check the final score, scoring sequence, scorers, timings, headline angle, no false comeback/winner/sealing claim, no duplicated event, no unsupported claim, and no reproduced social-source wording.
  - If validation_warnings are present, check that no headline or paragraph claims more about the missing event data than the authoritative facts establish.
  - Remove any claim that cannot be supported by Run 1 or authoritative match facts.

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

Target length: 500-700 words total. Keep it concise and do not pad the article.
No markdown. No extra text outside JSON.
`.trim();
}

module.exports = {
  writeMatchReport
};
