const { registerVenue } = require('../utils/venue');
const { buildLiveMatchGraph, isFinalMatch } = require('../utils/liveMatchSchema');

async function refreshLiveMatchStructuredData(match, attempt = 0) {
  if (match.structured_data_frozen_at && match.structured_data) return match.structured_data;
  const venue = await registerVenue(match.match_info?.venue);
  const graph = buildLiveMatchGraph(match, venue || match.match_info?.venue);
  const Match = require('../models/Match');
  const frozenAt = isFinalMatch(match) ? new Date() : null;
  const result = await Match.updateOne(
    { _id: match._id, updatedAt: match.updatedAt, structured_data_frozen_at: null },
    { $set: { structured_data: graph, structured_data_frozen_at: frozenAt } },
    { timestamps: false }
  );
  if (result.matchedCount === 0) {
    if (attempt >= 3) throw new Error('Match changed repeatedly while refreshing structured data; retry the request');
    const current = await Match.findById(match._id).lean();
    if (!current) throw new Error('Match disappeared while refreshing structured data');
    return refreshLiveMatchStructuredData(current, attempt + 1);
  }
  return graph;
}

async function refreshLiveMatchStructuredDataAfterSync(match) {
  try {
    await refreshLiveMatchStructuredData(match);
  } catch (error) {
    // Optional SEO enrichment must not prevent persisted match data reaching reports.
    console.warn(`[structured data] Refresh failed after syncing match ${match.match_id}:`, error.message);
  }
}

module.exports = { refreshLiveMatchStructuredData, refreshLiveMatchStructuredDataAfterSync };
