// services/teamStoryResearch.js
// Stage 1 of the Team Story pipeline: gathers structured, source-backed research
// about a club's evergreen identity. Does NOT write finished prose.
//
// Uses OpenAI's Responses API (client.responses.create) with the built-in web_search
// tool so factual claims can be grounded in real, cited URLs rather than invented by
// the model. Requires a model/plan that supports the web_search tool - verify the
// exact tool name/model support against the OpenAI dashboard for your account; adjust
// TEAM_STORY_RESEARCH_MODEL or the tool type below if OpenAI renames/versions it.

const { client, model: defaultModel } = require('../utils/openai');

const DEFAULT_SYSTEM_PROMPT = `You are a research assistant for a football editorial platform. Your job is NOT to
write an article. You are gathering structured, source-backed research about a football
club's evergreen identity, to be used later by a separate writing stage.

Use web search to find reliable information about:
- origins
- relationship with its city/region
- stadiums and important places
- supporter identity
- traditions
- rivalries
- important historical moments
- notable achievements where relevant
- academy/youth identity
- cultural significance
- recurring themes in the club's history

Ignore current-season form, fixtures, league position, transfer news, or any other
temporary/current information - only evergreen identity matters.

Accuracy rules:
- Do not invent facts. If you cannot find a reliable source for a specific claim, do not
  include it as an established fact.
- Every factual claim must include the URL of a source that supports it.
- Prefer authoritative sources: official club sources, reputable football/history
  publications, and reputable local news/history sources.

Return ONLY a JSON object with this exact shape, and nothing else (no prose, no
headings, no markdown fences):
{
  "themes": ["short theme label", ...],
  "factual_claims": [
    { "claim": "a specific factual statement", "context": "why this matters to the club's identity", "source_url": "https://..." }
  ],
  "sources": ["https://...", ...]
}`;

function buildResearchPrompt({ name, countryName, founded, gender, editorialHints }) {
  const lines = ['Research the following football club:', '', `Club name: ${name}`];

  if (countryName) lines.push(`Country: ${countryName}`);
  if (founded) lines.push(`Founded: ${founded}`);
  lines.push(`Gender: ${gender === 'female' ? "women's team" : "men's team"}`);
  lines.push('');

  if (editorialHints && editorialHints.trim()) {
    lines.push('Starting points to guide research (not the complete research - continue beyond these):');
    lines.push(editorialHints.trim());
    lines.push('');
  }

  lines.push('Research this club\'s evergreen identity as instructed in the system prompt.');

  return lines.join('\n');
}

// Pull any citation URLs the model attached via the web_search tool, as a cross-check
// against the source_url values it wrote directly into the JSON.
function extractCitationUrls(response) {
  const urls = [];
  const output = response?.output || [];
  for (const item of output) {
    const contents = item?.content || [];
    for (const c of contents) {
      const annotations = c?.annotations || [];
      for (const a of annotations) {
        if (a?.url) urls.push(a.url);
      }
    }
  }
  return urls;
}

function parseResearchJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse research output as JSON');
  }
}

/**
 * Run Stage 1 research for a club.
 * @param {Object} teamFacts - { name, countryName, founded, gender, editorialHints, systemPrompt }
 *   systemPrompt - optional admin-edited override; falls back to DEFAULT_SYSTEM_PROMPT
 * @returns {Promise<{research: string, sources: string[], model: string}>}
 */
async function researchTeamStory(teamFacts) {
  const prompt = buildResearchPrompt(teamFacts);
  const modelToUse = process.env.TEAM_STORY_RESEARCH_MODEL || defaultModel;
  const systemPrompt = (teamFacts?.systemPrompt && teamFacts.systemPrompt.trim()) || DEFAULT_SYSTEM_PROMPT;

  const response = await client.responses.create({
    model: modelToUse,
    tools: [{ type: 'web_search' }],
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]
  });

  const text = response.output_text?.trim();
  if (!text) throw new Error('No research output from model');

  const parsed = parseResearchJson(text);

  const themes = Array.isArray(parsed.themes) ? parsed.themes : [];
  const factualClaims = Array.isArray(parsed.factual_claims) ? parsed.factual_claims : [];
  const explicitSources = Array.isArray(parsed.sources) ? parsed.sources : [];
  const citationUrls = extractCitationUrls(response);

  const sources = Array.from(new Set(
    [...factualClaims.map(c => c.source_url), ...explicitSources, ...citationUrls].filter(Boolean)
  ));

  // Stored as structured JSON (not prose) so it's unambiguously "research", distinct
  // from the finished Team Story content produced by the (separate, not-yet-built)
  // writing stage.
  const research = JSON.stringify({ themes, factual_claims: factualClaims, sources }, null, 2);

  return { research, sources, model: modelToUse };
}

module.exports = { researchTeamStory, DEFAULT_SYSTEM_PROMPT };
