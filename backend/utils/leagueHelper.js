// utils/leagueHelper.js
// Effective coverage is authoritative, including an intentionally empty selection.
const League = require('../models/League');

// Get the IDs of all enabled leagues.
async function getEnabledLeagueIds() {
  return (await require('../services/coveragePolicy').getCoverage()).competitionIds;
}

// Get all enabled leagues with full details, sorted by priority (highest first).
async function getEnabledLeagues() {
  return League.find({ id: { $in: await getEnabledLeagueIds() } })
    .populate({ path: 'country', select: 'id name iso2' })
    .sort({ priority: -1, name: 1 })
    .lean();
}

// Check if a single league is enabled.
async function isLeagueEnabled(leagueId) {
  return (await getEnabledLeagueIds()).includes(Number(leagueId));
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
