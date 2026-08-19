// services/teamStorySelection.js
// Stage 2 of the Team Story pipeline: examines the completed research and selects
// exactly ONE editorial angle for the writing stage to develop. Does NOT perform any
// research itself (Stage 1, services/teamStoryResearch.js) and does NOT write the
// finished Team Story (Stage 3, services/teamStoryWriter.js - not yet updated to
// consume this stage's output).
//
// This is a reasoning/summarisation task over already-gathered research, not new
// fact-finding, so it uses the plain Chat Completions API (no web_search tool).

const { client, model: defaultModel } = require('../utils/openai');

const DEFAULT_SYSTEM_PROMPT = `You are an editorial strategist for a football fan platform. You are given completed
research about a football club's evergreen identity, gathered separately. Your job is
to select exactly ONE editorial angle that a short "Team Story" piece should be built
around - you do not write the piece itself.

Do not simply pick the most historically important fact. Pick the angle with the
strongest potential to make a supporter of this specific club think "yes, that's us"
or "I hadn't thought about it that way" - something that captures identity or feeling,
not just information.

For example, for a fictional club whose research covers a nickname, a former ground,
a local rivalry, an academy, and a cup win, the strongest angle might be the nickname
itself, if the research shows it carries part of the club's origin story every time
supporters use it - rather than defaulting to the cup win as "the most important fact".

Rules:
- Select exactly one theme/angle. Do not propose alternatives or a ranked list.
- The angle is a concise editorial brief for a writer, not finished prose - do not
  write any part of the actual Team Story.
- Only include factual claims that are actually needed to write this specific angle.
  Do not carry over unrelated research just because it exists.
- Do not invent facts. Every supporting claim must come directly from the research
  provided, including its exact source_url from that research.
- If the research is too thin to confidently ground a specific angle, you may select a
  more general theme (e.g. supporter identity, or place), but still ground it in
  whatever specific claims the research does support.

Return ONLY a JSON object with this exact shape, and nothing else (no prose, no
headings, no markdown fences):
{
  "selected_theme": "short, human-readable theme label",
  "angle": "a concise explanation of the editorial idea for the writer - not finished prose",
  "supporting_claims": [
    { "claim": "a specific factual statement from the research", "source_url": "https://..." }
  ]
}`;

function buildSelectionPrompt({ name, countryName, research }) {
  const lines = [`Select one editorial angle for the following club: ${name}`];
  if (countryName) lines.push(`Country: ${countryName}`);
  lines.push('');
  lines.push('Completed research (themes and factual claims with sources):');
  lines.push(research);
  lines.push('');
  lines.push('Select exactly one angle as instructed in the system prompt.');
  return lines.join('\n');
}

function parseSelectionJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse selection output as JSON');
  }
}

// Only keep claims that genuinely appear in the source research (by claim text and
// source_url) - guards against the model drifting from "only what's in the research".
function filterClaimsAgainstResearch(claims, research) {
  let knownClaims = [];
  try {
    const parsed = typeof research === 'string' ? JSON.parse(research) : research;
    knownClaims = Array.isArray(parsed?.factual_claims) ? parsed.factual_claims : [];
  } catch (e) {
    return [];
  }

  const knownSet = new Set(
    knownClaims.map(c => `${(c.claim || '').trim()}|${(c.source_url || '').trim()}`)
  );

  return (Array.isArray(claims) ? claims : []).filter(c =>
    knownSet.has(`${(c?.claim || '').trim()}|${(c?.source_url || '').trim()}`)
  );
}

/**
 * Select a single editorial angle from completed research (Stage 2 - selection only).
 * @param {Object} params - { name, countryName, research, systemPrompt }
 *   research - the stored research JSON string from Stage 1
 *   systemPrompt - optional admin-edited override; falls back to DEFAULT_SYSTEM_PROMPT
 * @returns {Promise<{selected_theme: string, angle: string, supporting_claims: Array, model: string}>}
 */
async function selectEditorialAngle({ name, countryName, research, systemPrompt }) {
  if (!research || !String(research).trim()) {
    throw new Error('No research provided to select an editorial angle from');
  }

  const prompt = buildSelectionPrompt({ name, countryName, research });
  const modelToUse = process.env.TEAM_STORY_SELECTION_MODEL || defaultModel;
  const finalSystemPrompt = (systemPrompt && systemPrompt.trim()) || DEFAULT_SYSTEM_PROMPT;

  const completion = await client.chat.completions.create({
    model: modelToUse,
    messages: [
      { role: 'system', content: finalSystemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.4,
    max_tokens: 500,
    response_format: { type: 'json_object' }
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('No selection output from model');

  const parsed = parseSelectionJson(text);

  const selectedTheme = String(parsed.selected_theme || '').trim();
  const angle = String(parsed.angle || '').trim();
  if (!selectedTheme || !angle) throw new Error('Selection output missing selected_theme or angle');

  const supportingClaims = filterClaimsAgainstResearch(parsed.supporting_claims, research);

  return { selected_theme: selectedTheme, angle, supporting_claims: supportingClaims, model: modelToUse };
}

module.exports = { selectEditorialAngle, DEFAULT_SYSTEM_PROMPT };
