// utils/leagueHelper.js
// Helpers for reading which leagues are enabled in the DB (League Management feature).
// Fails open: if the leagues collection is empty (migration not run yet), these
// return null instead of [] so callers can fall back to their built-in lists.
const League = require('../models/League');

// Get the IDs of all enabled leagues.
// Returns an array of numbers, or null when no league has been enabled yet
// (i.e. the feature isn't configured) so callers can use their default list.
async function getEnabledLeagueIds() {
  const leagues = await League.find({ enabled: true }).select('id').lean();
  if (leagues.length === 0) return null;
  return leagues.map(l => l.id);
}

// Get all enabled leagues with full details, sorted by priority (highest first).
async function getEnabledLeagues() {
  return League.find({ enabled: true })
    .populate({ path: 'country', select: 'id name iso2' })
    .sort({ priority: -1, name: 1 })
    .lean();
}

// Check if a single league is enabled.
async function isLeagueEnabled(leagueId) {
  const league = await League.findOne({ id: Number(leagueId), enabled: true }).select('id').lean();
  return !!league;
}

// Get leagues grouped by country: { country_id: { country: {...}, leagues: [...] } }
async function getLeaguesByCountry() {
  const leagues = await League.find({})
    .populate({ path: 'country', select: 'id name iso2' })
    .sort({ name: 1 })
    .lean();

  const grouped = {};
  for (const league of leagues) {
    const cid = league.country_id;
    if (!grouped[cid]) {
      grouped[cid] = { country: league.country || { id: cid, name: 'Unknown' }, leagues: [] };
    }
    grouped[cid].leagues.push(league);
  }
  return grouped;
}

module.exports = {
  getEnabledLeagueIds,
  getEnabledLeagues,
  isLeagueEnabled,
  getLeaguesByCountry
};
