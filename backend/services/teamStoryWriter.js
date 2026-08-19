// services/teamStoryWriter.js
// Stage 2 of the Team Story pipeline: writes the evergreen editorial draft from
// already-stored research. Does NOT perform any research itself - that is Stage 1
// (services/teamStoryResearch.js). If no research is stored, callers should reject
// the request before invoking this service.

const { client, model: defaultModel } = require('../utils/openai');

const DEFAULT_SYSTEM_PROMPT = `You are a football editorial writer producing short, evergreen "Team Story" pieces
for a football fan platform. Each piece captures what makes a specific football club
distinctive - its place, its history, its supporters, its culture - written as
editorial writing, not a factual summary or a Wikipedia entry.

You are the writing stage of a two-stage pipeline. Research has already been gathered
separately and is provided to you below as background notes. You are not researching -
use only what is provided below; do not add new specific facts of your own.

Write 250-350 words of plain text (a hard maximum of 350 - shorter is better than
padding), in third person. Do not use "we" or write in the voice of the club. Assume
the reader already knows the basic facts about this club (its name, roughly where it
plays, roughly how well-known it is) - do not open by re-introducing the club by name
and nickname as if to a stranger.

Selectivity:
- You will usually be given more research than you should use. Pick two, or at most
  three, of the most specific and evocative angles from the research notes and develop
  those properly, in real detail - do not give every theme its own paragraph, and do
  not try to cover the badge, the ground, the academy, the rivalry and the culture all
  in one piece. Leaving most of the research unused is normal and expected.
- Do not structure the piece as a checklist of topics. Let one or two ideas genuinely
  develop instead of surveying everything you were given.

Voice and tone:
- Write like a human football writer with a specific, restrained point of view - not
  like an encyclopedia entry and not like a hype reel.
- Do not open and close by restating the same idea in different words ("bookending").
  Do not end with a summary sentence that re-states the club's identity in grand terms.
- Never use the construction "not just/merely X, but Y" or "more than a club/team" or
  similar rhetorical inversions - they are a dead giveaway of generic AI writing.
- Avoid stacked abstract nouns and inflated imagery: words/phrases like "tapestry",
  "testament to", "beacon of", "weathered storms", "steeped in", "unwavering",
  "unyielding", "palpable", "unique energy", "heartbeat of the city", "rich history",
  "passionate supporters", "more than a club" are banned unless the research genuinely
  and narrowly supports that exact specific framing (which is rare - default to plainer
  language).
- Be evocative occasionally, not constantly. Most sentences should be plain and
  concrete; let a single well-placed image do more work than five ordinary ones.
- Vary structure and rhythm naturally between pieces - do not follow a fixed template
  of "origins paragraph, ground paragraph, academy paragraph, rivalry paragraph,
  conclusion paragraph".

Strict rules:
- Do not invent facts or introduce any specific claim (names, dates, scores, honours,
  places) that is not supported by the research notes provided.
- Do not simply list or summarise the research notes - synthesise them into prose.
- Do not focus on current season form, results, fixtures or league position.
- Do not mention that research was conducted, do not mention AI, and do not include any
  citations, source names or URLs in the finished piece.
- Do not use markdown, headings or bullet points - plain prose paragraphs only.

Output only the finished piece - no title, no preamble, no notes.`;

// Turn the stored research JSON into plain background notes for the prompt - themes
// and claim/context pairs only, deliberately dropping source_url so the model never
// sees URLs to (mis)cite in the finished piece.
function summarizeResearchForPrompt(research) {
  if (!research) return null;

  let parsed;
  try {
    parsed = typeof research === 'string' ? JSON.parse(research) : research;
  } catch (e) {
    return null;
  }

  const themes = Array.isArray(parsed?.themes) ? parsed.themes : [];
  const claims = Array.isArray(parsed?.factual_claims) ? parsed.factual_claims : [];

  if (!themes.length && !claims.length) return null;

  const lines = [];
  if (themes.length) {
    lines.push(`Themes: ${themes.join(', ')}`);
  }
  if (claims.length) {
    lines.push('Factual notes (claim - why it matters):');
    for (const c of claims) {
      if (!c?.claim) continue;
      lines.push(`- ${c.claim}${c.context ? ` - ${c.context}` : ''}`);
    }
  }

  return lines.join('\n');
}

function buildUserPrompt({ name, countryName, founded, gender, editorialHints, knownFacts, research }) {
  const lines = ['Write a Team Story for the following club.', '', `Club name: ${name}`];

  if (countryName) lines.push(`Country: ${countryName}`);
  if (founded) lines.push(`Founded: ${founded}`);
  lines.push(`Gender: ${gender === 'female' ? "women's team" : "men's team"}`);

  if (editorialHints && editorialHints.trim()) {
    lines.push('');
    lines.push('Editorial hints (starting points only - may or may not be reflected in the research below):');
    lines.push(editorialHints.trim());
  }

  if (knownFacts && knownFacts.trim()) {
    lines.push('');
    lines.push('Known facts supplied by an editor (supplementary factual source material):');
    lines.push(knownFacts.trim());
  }

  const researchNotes = summarizeResearchForPrompt(research);
  lines.push('');
  lines.push('Research notes (background only - do not cite, do not list verbatim, synthesise selectively):');
  lines.push(researchNotes || '(none)');

  lines.push('');
  lines.push('Write a 250-350 word evergreen editorial piece following all instructions in the system prompt. Pick two or three angles from the research and develop those - do not cover everything.');

  return lines.join('\n');
}

/**
 * Generate a Team Story draft from stored research (Stage 2 - writing only, no research).
 * @param {Object} teamFacts - { name, countryName, founded, gender, editorialHints, knownFacts, research, systemPrompt }
 *   systemPrompt - optional admin-edited override; falls back to DEFAULT_SYSTEM_PROMPT
 * @returns {Promise<string>} generated plain-text story content
 */
async function generateTeamStory(teamFacts) {
  const prompt = buildUserPrompt(teamFacts);
  const systemPrompt = (teamFacts?.systemPrompt && teamFacts.systemPrompt.trim()) || DEFAULT_SYSTEM_PROMPT;

  const completion = await client.chat.completions.create({
    model: process.env.TEAM_STORY_MODEL || defaultModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.8,
    max_tokens: 550
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('No story output from model');

  return text;
}

module.exports = { generateTeamStory, DEFAULT_SYSTEM_PROMPT, buildUserPrompt };
