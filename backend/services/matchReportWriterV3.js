// services/matchReportWriterV3.js
// V3 Run 3: final writer that follows the Run 2 editorial brief.

const crypto = require('crypto');
const { client } = require('../utils/openai');

const RUN3_PROMPT_VERSION = 'run3-component-writer-2026-09-01.2';

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
1. Role and club perspective:
- You are Run 3, the final reporter. Run 2 has already decided what this report should contain; your job is to turn that plan into natural, club-focused football journalism.
- Write for the focused club identified above. Prioritise that club's result, experience, relevant positive developments, and relevant problems without becoming unfair to the opponent.
- Do not invent a different story, additional editorial components, or a new hierarchy because another evidence field seems interesting.

2. Component-plan execution (binding):
- You are not deciding what this report should contain. Run 2 has already made those decisions. Execute the supplied component plan accurately and naturally.
- Work through editorial_plan.component_plan.component_order before drafting. For each component in that order, identify its purpose, evidence_ids, event_ids, depth, target_sentence_budget, and editorial_questions; allocate only the supported material needed to do that component's editorial job.
- editorial_plan.component_plan.core_components are mandatory editorial jobs. Cover all five: opening, match_flow, performance, key_events, and closing. Make them do different jobs rather than repeating the same goals in five forms.
- editorial_plan.component_plan.optional_components.selected contains the only optional components permitted as independent narrative material. Incorporate each selected optional component at its position in component_order, and give it the depth the plan specifies.
- editorial_plan.component_plan.optional_components.rejected is a hard boundary. Do not independently create that rejected component, apply its editorial label, or give its event standalone treatment, even if raw evidence contains a related event. Mention a rejected event only when accuracy or a brief transition requires it.
- Follow component_order as the underlying narrative order, but do not print component names, headings, or one visible section per component. Blend related components naturally when that improves flow.
- Answer each component's editorial_questions from its attached evidence. Do not reproduce the questions, component reasons, or planner wording as prose.
- A minimal component can be a sentence within a related paragraph. A standard or detailed component may take more space. Components are editorial jobs, not fixed paragraph quotas.

3. Event hierarchy:
- event_treatment controls event coverage. Keep key_moments_only events in Key Moments unless they are necessary for a brief transition. Keep mention_briefly events brief. Give expand_in_report events explanatory context proportionate to their component depth.
- Do not give every goal or card equal narrative weight. The Key Moments output carries chronology; main-report prose must explain why the selected events mattered.
- Use a score change only when it is editorially meaningful. Do not narrate the whole score sequence or repeatedly use "X scored to make it Y-Z".
- Once an event is established, later references must add a different supported insight about its timing, context, or effect; otherwise omit or combine them.

4. Match flow and performance:
- In match_flow, answer how the contest developed using the selected phases and transitions: initiative, response, balance, sustained phases, state changes, or a late decision where supported. Do not turn it into "what happened next" or a minute-by-minute goal list.
- In performance, follow editorial_plan.performance_assessment. Answer whether the scoreline represented the match only where its relevant evidence supports an answer.
- Performance is not a statistics dump. Use progression, scoring sequence, statistics, pressure, market, and social evidence only when they collectively clarify how the match developed. A scoreline or one metric alone never proves dominance, comfort, deservedness, or a flattering margin.
- If the performance assessment says keep_restrained or the evidence is inconclusive, state only the supported match texture and do not manufacture a verdict.

5. Optional components:
- late_drama: explain the late change in match state and distinguish a winning/decisive goal from a later goal that merely seals the margin.
- comeback: explain the confirmed deficit and recovery; never label a team a comeback winner unless the focused club was actually behind.
- red_card, disciplinary_incident, disallowed_goal, and goalkeeping_heroics: explain their match effect only where the selected component evidence supports an effect.
- penalty: explain why it mattered (equaliser, lead, insurance, or final margin) rather than treating every penalty as a standalone story.
- exceptional_goal: use factual finish/build-up detail; do not embellish it into a wonder goal.
- standout_individual: require the selected supported contribution; a rating alone is not enough.
- low_event_match: allow the lack of incidents to define the report without manufacturing drama.

6. Evidence hierarchy and discipline:
- When facts conflict, follow: authoritative_match_facts, then canonical Run 1 evidence, then the editorial plan. The plan controls relevance and priority; it never overrides facts.
- Distinguish what happened, what the evidence supports as interpretation, and what cannot safely be inferred.
- Do not invent tactical, emotional, or psychological explanations. Temporal sequence is not automatic causation. Do not upgrade involvement to an assist, proximity to causation, pressure to dominance, or a rating to an explanation.

7. Social, statistics, and supporting evidence:
- Use only social_sources_worth_using selected by Run 2, and only if their factual context materially improves the relevant component. Do not quote or imitate tweets and do not add social attribution as decoration.
- Populate used_social_source_ids only when the report text actually incorporates a substantive factual detail from that source. If no such detail appears, leave that ID out.
- Use statistics, pressure, and market evidence only when they help explain a specific component. Prefer a supported match phase over a bare percentage.

8. Style, depth, and headline:
- Evidence level is "${evidenceLevel || 'unknown'}". Let component depths and selected optional components determine report length; do not impose an arbitrary paragraph count.
- Every sentence and paragraph must add new explanation, context, or meaningful information. Avoid event dumping, repeated score descriptions, generic tension, artificial drama, generic conclusions, and formulaic prose.
- Headline must follow editorial_plan.headline_direction and the primary supported angle. Make it concise, focused-club specific, and natural; avoid generic "Secures Victory", "Claims Three Points", "Edges", or result-template headlines unless no stronger supported angle exists.

9. Player of the match:
- Use supplied POTM input and supported evidence. Do not repeat the main report or make unsupported claims.
- Give a specific reason only when the evidence supports it; never use a rating alone as the explanation. Preserve distinctions between scorer, assist provider, build-up involvement, and general contribution exactly as supplied.

10. Final execution check:
- Before returning JSON, verify that each core component has a distinct editorial contribution, each selected optional component is materially developed, and each rejected optional component remains proportionate.
- Remove any paragraph that only repeats a scorer, scoreline, or result without adding useful match understanding.
- Verify every player-event relationship and every used_social_source_id against the specific evidence text supplied.

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
