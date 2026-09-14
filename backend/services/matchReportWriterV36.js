const crypto = require('crypto');
const { client } = require('../utils/openai');

const WRITER_VERSION = 'v3.6-claim-ledger-writer-2026-09-01.1';

function toArray(value) { return Array.isArray(value) ? value : []; }

function buildPrompt(plan) {
  return `
You are Run 3, a football reporter. Write a coherent focused-club report using only the approved editorial claim ledger below.
You may improve phrasing and transitions, but you may not add material facts, player relationships, causal claims, performance conclusions, or events beyond the approved claims.

FOCUSED CLUB CONTEXT:
${JSON.stringify({ focused_club: plan.focused_club, opponent: plan.opponent, result_context: plan.result_context, component_order: plan.component_plan.component_order }, null, 2)}

APPROVED EDITORIAL CLAIM LEDGER:
${JSON.stringify(plan.claim_ledger, null, 2)}

Rules:
- Follow component_order. Make each component's reader_takeaway distinct; blend components naturally without headings.
- Use each approved claim once unless its reuse_policy explicitly permits more. Never replace a precise relationship with a stronger one.
- If a component has no approved claim, omit prose for it rather than inventing content.
- Do not use claims_to_avoid. Do not resurrect rejected optional components.
- Avoid generic football cliches, repeated score narration, artificial drama, and league/table implications.
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

async function writeMatchReportV36({ editorialPlan, authoritativeMatchFacts, trace = null }) {
  const model = process.env.V3_WRITER_MODEL || process.env.REPORT_MODEL || 'gpt-4o-mini';
  const prompt = buildPrompt(editorialPlan);
  const systemPrompt = 'You write concise, accurate football reports from a closed editorial claim ledger. Return only JSON.';
  if (trace) {
    trace.prompt_version = WRITER_VERSION;
    trace.prompt_hash = crypto.createHash('sha256').update(prompt).digest('hex');
    trace.model = model;
    trace.system_prompt = systemPrompt;
    trace.input_snapshot = { focused_club: editorialPlan.focused_club, claim_ledger: editorialPlan.claim_ledger, component_order: editorialPlan.component_plan.component_order };
    trace.prompt = prompt;
  }
  const response = await client.chat.completions.create({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }], temperature: 0.35, max_tokens: 1400, response_format: { type: 'json_object' } });
  const output = JSON.parse(response.choices?.[0]?.message?.content || '{}');
  const validClaims = new Set(toArray(editorialPlan.claim_ledger?.component_claims).flatMap(component => toArray(component.approved_claims).map(claim => claim.claim_id)));
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
  if (trace) { trace.output = report; trace.completed_at = new Date(); }
  return { report, used_claim_ids: toArray(output.used_claim_ids).filter(id => validClaims.has(id)) };
}

module.exports = { writeMatchReportV36, WRITER_VERSION };
