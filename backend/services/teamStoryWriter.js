// services/teamStoryWriter.js
// Generates an evergreen editorial "Team Story" draft for a club using OpenAI.

const { client, model: defaultModel } = require('../utils/openai');

const SYSTEM_PROMPT = `You are an editorial writer for a football fan platform. You write short, evocative
"Team Story" pieces about football clubs - evergreen editorial content about a club's
identity: its place, its supporters, its history, its culture, and what makes it
distinctive. Your tone is warm, literary and specific in feeling, not a dry "About Us"
summary and not a match report. Avoid cliche phrases like "rich history" or "passionate
fanbase" without grounding them in something concrete from the facts given.

Treat the "Known facts" provided by the admin as your factual source material. Do not
introduce specific factual claims (trophy counts, dates, named players, stadium names,
historic matches, rivalries, nicknames, etc.) beyond what is supplied. Where no facts
are given for an angle, write in general, evocative terms about identity and culture
rather than inventing specifics.

Write 3-4 short paragraphs of plain text. No headings, no markdown, no bullet points,
no quotation marks around the whole piece.`;

function buildUserPrompt({ name, countryName, founded, gender, knownFacts }) {
  const lines = ['Write a Team Story for the following club:', '', `Club name: ${name}`];

  if (countryName) lines.push(`Country: ${countryName}`);
  if (founded) lines.push(`Founded: ${founded}`);
  lines.push(`Gender: ${gender === 'female' ? "women's team" : "men's team"}`);
  lines.push('');

  if (knownFacts && knownFacts.trim()) {
    lines.push('Known facts about this club (your factual source material - do not go beyond these):');
    lines.push(knownFacts.trim());
  } else {
    lines.push('No specific known facts were provided for this club. Write in general, evocative terms about identity and culture without inventing specific unverifiable history.');
  }

  lines.push('');
  lines.push('Focus on what it means to be a supporter of this club, its place in its city/country, and the general character/culture associated with it.');

  return lines.join('\n');
}

/**
 * Generate a Team Story draft.
 * @param {Object} teamFacts - { name, countryName, founded, gender, knownFacts }
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
    temperature: 0.6,
    max_tokens: 700
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('No story output from model');

  return text;
}

module.exports = { generateTeamStory };
