// services/teamStorySelection.js
// Stage 2 of the Team Story pipeline: examines the completed research and proposes a
// handful of distinct candidate editorial angles a short "Team Story" piece could be
// built around - it does not write the piece itself, and the final choice between
// candidates is made manually by an admin, not by AI. Does NOT perform any research
// itself (Stage 1, services/teamStoryResearch.js) and does NOT write the finished Team
// Story (Stage 3, services/teamStoryWriter.js - not yet updated to consume this
// stage's output).
//
// This is a reasoning/summarisation task over already-gathered research, not new
// fact-finding, so it uses the plain Chat Completions API (no web_search tool).

const { client, model: defaultModel } = require('../utils/openai');

const DEFAULT_SYSTEM_PROMPT = `You are an editorial strategist for a football fan platform. You are given completed
research about a football club's evergreen identity, gathered separately. Your job is
to propose 3 to 5 distinct candidate editorial angles that a short "Team Story" piece
could be built around - you do not write the piece itself, and you do not rank or pick
a single winner. An admin will choose manually between the candidates you propose.

Do not simply list the most important historical facts. Each candidate should be an
angle with the potential to make a supporter of this specific club think "yes, that's
us" or "I hadn't thought about it that way" - something that captures identity or
feeling, not just information.

For example, for a fictional club whose research covers a nickname, a former ground, a
local rivalry, an academy, and a cup win, good distinct candidates might be: the
nickname itself (if it carries part of the club's origin story every time supporters
use it), the local rivalry (if it says something about identity beyond just
competition), and the academy (if it reflects something distinctive about how the club
sees itself) - each a genuinely different angle, not variations on the same one.

Rules:
- Propose 3 to 5 candidates. Each must be a genuinely distinct angle, not near-duplicates
  of each other.
- Each angle is a concise editorial brief for a writer, not finished prose - do not
  write any part of the actual Team Story for any candidate.
- For each candidate, only include the factual claims actually needed for that specific
  angle. Do not carry over unrelated research just because it exists.
- Do not invent facts. Every supporting claim must come directly from the research
  provided, including its exact source_url from that research.
- If the research is too thin to confidently ground several distinct angles, propose
  fewer (but at least 2), rather than padding with weak or repetitive candidates.

Return ONLY a JSON object with this exact shape, and nothing else (no prose, no
headings, no markdown fences):
{
  "candidates": [
    {
      "selected_theme": "short, human-readable theme label",
      "angle": "a concise explanation of the editorial idea for the writer - not finished prose",
      "supporting_claims": [
        { "claim": "a specific factual statement from the research", "source_url": "https://..." }
      ]
    }
  ]
}`;

function buildSelectionPrompt({ name, countryName, research }) {
  const lines = [`Propose candidate editorial angles for the following club: ${name}`];
  if (countryName) lines.push(`Country: ${countryName}`);
  lines.push('');
  lines.push('Completed research (themes and factual claims with sources):');
  lines.push(research);
  lines.push('');
  lines.push('Propose 3 to 5 distinct candidate angles as instructed in the system prompt.');
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
 * Propose several candidate editorial angles from completed research (Stage 2 -
 * selection only). The final choice between candidates is made manually, not here.
 * @param {Object} params - { name, countryName, research, systemPrompt }
 *   research - the stored research JSON string from Stage 1
 *   systemPrompt - optional admin-edited override; falls back to DEFAULT_SYSTEM_PROMPT
 * @returns {Promise<{candidates: Array, model: string}>}
 */
async function generateEditorialAngles({ name, countryName, research, systemPrompt }) {
  if (!research || !String(research).trim()) {
    throw new Error('No research provided to generate editorial angles from');
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
    temperature: 0.6,
    max_tokens: 1400,
    response_format: { type: 'json_object' }
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('No selection output from model');

  const parsed = parseSelectionJson(text);
  const rawCandidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];

  const candidates = rawCandidates
    .map(c => ({
      selected_theme: String(c?.selected_theme || '').trim(),
      angle: String(c?.angle || '').trim(),
      supporting_claims: filterClaimsAgainstResearch(c?.supporting_claims, research)
    }))
    .filter(c => c.selected_theme && c.angle);

  if (!candidates.length) throw new Error('Selection output contained no usable candidates');

  return { candidates, model: modelToUse };
}

module.exports = { generateEditorialAngles, DEFAULT_SYSTEM_PROMPT };
