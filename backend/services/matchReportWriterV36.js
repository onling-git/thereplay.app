const crypto = require('crypto');
const { getReportWriterConfig, completeReport } = require('./reportWriterProvider');

const WRITER_VERSION = 'v3.6-rich-context-writer-2026-10-01.1';

function toArray(value) { return Array.isArray(value) ? value : []; }

function buildPrompt(plan, historicalContext, statisticalContext, leagueContext) {
  return `
You are Run 3, a football reporter. Write a coherent focused-club report using only the approved editorial claim ledger below.
You may improve phrasing and transitions, but you may not add material facts, player relationships, causal claims, performance conclusions, or events beyond the approved claims.

FOCUSED CLUB CONTEXT:
${JSON.stringify({ focused_club: plan.focused_club, opponent: plan.opponent, result_context: plan.result_context, component_order: plan.component_plan.component_order }, null, 2)}

APPROVED EDITORIAL CLAIM LEDGER:
${JSON.stringify(plan.claim_ledger, null, 2)}

APPROVED OPTIONAL SEASON/FORM EVIDENCE:
${JSON.stringify(historicalContext || null, null, 2)}
- This backend-verified evidence is an additional approved source. Use supplied totals or facts only when materially relevant. Record any used fact_id in used_claim_ids.
- Preserve exact counts, club, competition and season scope. It includes this match and excludes later fixtures. Scoring streaks count consecutive team matches, not player appearances. Player totals are for this club only. Never infer new streaks or use incomplete history.

Rules:
- These additional verified sources are approved even if the editorial ledger omitted them. Use meaningful comparisons beyond possession/shots, not a list of every metric. Missing metrics are unavailable, not zero; overall passing accuracy is not final-third accuracy, and xG does not prove luck.
- League context is explicitly END-OF-ROUND, not immediate final-whistle standings. Preserve official sanctioned points, use only supplied gaps and games remaining, and do not invent promotion/relegation conclusions.
VERIFIED STATISTICS:
${JSON.stringify(statisticalContext || null, null, 2)}
VERIFIED LEAGUE CONTEXT:
${JSON.stringify(leagueContext || { available: false }, null, 2)}
- Follow component_order. Make each component's reader_takeaway distinct; blend components naturally without headings.
- Use each approved claim once unless its reuse_policy explicitly permits more. Never replace a precise relationship with a stronger one.
- If a component has no approved claim, omit prose for it rather than inventing content.
- Do not use claims_to_avoid. Do not resurrect rejected optional components.
- Avoid generic football cliches, repeated score narration, artificial drama, and unsupported league/table implications.
- Produce a concise, meaningful report. Do not pad to a paragraph count.
- Output strict JSON only: {"headline":"...","summary_paragraphs":["..."],"used_claim_ids":["..."],"used_social_source_ids":["..."]}.
`.trim();
}

function buildKeyMoments(facts) {
  return toArray(facts?.scoring_events).map(event => {
    const minute = event.extra_minute ? `${event.minute}+${event.extra_minute}` : event.minute;
    return `${minute}' - ${event.scorer} (${event.side}) ${event.result ? `made it ${event.result}` : 'scored'}.`;
  });
}

async function writeMatchReportV36({ editorialPlan, authoritativeMatchFacts, trace = null, writerProvider = 'openai' }) {
  const { provider, model } = getReportWriterConfig(writerProvider, process.env.V3_WRITER_MODEL || process.env.REPORT_MODEL || 'gpt-4o-mini');
  const prompt = buildPrompt(editorialPlan, authoritativeMatchFacts.historical_context, authoritativeMatchFacts.statistical_context, authoritativeMatchFacts.league_context);
  const systemPrompt = 'You write concise, accurate football reports from a closed editorial claim ledger. Return only JSON.';
  if (trace) {
    trace.prompt_version = WRITER_VERSION;
    trace.prompt_hash = crypto.createHash('sha256').update(prompt).digest('hex');
    trace.model = model;
    trace.provider = provider;
    trace.system_prompt = systemPrompt;
    trace.input_snapshot = { focused_club: editorialPlan.focused_club, claim_ledger: editorialPlan.claim_ledger, component_order: editorialPlan.component_plan.component_order, historical_context: authoritativeMatchFacts.historical_context, statistical_context: authoritativeMatchFacts.statistical_context, league_context: authoritativeMatchFacts.league_context };
    trace.prompt = prompt;
  }
  const text = await completeReport({ provider, model, systemPrompt, prompt, temperature: 0.35, maxTokens: 1400 });
  const output = JSON.parse(text || '{}');
  const validClaims = new Set(toArray(editorialPlan.claim_ledger?.component_claims).flatMap(component => toArray(component.approved_claims).map(claim => claim.claim_id)));
  for (const fact of authoritativeMatchFacts.historical_context?.facts || []) validClaims.add(fact.fact_id);
  const validSocial = new Set(toArray(editorialPlan.claim_ledger?.component_claims).flatMap(component => component.social_source_ids || []));
  const potmBrief = editorialPlan.claim_ledger?.potm_brief || {};
  const report = {
    headline: String(output.headline || '').trim(),
    summary_paragraphs: toArray(output.summary_paragraphs).map(item => String(item).trim()).filter(Boolean),
    key_moments: buildKeyMoments(authoritativeMatchFacts),
    commentary: [],
    used_social_source_ids: toArray(output.used_social_source_ids).filter(id => validSocial.has(id)),
    player_of_the_match: {
      player: potmBrief.player || 'TBD',
      reason: potmBrief.approved_reason || 'Selected from the available player-rating evidence.'
    },
    sources: ['Match events', ...(toArray(output.used_social_source_ids).some(id => validSocial.has(id)) ? ['Selected reporter context'] : [])]
  };
  if (!report.headline || report.summary_paragraphs.length === 0) throw new Error('V3.6 writer returned no report content');
  report.meta = { generated_by: model, writer_provider: provider, generated_at: new Date().toISOString(), pipeline_version: '3.6', writer_prompt_version: WRITER_VERSION };
  if (trace) { trace.output = report; trace.completed_at = new Date(); }
  return { report, used_claim_ids: toArray(output.used_claim_ids).filter(id => validClaims.has(id)) };
}

module.exports = { writeMatchReportV36, WRITER_VERSION };
