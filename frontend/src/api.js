// src/api.js
const API_BASE = process.env.REACT_APP_API_BASE || 'https://virtuous-exploration-production.up.railway.app';

console.log('[API] Using API_BASE:', API_BASE);

// Helper to add timeout to promises
function withTimeout(promise, ms, timeoutError = 'Request timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(timeoutError)), ms)
    )
  ]);
}

async function req(path, opts = {}) {
  const url = API_BASE + path;
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let body;
    try { body = JSON.parse(text); } catch { body = text || res.statusText; }
    const err = new Error('API error');
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json().catch(() => null);
}

export async function getTeamSnapshot(teamSlug) {
  return req(`/api/teams/${encodeURIComponent(teamSlug)}`);
}

export async function getTeamWithCurrentMatches(teamSlug) {
  return req(`/api/teams/${encodeURIComponent(teamSlug)}/current`);
}

export async function getTeamCompetitions(teamSlug) {
  return req(`/api/teams/${encodeURIComponent(teamSlug)}/competitions`);
}

export async function getLastMatchForTeam(teamSlug) {
  // backend has /api/:teamName/last-match
  return req(`/api/${encodeURIComponent(teamSlug)}/last-match`);
}

export async function getMatch(teamSlug, matchId, options = {}) {
  const { enrichLineup = false, includeStatistics = false } = options;
  const params = new URLSearchParams();
  
  if (enrichLineup) {
    params.append('enrich_lineup', 'true');
  }
  
  if (includeStatistics) {
    params.append('include_statistics', 'true');
  }
  
  const queryString = params.toString();
  const url = `/api/${encodeURIComponent(teamSlug)}/match/${encodeURIComponent(matchId)}${queryString ? '?' + queryString : ''}`;
  
  return req(url);
}

// New functions to fetch matches by ID
export async function getMatchById(matchId) {
  // Generic match fetch by ID
  return req(`/api/matches/${encodeURIComponent(matchId)}`);
}

export async function getMatchReport(teamSlug, matchId) {
  return req(`/api/${encodeURIComponent(teamSlug)}/match/${encodeURIComponent(matchId)}/report`);
}

export async function getMatchSchema(teamSlug, matchId) {
  return req(`/api/${encodeURIComponent(teamSlug)}/match/${encodeURIComponent(matchId)}/schema`);
}

export async function getOpponentScout(teamSlug, matchId) {
  return req(`/api/${encodeURIComponent(teamSlug)}/match/${encodeURIComponent(matchId)}/opponent-scout`);
}

// SSE endpoint (base URL only)
export function sseMatchUrl(matchId) {
  return `${API_BASE}/api/stream/match/${encodeURIComponent(matchId)}`;
}

// League-related functions
export async function getLeagues() {
  return req('/api/leagues');
}

export async function getLeagueFixtures(leagueId, date = null) {
  const dateParam = date ? `?date=${encodeURIComponent(date)}` : '';
  return req(`/api/leagues/${encodeURIComponent(leagueId)}/fixtures${dateParam}`);
}

// Fixtures functions
export async function getAllFixtures(params = {}) {
  const searchParams = new URLSearchParams(params);
  return req(`/api/fixtures?${searchParams.toString()}`);
}

export async function getFixtureCountries() {
  return req('/api/fixtures/countries');
}

export async function getFixtureLeagues(countryId = null) {
  const countryParam = countryId ? `?country=${encodeURIComponent(countryId)}` : '';
  return req(`/api/fixtures/leagues${countryParam}`);
}

// Live scores functions
export async function getLiveMatches(limit = 50) {
  return req(`/api/matches/live?limit=${limit}`);
}

export async function getTodayMatches(date = null) {
  const dateParam = date ? `?date=${encodeURIComponent(date)}` : '';
  return req(`/api/matches/today${dateParam}`);
}

// News functions
export async function getNews(limit = 20) {
  // Add 5 second timeout to news API to prevent hanging
  return withTimeout(
    req(`/api/news?limit=${limit}`),
    5000,
    'News API timeout'
  );
}

// Team functions
export async function getTeams(params = {}) {
  const searchParams = new URLSearchParams(params);
  return req(`/api/teams?${searchParams.toString()}`);
}

export async function getTeamCountries() {
  return req('/api/teams/countries');
}

export async function getCountries(params = {}) {
  const searchParams = new URLSearchParams(params);
  return req(`/api/countries?${searchParams.toString()}`);
}

export async function getContinents() {
  return req('/api/countries/continents');
}

export async function getNewsForLeague(leagueId, limit = 20) {
  return req(`/api/news/league/${encodeURIComponent(leagueId)}?limit=${limit}`);
}

export async function getNewsMetadata() {
  const response = await req('/api/news/metadata');
  return response.data; // Extract the data from the success response
}

export async function getNewsLeagues() {
  const metadata = await getNewsMetadata();
  return metadata.leagues; // Return just the leagues array with flags
}

export async function getNewsForTeam(teamSlug, limit = 20) {
  return req(`/api/news/team/${encodeURIComponent(teamSlug)}?limit=${limit}`);
}

// Standings functions
export async function getLeagueStandings(leagueId) {
  return req(`/api/standings/league/${encodeURIComponent(leagueId)}`);
}

export async function getTeamStandings(participantId) {
  return req(`/api/standings/team/${encodeURIComponent(participantId)}`);
}
