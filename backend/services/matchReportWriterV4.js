const crypto = require('crypto');
const { client } = require('../utils/openai');

const WRITER_VERSION = 'v4-editor-writer-2026-09-01.4';

function toArray(value) { return Array.isArray(value) ? value : []; }

function completionTokenOptions(model, tokenLimit, temperature) {
  if (model.startsWith('gpt-5')) {
    return { max_completion_tokens: tokenLimit };
  }
  return { max_tokens: tokenLimit, temperature };
}

function buildPrompt(dossier) {
  return `
You are the senior editor and football writer for ${dossier.focused_club.name} supporters.
Write one club-focused report from the complete verified editorial dossier below. Decide the story and prose together; do not invent evidence beyond it.

EDITORIAL DOSSIER:
${JSON.stringify(dossier, null, 2)}

Editorial framework (use naturally, without headings):
1. Opening: result and the strongest evidence-supported reason this match matters.
2. Match development: explain meaningful phases and changes, not a chronological goal list.
3. Performance: state what the combined evidence establishes about the focused club; where evidence is mixed or incomplete, be restrained.
4. Defining sequence: give detail to only the events that changed the match meaningfully. Routine events can be brief or stay in Key Moments.
5. Closing: conclude with what actually decided the result; do not repeat the score or invent wider implications.

REPORT DEPTH AND EDITORIAL BEATS (binding coverage guidance):
${JSON.stringify(dossier.report_guidance, null, 2)}

Rules:
- The dossier has a strict hierarchy: authoritative_facts, supported_observations, permitted_interpretations. Never contradict it.
- Treat player_roles as closed facts. Only assist_provider may be called an assister. Do not transfer one player's involvement to another goal.
- Pressure occurring before a goal is a temporal relationship, not proof of causation. Do not say pressure "led to", "set up", "resulted in", or "produced" a goal unless the observation explicitly establishes that relationship. Prefer "the score remained level through that pressure period before...".
- Do not call the performance dominant, comfortable, deserved, convincing, resilient, or a comeback unless the dossier specifically supports the exact claim.
- Do not use generic substitutes for unsupported analysis, including "commanding", "important", "crucial", "attacking prowess", "composure under pressure", "regained control", or "set the tone". State the supplied phase, event, or uncertainty instead.
- Market expectation is optional supporting context. Do not open with it or use it as the match's significance unless it changes the interpretation of the result.
- Where a late goal restores a lead and a later goal extends it, make that distinction. The restoring goal may be described as the late winner where supported; the later goal is the final margin, not a second decisive event by default.
- Give the late sequence one primary treatment. Do not restate it in the closing unless the closing adds a distinct, supported conclusion about what decided the match.
- verified_match_context contains authoritative substitutions, discipline, and lineup context. Use it only when it gives material context to a selected event or match phase; never claim a substitution or dismissal caused a later event unless the dossier explicitly establishes that relationship.
- verified_match_context.event_relationships identifies only factual sequence and explicit scoring roles. You may state that a substitute later scored/assisted, or that a dismissal preceded a penalty, when use_in_report is true. Never turn those chronological relationships into cause and effect.
- verified_match_context.comment_evidence contains the only provider-comment details permitted in prose. Do not quote its wording, and do not use raw comments or infer additional detail from their event association.
- This is a full post-match report when report_guidance.report_depth is "full", not a teaser. Develop every non-minimal editorial beat enough to answer its stated purpose, using the allocated primary and supporting facts.
- Do not impose a word count or one paragraph per beat. Combine related beats naturally, but ensure the reader learns about the opening phase, opposition response, any substantial level phase, the decisive sequence, and the evidence-based performance reading when those beats are marked standard or detailed.
- A minimal beat may be one clause or omitted when its purpose is already served. Never expand a minimal beat merely to increase length.
- Treat evidence_priority.primary_fact_ids as the report's main narrative material. Use supporting_fact_ids to add non-repetitive context. Do not promote optional_context unless it materially changes the interpretation.
- Do not force every statistic, source, event, or framework item into prose. Use a detail only when it improves match understanding.
- Avoid generic football cliches, scoreline repetition, event-dump chronology, and template headlines. Do not use "[Club] Secure(s) Victory", "[Club] Triumph(s) Over", "[Club] Claim(s) Victory", or equivalent result templates. Use the specific decisive sequence or a restrained factual headline instead.
- Reporter facts may be used naturally without quote or attribution. Record a reporter source ID only when its factual context appears materially in prose.
- Player of the Match reason must use the supplied_reason or player_context evidence; do not invent contributions.

Return strict JSON only:
{
  "headline": "specific club-focused headline",
  "summary_paragraphs": ["coherent report paragraphs"],
  "key_moments": ["concise chronological facts"],
  "commentary": [],
  "used_social_source_ids": ["source IDs materially used"],
  "player_of_the_match": { "player": "...", "reason": "..." },
  "sources": ["..."]
}
`.trim();
}

