// services/matchReportWriterV3.js
// V3 Run 3: final writer that follows the Run 2 editorial brief.

const crypto = require('crypto');
const { client } = require('../utils/openai');

const RUN3_PROMPT_VERSION = 'run3-editorial-writer-2026-08-26.1';

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildCuratedEvidence(interpretation = {}) {
  const socialEvidence = toArray(interpretation.social_context)
    .filter(item => item.suitable_for_report === true)
    .map(item => ({
      tweet_id: item.tweet_id,
      source: item.source,
      relevant_match_event: item.relevant_match_event,
      factual_context: item.factual_context,
      confidence: item.confidence,
      reason: item.reason
    }));

  return {
    match_facts: interpretation.match_facts || {},
    scoring_evidence: toArray(interpretation.scoring_evidence),
    match_progression: interpretation.match_progression || {},
    statistical_evidence: interpretation.statistical_evidence || {},
    pressure_evidence: interpretation.pressure_evidence || {},
    market_evidence: interpretation.market_evidence || {},
    player_context: interpretation.player_context || {},
    social_evidence: socialEvidence,
    narrative_warnings: toArray(interpretation.narrative_warnings)
  };
}

function validateGeneratedReport(report, authoritativeMatchFacts, editorialPlan = {}) {
  const issues = [];
  const reportText = JSON.stringify(report).toLowerCase();
  const finalScore = authoritativeMatchFacts?.final_score;
  const scoringEvents = authoritativeMatchFacts?.scoring_events || [];
  const evidenceLevel = String(editorialPlan?.evidence_level || '').toLowerCase();

  const paragraphs = toArray(report.summary_paragraphs);
  if (evidenceLevel === 'high' && paragraphs.length < 4) {
    issues.push('High-evidence briefs require sufficient depth: provide at least 4 substantive summary_paragraphs aligned to the selected component plan.');
  }
  if (evidenceLevel === 'medium' && paragraphs.length < 3) {
    issues.push('Medium-evidence briefs should normally provide at least 3 substantive summary_paragraphs aligned to the selected component plan.');
  }

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
    issues.push('Remove unsupported claims about league position, promotion, title challenges, or season ambitions unless explicitly supported by evidence.');
  }

  if (/\b(secured all three points|the game remained finely poised|the match was tense)\b/i.test(reportText)) {
    issues.push('Remove generic filler language and replace with specific supported match detail.');
  }

  if (/\b(comfortable victory|dominant win|convincing win)\b/i.test(reportText)) {
    issues.push('Remove unsupported dominance framing unless explicitly supported by evidence.');
  }

  if (/\bsecure(?:s|d)?\b.{0,35}\b(victory|win)\b.{0,35}\bover\b/i.test(String(report.headline || ''))) {
    issues.push('Replace generic secure-victory-over headline with a specific match-defining angle from the editorial brief.');
  }

  const potmReason = String(report?.player_of_the_match?.reason || '').trim();
  if (!potmReason || /^highest rating/i.test(potmReason)) {
    issues.push('Player of the match reason must be evidence-based and specific, not only a generic highest-rating statement.');
  }

  return issues;
}

