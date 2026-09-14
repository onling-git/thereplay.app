const crypto = require('crypto');
const { client } = require('../utils/openai');
const { buildEditorialPlan } = require('./reportEditorialPlannerV3');

const PLANNER_VERSION = 'v3.6-claim-ledger-editor-2026-09-01.1';

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildEvidenceIndex(interpretation, plan) {
  const index = new Map();
  toArray(interpretation.scoring_evidence).forEach((item, offset) => index.set(`scoring_evidence_${offset + 1}`, item));
  toArray(interpretation.match_progression?.phases).forEach((item, offset) => index.set(`phase_${offset + 1}`, item));
  toArray(interpretation.pressure_evidence?.useful_observations).forEach((item, offset) => index.set(`pressure_obs_${offset + 1}`, item));
  toArray(plan.evidence_usage?.social_sources_worth_using).forEach(item => index.set(item.evidence_id, item));
  toArray(plan.evidence_usage?.player_contributions_worth_using).forEach(item => index.set(item.evidence_id, item));
  if (plan.evidence_usage?.market_worth_using) index.set('market_context_1', plan.evidence_usage.market_worth_using);
  return index;
}

function promptForLedger(basePlan, interpretation, authoritativeMatchFacts, potm) {
  const components = basePlan.component_plan.selected_components.map(component => ({
    component_id: component.component_id,
    purpose: component.purpose,
    evidence_ids: component.evidence_ids,
    event_ids: component.event_ids,
    depth: component.depth,
    target_sentence_budget: component.target_sentence_budget,
    editorial_questions: component.editorial_questions || []
  }));

  return `
You are Run 2, a football editor. Produce a factual editorial claim ledger, not article prose.

AUTHORITATIVE FACTS:
${JSON.stringify(authoritativeMatchFacts, null, 2)}

FOCUSED CLUB CONTEXT:
${JSON.stringify({ focused_club: basePlan.focused_club, opponent: basePlan.opponent, result_context: basePlan.result_context, performance_assessment: basePlan.performance_assessment }, null, 2)}

APPROVED COMPONENTS AND EVIDENCE ALLOCATION:
${JSON.stringify(components, null, 2)}

REJECTED OPTIONAL COMPONENTS:
${JSON.stringify(basePlan.component_plan.optional_components.rejected, null, 2)}

CANONICAL EVIDENCE:
${JSON.stringify({ scoring_evidence: interpretation.scoring_evidence, match_progression: interpretation.match_progression, statistical_evidence: interpretation.statistical_evidence, pressure_evidence: interpretation.pressure_evidence, market_evidence: interpretation.market_evidence, social_context: toArray(interpretation.social_context).filter(item => item.suitable_for_report), player_context: interpretation.player_context, narrative_warnings: interpretation.narrative_warnings }, null, 2)}

POTM INPUT:
${JSON.stringify(potm, null, 2)}

Return strict JSON:
{
  "headline_brief": { "approved_angle": "...", "approved_facts": ["..."], "claims_to_avoid": ["..."] },
  "component_claims": [{
    "component_id": "approved component id",
    "reader_takeaway": "...",
    "approved_claims": [{ "claim_id": "unique id", "text": "precise factual claim or cautious interpretation", "evidence_ids": ["allocated ids"], "reuse_policy": "once" }],
    "claims_to_avoid": ["..."],
    "social_source_ids": ["tweet id only when its factual detail appears in an approved claim"]
  }],
  "potm_brief": { "player": "supplied player", "approved_reason": "only a supplied supported reason", "evidence_ids": ["..."] }
}

Rules:
- Do not add components or use rejected optional components as standalone material.
- Allocate a fact to one primary component. Do not repeat scoring claims across components.
- Performance may be "uncertain"; never infer dominance, comfort, tactical intent, psychology, causation, or deservedness from a scoreline or one metric.
- Preserve player relationships exactly. Build-up involvement is not an assist.
- Social IDs are permitted only when their specific factual context is represented in an approved claim.
- The writer will only receive your ledger. Make every claim precise enough to write from.
`.trim();
}

function normalizeLedger(basePlan, generated, potm) {
  const components = basePlan.component_plan.selected_components;
  const allowed = new Map(components.map(component => [component.component_id, component]));
  const generatedById = new Map(toArray(generated.component_claims).filter(item => allowed.has(item.component_id)).map(item => [item.component_id, item]));
  const usedClaims = new Set();
  const componentClaims = components.map(component => {
    const generatedComponent = generatedById.get(component.component_id) || {};
    const approvedClaims = toArray(generatedComponent.approved_claims).filter(claim => {
      const validEvidence = toArray(claim.evidence_ids).every(id => component.evidence_ids.includes(id));
      const key = String(claim.text || '').toLowerCase();
      if (!key || usedClaims.has(key) || !validEvidence) return false;
      usedClaims.add(key);
      return true;
    }).slice(0, Math.max(1, component.target_sentence_budget));
    return {
      component_id: component.component_id,
      purpose: component.purpose,
      depth: component.depth,
      target_sentence_budget: component.target_sentence_budget,
      reader_takeaway: generatedComponent.reader_takeaway || component.purpose,
      approved_claims: approvedClaims,
      claims_to_avoid: [...new Set([...(toArray(generatedComponent.claims_to_avoid)), ...(toArray(basePlan.narrative_warnings).map(item => item.claim))])],
      social_source_ids: toArray(generatedComponent.social_source_ids)
    };
  });
  return {
    ...basePlan,
    planner_version: PLANNER_VERSION,
    claim_ledger: {
      headline_brief: generated.headline_brief || { approved_angle: basePlan.headline_direction.suggested_headline_focus, approved_facts: [], claims_to_avoid: basePlan.headline_direction.avoid_labels },
      component_claims: componentClaims,
      potm_brief: {
        player: potm.player || 'TBD',
        approved_reason: generated.potm_brief?.approved_reason || potm.reason || 'Selected from the available player-rating evidence.',
        evidence_ids: toArray(generated.potm_brief?.evidence_ids)
      }
    }
  };
}

async function buildClaimLedgerV36(params) {
  const basePlan = buildEditorialPlan(params);
  const prompt = promptForLedger(basePlan, params.interpretation, params.authoritativeMatchFacts, params.potm);
  const model = process.env.V3_EDITOR_MODEL || process.env.INTERPRETATION_MODEL || 'gpt-4o-mini';
  const systemPrompt = 'You are an evidence-first football editor. Return only JSON claim ledgers.';
  if (params.trace) {
    params.trace.prompt_version = PLANNER_VERSION;
    params.trace.prompt_hash = crypto.createHash('sha256').update(prompt).digest('hex');
    params.trace.model = model;
    params.trace.system_prompt = systemPrompt;
    params.trace.started_at = new Date();
    params.trace.input_snapshot = { base_plan: basePlan, evidence_index: [...buildEvidenceIndex(params.interpretation, basePlan).entries()] };
    params.trace.prompt = prompt;
  }
  const response = await client.chat.completions.create({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }], temperature: 0.1, max_tokens: 2400, response_format: { type: 'json_object' } });
  const text = response.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('No V3.6 editorial ledger output from model');
  const plan = normalizeLedger(basePlan, JSON.parse(text), params.potm);
  if (params.trace) { params.trace.output = plan; params.trace.completed_at = new Date(); }
  return plan;
}

module.exports = { buildClaimLedgerV36, PLANNER_VERSION };
