const crypto = require('crypto');
const { client } = require('../utils/openai');
const { buildEditorialPlan } = require('./reportEditorialPlannerV3');

const PLANNER_VERSION = 'v3.5-component-editor-2026-09-01.1';

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function curatedEvidence(interpretation) {
  return {
    match_facts: interpretation.match_facts || {},
    scoring_evidence: toArray(interpretation.scoring_evidence),
    match_progression: interpretation.match_progression || {},
    statistical_evidence: toArray(interpretation.statistical_evidence),
    pressure_evidence: interpretation.pressure_evidence || {},
    market_evidence: interpretation.market_evidence || {},
    player_context: interpretation.player_context || {},
    social_context: toArray(interpretation.social_context).filter(source => source.suitable_for_report),
    narrative_warnings: toArray(interpretation.narrative_warnings)
  };
}

function plannerPrompt({ basePlan, interpretation, authoritativeMatchFacts }) {
  const componentIds = basePlan.component_plan.selected_components.map(component => component.component_id);

  return `
You are Run 2, the football editor. Build component briefs for a focused-club match report.
You do not write article prose. You decide what each approved component should communicate.

AUTHORITATIVE FACTS:
${JSON.stringify(authoritativeMatchFacts, null, 2)}

FOCUSED-CLUB CONTEXT:
${JSON.stringify({ focused_club: basePlan.focused_club, opponent: basePlan.opponent, result_context: basePlan.result_context, competition_context: basePlan.competition_context }, null, 2)}

PRESELECTED COMPONENT PLAN (binding selection/order):
${JSON.stringify(basePlan.component_plan, null, 2)}

PERFORMANCE ASSESSMENT:
${JSON.stringify(basePlan.performance_assessment, null, 2)}

CURATED RUN 1 EVIDENCE:
${JSON.stringify(curatedEvidence(interpretation), null, 2)}

Return strict JSON with this shape:
{
  "headline_brief": { "angle": "short factual editorial angle", "claims_supported": ["..."], "claims_to_avoid": ["..."] },
  "component_briefs": [
    {
      "component_id": "one of ${componentIds.join(', ')}",
      "editorial_angle": "what this component explains",
      "what_reader_should_learn": "specific takeaway",
      "key_points": ["facts or careful interpretations"],
      "evidence_ids": ["only IDs from the preselected component"],
      "event_ids": ["only IDs from the preselected component"],
      "social_evidence_ids": ["tweet IDs only when their factual context materially helps"],
      "claims_supported": ["..."],
      "claims_to_avoid": ["..."],
      "depth": "minimal, standard, or detailed"
    }
  ],
  "overall_claims_to_avoid": ["..."]
}

Rules:
- Preserve the binding component selection and component_order. Do not add a component, and do not resurrect a rejected optional component.
- Make every component brief distinct. Allocate an event to the component where it adds most meaning; do not repeat an event merely because it is available.
- Performance must assess whether the scoreline reflects the contest only from combined evidence. A scoreline, pressure percentage, or rating alone does not prove dominance, comfort, or deservedness.
- Social evidence is optional. If selected, retain exact player relationships; build-up involvement is not an assist unless explicitly stated.
- A later goal can seal a margin while an earlier late goal established the decisive advantage. Do not label these mechanically.
- Be club-focused but fair. Do not write final article sentences.
`.trim();
}

function mergeBriefs(basePlan, generated) {
  const components = basePlan.component_plan.selected_components;
  const allowed = new Map(components.map(component => [component.component_id, component]));
  const generatedById = new Map(toArray(generated.component_briefs)
    .filter(brief => allowed.has(brief.component_id))
    .map(brief => [brief.component_id, brief]));

  const componentBriefs = components.map(component => {
    const brief = generatedById.get(component.component_id) || {};
    return {
      component_id: component.component_id,
      purpose: component.purpose,
      reason: component.reason || null,
      editorial_angle: brief.editorial_angle || component.purpose,
      what_reader_should_learn: brief.what_reader_should_learn || component.purpose,
      key_points: toArray(brief.key_points),
      evidence_ids: (() => {
        const selected = toArray(brief.evidence_ids).filter(id => component.evidence_ids.includes(id));
        return selected.length > 0 ? selected : component.evidence_ids;
      })(),
      event_ids: (() => {
        const selected = toArray(brief.event_ids).filter(id => component.event_ids.includes(id));
        return selected.length > 0 ? selected : component.event_ids;
      })(),
      social_evidence_ids: toArray(brief.social_evidence_ids),
      claims_supported: toArray(brief.claims_supported),
      claims_to_avoid: [...new Set([...(toArray(brief.claims_to_avoid)), ...(toArray(basePlan.narrative_warnings).map(item => item.claim))])],
      depth: ['minimal', 'standard', 'detailed'].includes(brief.depth) ? brief.depth : component.depth,
      target_sentence_budget: component.target_sentence_budget,
      narrative_position: component.narrative_position || null,
      editorial_questions: component.editorial_questions || []
    };
  });

  return {
    ...basePlan,
    planner_version: PLANNER_VERSION,
    component_briefs: componentBriefs,
    headline_brief: generated.headline_brief || {
      angle: basePlan.headline_direction.suggested_headline_focus,
      claims_supported: [],
      claims_to_avoid: basePlan.headline_direction.avoid_labels
    },
    overall_claims_to_avoid: [...new Set([
      ...toArray(generated.overall_claims_to_avoid),
      ...toArray(basePlan.narrative_warnings).filter(item => item.status !== 'permitted_with_evidence').map(item => item.claim)
    ])]
  };
}

async function buildComponentEditorialPlanV35(params) {
  const basePlan = buildEditorialPlan(params);
  const prompt = plannerPrompt({ basePlan, interpretation: params.interpretation, authoritativeMatchFacts: params.authoritativeMatchFacts });
  const model = process.env.INTERPRETATION_MODEL || process.env.REPORT_MODEL || 'gpt-4o-mini';
  const systemPrompt = 'You are a precise football editor. Return only JSON editorial briefs, never article prose.';

  if (params.trace) {
    params.trace.prompt_version = PLANNER_VERSION;
    params.trace.prompt_hash = crypto.createHash('sha256').update(prompt).digest('hex');
    params.trace.model = model;
    params.trace.system_prompt = systemPrompt;
    params.trace.started_at = new Date();
    params.trace.input_snapshot = { base_plan: basePlan, authoritative_match_facts: params.authoritativeMatchFacts, curated_evidence: curatedEvidence(params.interpretation) };
    params.trace.prompt = prompt;
  }

  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 2200,
    response_format: { type: 'json_object' }
  });
  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('No V3.5 editorial plan output from model');

  const plan = mergeBriefs(basePlan, JSON.parse(text));
  if (params.trace) {
    params.trace.completed_at = new Date();
    params.trace.output = plan;
  }
  return plan;
}

module.exports = { buildComponentEditorialPlanV35, PLANNER_VERSION };