async function repairGeneratedReport({ report, authoritativeMatchFacts, issues, model, trace }) {
  const repairPrompt = `
Correct this draft report using only the authoritative facts, curated Run 1 evidence, and Run 2 editorial plan constraints already reflected in the draft.

AUTHORITATIVE FACTS:
${JSON.stringify(authoritativeMatchFacts, null, 2)}

DRAFT REPORT:
${JSON.stringify(report, null, 2)}

CORRECTIONS REQUIRED:
${issues.map(issue => `- ${issue}`).join('\n')}

Keep the same output JSON shape and preserve valid content. Remove unsupported, repetitive, or incorrect claims. Return only JSON.
`.trim();

  if (trace) trace.repair_prompt = repairPrompt;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are correcting a football report for factual accuracy and editorial quality. Return only JSON.'
      },
      {
        role: 'user',
        content: repairPrompt
      }
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
  } catch (_error) {
    return report;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildReportPrompt({
  matchSummary,
  authoritativeMatchFacts,
  curatedEvidence,
  editorialPlan,
  focusedContext,
  potm,
  isCup
}) {
  const evidenceLevel = String(editorialPlan?.evidence_level || '').toLowerCase();

  const competitionGuidance = isCup
    ? `
CUP CONTEXT:
- Cup match language only: progress/advance/knockout context.
- Do not use league-table framing unless explicitly evidenced.
`
    : `
LEAGUE CONTEXT:
- League language allowed only where evidence supports it.
`;

  return `
Write a high-quality football report for the focused club supporters.

You are Run 3 (Writer). Run 2 has already made the editorial decisions.
Do not rediscover the story from scratch. Execute the editorial brief faithfully.

FOCUSED CLUB CONTEXT:
${JSON.stringify(focusedContext, null, 2)}

AUTHORITATIVE MATCH FACTS (highest authority):
${JSON.stringify(authoritativeMatchFacts, null, 2)}

RUN 1 CURATED EVIDENCE:
${JSON.stringify(curatedEvidence, null, 2)}

RUN 2 EDITORIAL BRIEF (must drive narrative priorities):
${JSON.stringify(editorialPlan, null, 2)}

MATCH SUMMARY:
${JSON.stringify(matchSummary, null, 2)}

PLAYER OF THE MATCH INPUT:
${JSON.stringify(potm, null, 2)}

${competitionGuidance}

WRITING RULES:
1. Club perspective:
- Frame the report around the focused club experience and priorities.
- Be fair and factual; do not force praise or blame.

2. Editorial plan adherence:
- Use Run 2 component_order and selected_components to structure the narrative naturally.
- If an event is in key_moments_only, keep it out of expanded body treatment.
- If an event is brief mention, keep it concise.
- If an event is expand_in_report, give meaningful explanatory context.
- Do not include components or evidence that Run 2 effectively omitted.

3. Depth from editorial brief:
- Evidence level is "${evidenceLevel || 'unknown'}".
- For high evidence level: normally produce 4-5 substantive summary_paragraphs.
- For medium evidence level: normally produce 3-4 substantive summary_paragraphs.
- For low evidence level: 2-3 concise but meaningful paragraphs may be sufficient.
- Every paragraph must serve a different editorial purpose from component_plan; no padding.

4. Quality and anti-robotic style:
- Avoid repetitive scoreline restatement and event-dump chronology.
- Avoid formulaic lines like "X scored to make it Y-Z" repeated in sequence.
- Avoid generic filler phrases and artificial drama.
- Every paragraph must add meaningful interpretation, context, or explanation.
- Prefer concrete phase explanations over generic atmosphere claims.

5. Evidence discipline:
- Distinguish what happened, what evidence supports as interpretation, and what cannot be safely inferred.
- Do not invent tactical/psychological explanations.
- Temporal sequence is not automatic causation.
- Do not upgrade involvement to assist, or proximity to causation, without explicit evidence.

6. Social evidence:
- Use only social_sources_worth_using selected by Run 2.
- Do not quote raw tweets.
- Add tweet_id to used_social_source_ids only if that source is actually used.

7. Statistics, pressure, market:
- Use only when they materially improve explanation.
- Prefer concrete phase observations over isolated percentages when possible.

8. Headline:
- Follow editorialPlan.headline_direction.
- Avoid generic fallback formulas unless no stronger angle is evidenced.
- Do not use generic templates like "[Club] Secures Victory Over [Opponent]" unless no specific angle is possible.

9. Player of the match:
- Use supplied POTM input and supported evidence.
- Do not make unsupported claims.
- Give a specific reason grounded in evidence, not only "highest rating".

OUTPUT (strict JSON only):
{
  "headline": "...",
  "summary_paragraphs": ["..."],
  "key_moments": ["..."],
  "commentary": [],
  "used_social_source_ids": ["tweet_id"],
  "player_of_the_match": {
    "player": "${potm.player || 'TBD'}",
    "reason": "..."
  },
  "sources": ["..."]
}

No markdown. No extra text outside JSON.
`.trim();
}

async function writeMatchReportV3({
  interpretation,
  editorialPlan,
  match,
  teamFocus,
  teamSide,
  teamSlug,
  potm,
  authoritativeMatchFacts,
  trace = null,
  isCup = false,
  competitionName = 'Unknown',
  competitionStage = 'Unknown'
}) {
  const model = process.env.REPORT_MODEL || 'gpt-4o-mini';

  const focusedContext = {
    focused_club: {
      name: editorialPlan?.focused_club?.name || teamFocus,
      slug: editorialPlan?.focused_club?.slug || teamSlug,
      side: editorialPlan?.focused_club?.side || teamSide
    },
    opponent: editorialPlan?.opponent || null,
    result_context: editorialPlan?.result_context || null,
    competition_context: editorialPlan?.competition_context || {
      name: competitionName,
      stage: competitionStage,
      is_cup: Boolean(isCup)
    }
  };

  const matchSummary = {
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
    }
  };

  const curatedEvidence = buildCuratedEvidence(interpretation);

  const prompt = buildReportPrompt({
    matchSummary,
    authoritativeMatchFacts,
    curatedEvidence,
    editorialPlan,
    focusedContext,
    potm,
    isCup
  });

  const systemPrompt = 'You are a football journalist writing a focused-club report from verified evidence and an editorial brief. Return only JSON.';

  if (trace) {
    trace.prompt_version = RUN3_PROMPT_VERSION;
    trace.prompt_hash = crypto.createHash('sha256').update(prompt).digest('hex');
    trace.model = model;
    trace.system_prompt = systemPrompt;
    trace.started_at = new Date();
    trace.input_snapshot = {
      focused_context: focusedContext,
      authoritative_match_facts: authoritativeMatchFacts,
      curated_evidence: curatedEvidence,
      editorial_plan: editorialPlan,
      potm
    };
    trace.prompt = prompt;
  }

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.45,
    max_tokens: 2600,
    response_format: { type: 'json_object' }
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('No report output from model');

  let report;
  try {
    report = JSON.parse(text);
  } catch (_error) {
    const extracted = text.match(/\{[\s\S]*\}/);
    if (!extracted) throw new Error('Invalid report JSON output');
    report = JSON.parse(extracted[0]);
  }

  for (let repairAttempt = 0; repairAttempt < 2; repairAttempt++) {
    const issues = validateGeneratedReport(report, authoritativeMatchFacts, editorialPlan);
    if (issues.length === 0) break;
    report = await repairGeneratedReport({
      report,
      authoritativeMatchFacts,
      issues,
      model,
      trace
    });
  }

  if (!report.headline || !Array.isArray(report.summary_paragraphs) || !report.player_of_the_match) {
    throw new Error('Report missing required fields');
  }

  report.meta = {
    generated_by: model,
    generated_at: new Date().toISOString(),
    pipeline_version: '3.0',
    interpretation_model: interpretation.model,
    writer_prompt_version: RUN3_PROMPT_VERSION
  };

  if (trace) {
    trace.completed_at = new Date();
    trace.output = report;
  }

  return report;
}

module.exports = {
  writeMatchReportV3
};
