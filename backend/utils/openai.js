// utils/openai.js
const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.warn('[openai] Warning: OPENAI_API_KEY missing. Report generation will fail.');
}

const client = new OpenAI({ apiKey });
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

module.exports = { client, model };