function validateReport(report, dossier) {
  const issues = new Set();
  const reportText = JSON.stringify(report).toLowerCase();
  const finalScore = dossier.authoritative_facts.final_score;
  if (!reportText.includes(`${finalScore.home}-${finalScore.away}`)) issues.add(`State the final score as ${finalScore.home}-${finalScore.away}.`);
  for (const event of dossier.authoritative_facts.scoring_events) {
    const buildUpContributor = event.player_roles.build_up_contributors[0];
    if (event.player_roles.assist_provider && buildUpContributor && reportText.includes(`${buildUpContributor.toLowerCase()} assisted`)) {
      issues.add('Do not convert build-up involvement into an assist.');
    }
  }
  for (const claim of dossier.prohibited_or_unsupported_claims) {
    if (claim && new RegExp(`\\b${String(claim).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(reportText)) issues.add(`Remove unsupported claim: ${claim}.`);
  }
  return [...issues];
}

async function repairReport({ report, issues, dossier, model, trace }) {
  const repairPrompt = `
Correct this draft report using only the dossier. Preserve correct material and the exact JSON shape.

DOSSIER:
${JSON.stringify(dossier, null, 2)}

DRAFT:
${JSON.stringify(report, null, 2)}

REQUIRED CORRECTIONS:
${issues.map(issue => `- ${issue}`).join('\n')}

Do not invent player relationships, causation, performance judgements, or wider implications. Return only corrected JSON.
`.trim();
  if (trace) trace.repair_prompt = repairPrompt;
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'system', content: 'You correct football reports only from verified dossier facts. Return only JSON.' }, { role: 'user', content: repairPrompt }],
    ...completionTokenOptions(model, 2200, 0.1),
    response_format: { type: 'json_object' }
  });
  return JSON.parse(response.choices?.[0]?.message?.content || '{}');
}

async function writeMatchReportV4({ dossier, trace = null }) {
  const model = process.env.V4_EDITOR_WRITER_MODEL || process.env.REPORT_MODEL || 'gpt-4o-mini';
  const prompt = buildPrompt(dossier);
  const systemPrompt = 'You are an evidence-disciplined football editor. Return only the requested JSON report.';
  if (trace) {
    trace.prompt_version = WRITER_VERSION;
    trace.prompt_hash = crypto.createHash('sha256').update(prompt).digest('hex');
    trace.model = model;
    trace.system_prompt = systemPrompt;
    trace.started_at = new Date();
    trace.input_snapshot = { dossier };
    trace.prompt = prompt;
  }
  const response = await client.chat.completions.create({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }], ...completionTokenOptions(model, 2200, 0.35), response_format: { type: 'json_object' } });
  let report = JSON.parse(response.choices?.[0]?.message?.content || '{}');
  let issues = validateReport(report, dossier);
  if (issues.length > 0) {
    report = await repairReport({ report, issues, dossier, model, trace });
    issues = validateReport(report, dossier);
  }
  if (issues.length) throw new Error(`V4 report validation failed: ${issues.join(' ')}`);
  const reporterIds = new Set(dossier.supported_observations.reporter_facts.map(item => item.source_id));
  report.used_social_source_ids = toArray(report.used_social_source_ids).filter(id => reporterIds.has(String(id))).map(String);
  report.player_of_the_match = report.player_of_the_match || { player: dossier.supported_observations.potm.player || 'TBD', reason: dossier.supported_observations.potm.supplied_reason || 'No supported reason available.' };
  report.meta = { generated_by: model, generated_at: new Date().toISOString(), pipeline_version: '4.0', writer_prompt_version: WRITER_VERSION };
  if (trace) { trace.completed_at = new Date(); trace.output = report; }
  return report;
}

module.exports = { writeMatchReportV4, WRITER_VERSION };
