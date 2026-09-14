const crypto = require('crypto');
const { client } = require('../utils/openai');

const WRITER_VERSION = 'v3.5-component-writer-2026-09-01.1';

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function indexEvidence(interpretation, plan) {
  const index = new Map();
  toArray(interpretation.scoring_evidence).forEach((item, offset) => index.set(`scoring_evidence_${offset + 1}`, item));
  toArray(interpretation.match_progression?.phases).forEach((item, offset) => index.set(`phase_${offset + 1}`, item));
  toArray(interpretation.pressure_evidence?.useful_observations).forEach((item, offset) => index.set(`pressure_obs_${offset + 1}`, item));
  toArray(plan.evidence_usage?.social_sources_worth_using).forEach(item => index.set(item.evidence_id, item));
  toArray(plan.evidence_usage?.player_contributions_worth_using).forEach(item => index.set(item.evidence_id, item));
  if (plan.evidence_usage?.market_worth_using) index.set('market_context_1', plan.evidence_usage.market_worth_using);
  return index;
}

function componentEvidence(component, interpretation, plan, authoritativeMatchFacts) {
  const index = indexEvidence(interpretation, plan);
  return {
    authoritative_match_facts: authoritativeMatchFacts,
    component_evidence: component.evidence_ids.map(id => ({ evidence_id: id, value: index.get(id) || null })),
    component_events: toArray(plan.event_treatment?.events).filter(event => component.event_ids.includes(event.id)),
    social_sources: toArray(plan.evidence_usage?.social_sources_worth_using)
      .filter(source => component.social_evidence_ids.includes(source.tweet_id))
  };
}

function componentPrompt({ component, plan, evidence, priorCoverage }) {
  return `
You are Run 3, writing one component of a club-focused football report. Write only this component, not the entire article.

FOCUSED CLUB:
${JSON.stringify(plan.focused_club, null, 2)}
OPPONENT AND RESULT:
${JSON.stringify({ opponent: plan.opponent, result_context: plan.result_context }, null, 2)}

COMPONENT BRIEF (binding):
${JSON.stringify(component, null, 2)}

ALLOCATED EVIDENCE (use only this plus authoritative facts):
${JSON.stringify(evidence, null, 2)}

FACTS ALREADY COVERED BY EARLIER COMPONENTS (do not repeat unless you add new meaning):
${JSON.stringify(priorCoverage, null, 2)}

Write one natural paragraph or a short connected pair of paragraphs, respecting depth and target_sentence_budget.
- Answer the component's reader takeaway and editorial questions from allocated evidence only.
- Do not create another component, use a rejected component, invent tactics/psychology, or make unsupported causal claims.
- Do not state player assists unless the allocated evidence explicitly names the assist provider.
- If social source context is used, include its tweet_id in used_social_source_ids; otherwise leave that array empty.
- Do not output headings, labels, markdown, Key Moments, a headline, commentary, or Player of the Match.
Return strict JSON: { "content": "...", "used_social_source_ids": ["..."] }.
`.trim();
}

async function writeComponent({ component, plan, interpretation, authoritativeMatchFacts, priorCoverage, model }) {
  const evidence = componentEvidence(component, interpretation, plan, authoritativeMatchFacts);
  const prompt = componentPrompt({ component, plan, evidence, priorCoverage });
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You are a careful football journalist. Write one evidence-bound report component and return only JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.35,
    max_tokens: 600,
    response_format: { type: 'json_object' }
  });
  const output = JSON.parse(completion.choices?.[0]?.message?.content || '{}');
  return { component_id: component.component_id, content: String(output.content || '').trim(), used_social_source_ids: toArray(output.used_social_source_ids) };
}

async function writeHeadline({ plan, authoritativeMatchFacts, model }) {
  const prompt = `Write one concise, natural, club-focused football headline from this editorial brief and authoritative facts. Avoid generic result templates. Return only JSON {"headline":"..."}.

${JSON.stringify({ focused_club: plan.focused_club, result_context: plan.result_context, headline_brief: plan.headline_brief, authoritative_match_facts: authoritativeMatchFacts }, null, 2)}`;
  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: 'system', content: 'You write concise factual football headlines. Return only JSON.' }, { role: 'user', content: prompt }],
    temperature: 0.25,
    max_tokens: 120,
    response_format: { type: 'json_object' }
  });
  return String(JSON.parse(completion.choices?.[0]?.message?.content || '{}').headline || '').trim();
}

function buildKeyMoments(authoritativeMatchFacts) {
  return toArray(authoritativeMatchFacts?.scoring_events).map(event => {
    const minute = event.extra_minute ? `${event.minute}+${event.extra_minute}` : event.minute;
    return `${minute}' - ${event.scorer} (${event.side}) ${event.result ? `made it ${event.result}` : 'scored'}.`;
  });
}

async function writeMatchReportComponentsV35({ interpretation, editorialPlan, potm, authoritativeMatchFacts, trace = null }) {
  const model = process.env.REPORT_MODEL || 'gpt-4o-mini';
  const ordered = editorialPlan.component_plan.component_order;
  const componentMap = new Map(editorialPlan.component_briefs.map(component => [component.component_id, component]));
  const components = ordered.map(id => componentMap.get(id)).filter(Boolean);
  const componentOutputs = [];
  const priorCoverage = [];

  const headline = await writeHeadline({ plan: editorialPlan, authoritativeMatchFacts, model });
  for (const component of components) {
    const output = await writeComponent({ component, plan: editorialPlan, interpretation, authoritativeMatchFacts, priorCoverage, model });
    componentOutputs.push(output);
    if (output.content) priorCoverage.push({ component_id: output.component_id, content: output.content });
  }

  const usedSocialIds = [...new Set(componentOutputs.flatMap(output => output.used_social_source_ids))]
    .filter(id => toArray(editorialPlan.evidence_usage?.social_sources_worth_using).some(source => source.tweet_id === id));
  const potmReason = interpretation.player_context?.supported_reason || potm.reason || 'Selected from the available player-rating evidence.';
  const report = {
    headline: headline || `${editorialPlan.focused_club.name} ${editorialPlan.result_context.focused_outcome === 'win' ? 'win' : 'report'} against ${editorialPlan.opponent.name}`,
    summary_paragraphs: componentOutputs.flatMap(output => output.content.split(/\n\s*\n/).filter(Boolean)),
    key_moments: buildKeyMoments(authoritativeMatchFacts),
    commentary: [],
    used_social_source_ids: usedSocialIds,
    player_of_the_match: { player: potm.player || 'TBD', reason: potmReason },
    sources: usedSocialIds.length ? ['Match events', 'Selected reporter context'] : ['Match events', 'Player ratings']
  };

  if (trace) {
    trace.prompt_version = WRITER_VERSION;
    trace.prompt_hash = crypto.createHash('sha256').update(JSON.stringify(editorialPlan)).digest('hex');
    trace.model = model;
    trace.system_prompt = 'Component-by-component V3.5 football writer.';
    trace.input_snapshot = { editorial_plan: editorialPlan, authoritative_match_facts: authoritativeMatchFacts };
    trace.output = { component_outputs: componentOutputs, assembled_report: report };
    trace.completed_at = new Date();
  }
  return { report, componentOutputs };
}

module.exports = { writeMatchReportComponentsV35, WRITER_VERSION };
