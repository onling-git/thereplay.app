const axios = require('axios');
const { client } = require('../utils/openai');

const REPORT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    summary_paragraphs: { type: 'array', items: { type: 'string' } },
    key_moments: { type: 'array', items: { type: 'string' } },
    commentary: { type: 'array', items: { type: 'string' } },
    used_claim_ids: { type: 'array', items: { type: 'string' } },
    used_social_source_ids: { type: 'array', items: { type: 'string' } },
    player_of_the_match: {
      type: 'object',
      properties: { player: { type: ['string', 'null'] }, reason: { type: 'string' } },
      required: ['player', 'reason'],
      additionalProperties: false
    },
    sources: { type: 'array', items: { type: 'string' } }
  },
  required: ['headline', 'summary_paragraphs'],
  additionalProperties: false
};

function getReportWriterConfig(provider = 'openai', openaiModel = process.env.REPORT_MODEL || 'gpt-4o-mini') {
  if (!['openai', 'claude'].includes(provider)) {
    const error = new Error('writerProvider must be openai or claude');
    error.status = 400;
    throw error;
  }
  if (provider === 'claude' && !process.env.CLAUDE_API_KEY) {
    const error = new Error('CLAUDE_API_KEY is not configured on the server');
    error.status = 503;
    throw error;
  }
  return {
    provider,
    model: provider === 'claude'
      ? process.env.CLAUDE_REPORT_MODEL || 'claude-opus-5-5'
      : openaiModel
  };
}

async function completeReport({ provider, model, systemPrompt, prompt, temperature, maxTokens = 2500, openaiOptions }) {
  getReportWriterConfig(provider);
  if (provider === 'claude') {
    const generationOptions = model === 'claude-opus-5-5'
      ? { output_config: { effort: 'high' }, max_tokens: Math.max(maxTokens, 16000) }
      : { temperature, max_tokens: maxTokens };
    let data;
    try {
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        ...generationOptions,
        output_config: {
          ...generationOptions.output_config,
          format: { type: 'json_schema', schema: REPORT_RESPONSE_SCHEMA }
        }
      }, {
        headers: {
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 120000
      });
      data = response.data;
    } catch (error) {
      throw new Error(`Claude report request failed (${error.response?.status || 'network/timeout'}): ${error.response?.data?.error?.message || 'Unable to contact Anthropic'}`);
    }
    if (data.stop_reason !== 'end_turn') {
      throw new Error(`Claude report did not complete: ${data.stop_reason || 'unknown stop reason'}`);
    }
    return (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim()
      .replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
  }
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    ...(openaiOptions || { temperature, max_tokens: maxTokens }),
    response_format: { type: 'json_object' }
  });
  return completion.choices?.[0]?.message?.content?.trim();
}

module.exports = { getReportWriterConfig, completeReport };