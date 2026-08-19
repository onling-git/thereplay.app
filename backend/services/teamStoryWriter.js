// services/teamStoryWriter.js
// Stage 2 of the Team Story pipeline: writes the evergreen editorial draft from
// already-stored research. Does NOT perform any research itself - that is Stage 1
// (services/teamStoryResearch.js). If no research is stored, callers should reject
// the request before invoking this service.

const { client, model: defaultModel } = require('../utils/openai');

const SYSTEM_PROMPT = `You are a football editorial writer producing short, evergreen "Team Story" pieces
for a football fan platform. Each piece captures what makes a specific football club
distinctive - its place, its history, its supporters, its culture - written as
editorial writing, not a factual summary or a Wikipedia entry.

You are the writing stage of a two-stage pipeline. Research has already been gathered
separately and is provided to you below as background notes. You are not researching -
use only what is provided below; do not add new specific facts of your own.

Write 300-500 words of plain text, in third person. Do not use "we" or write in the
voice of the club. Assume the reader already knows the basic facts about this club
(its name, roughly where it plays, roughly how well-known it is) - do not explain or
introduce it as if to a stranger.

Style:
- Feel specific to this individual club, not interchangeable with any other club.
- Use interesting historical details selectively and evocatively - not as a list, and
  not as a chronological history lesson.
- Connect the club to its place, history, supporters and culture only where the
  research notes below actually support it.
- Be evocative, and occasionally poetic where it feels earned, but stay restrained and
  authentic rather than overwrought.
- Vary your structure and voice naturally - do not follow a fixed template.
- Avoid generic football-writing cliches such as "heartbeat of the city", "rich
  history", "passionate supporters", "more than a club", "steeped in tradition" -
  unless the research genuinely and narrowly supports that exact framing.

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
  lines.push('Write a 300-500 word evergreen editorial piece following all instructions in the system prompt.');

  return lines.join('\n');
}

/**
 * Generate a Team Story draft from stored research (Stage 2 - writing only, no research).
 * @param {Object} teamFacts - { name, countryName, founded, gender, editorialHints, knownFacts, research }
 * @returns {Promise<string>} generated plain-text story content
 */
async function generateTeamStory(teamFacts) {
  const prompt = buildUserPrompt(teamFacts);

  const completion = await client.chat.completions.create({
    model: process.env.TEAM_STORY_MODEL || defaultModel,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 900
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('No story output from model');

  return text;
}

module.exports = { generateTeamStory, SYSTEM_PROMPT, buildUserPrompt };
