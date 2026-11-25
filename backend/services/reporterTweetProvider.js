const twitterService = require('../utils/twitterService');
const xReporterSearch = require('./xReporterSearch');
const Checkpoint = require('../models/ReporterCollectionCheckpoint');
const crypto = require('crypto');

function checkpointId(handles, options) {
  if (!options.matchId || !options.teamId) throw new Error('Match and team IDs are required for reporter collection');
  const handlesKey = handles.map(handle => String(handle).replace(/^@/, '').toLowerCase()).sort().join(',');
  return crypto.createHash('sha256').update(`${options.matchId}:${options.teamId}:${handlesKey}`).digest('hex');
}

function isConfigured() {
  return process.env.REPORTER_TWEET_PROVIDER === 'x'
    ? Boolean(process.env.X_API_BEARER_TOKEN || (process.env.X_REPORTER_FALLBACK_ENABLED === 'true' && process.env.TWITTERAPI_KEY))
    : Boolean(process.env.TWITTERAPI_KEY);
}

async function searchByUser(handles, options) {
  const provider = process.env.REPORTER_TWEET_PROVIDER || 'twitterapi';
  if (provider === 'twitterapi') {
    const result = await twitterService.searchByUser(handles, options);
    return { ...result, apiSource: 'twitterapi.io' };
  }
  if (provider !== 'x') throw new Error(`Unknown reporter tweet provider: ${provider}`);
  const id = checkpointId(handles, options);
  const checkpoint = await Checkpoint.findById(id).lean();
  const start = new Date(options.since);
  const previous = checkpoint?.collected_through && new Date(checkpoint.collected_through);
  const since = previous && previous > start
    ? new Date(Math.max(start.getTime(), previous.getTime() - 2 * 60 * 1000))
    : start;
  const until = new Date(options.until);
  try {
    const result = await xReporterSearch.searchReporterPosts(handles, {
      since, until, bearerToken: process.env.X_API_BEARER_TOKEN
    });
    result.commitCheckpoint = async () => Checkpoint.updateOne(
      { _id: id },
      { $max: { collected_through: until }, $set: { expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
      { upsert: true }
    );
    return result;
  } catch (error) {
    if (process.env.X_REPORTER_FALLBACK_ENABLED !== 'true' || !process.env.TWITTERAPI_KEY) throw error;
    console.error('[reporter-tweets] X search failed; trying TwitterAPI.io:', error.response?.status || error.message);
    const result = await twitterService.searchByUser(handles, options);
    return { ...result, apiSource: 'twitterapi.io' };
  }
}

module.exports = { isConfigured, searchByUser };
