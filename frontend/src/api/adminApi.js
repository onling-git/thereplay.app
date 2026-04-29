// src/api/adminApi.js
const API_BASE = process.env.REACT_APP_API_BASE || 'https://virtuous-exploration-production.up.railway.app';

async function adminReq(path, opts = {}) {
  const token = localStorage.getItem('authToken');
  const url = API_BASE + path;
  
  const defaultOpts = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    },
    credentials: 'include'
  };
  
  const finalOpts = {
    ...defaultOpts,
    ...opts,
    headers: {
      ...defaultOpts.headers,
      ...opts.headers
    }
  };

  const res = await fetch(url, finalOpts);
  
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let body;
    try { 
      body = JSON.parse(text); 
    } catch { 
      body = text || res.statusText; 
    }
    const err = new Error('API error');
    err.status = res.status;
    err.body = body;
    throw err;
  }
  
  return res.json().catch(() => null);
}

// Team Management
export async function getAllTeams() {
  return adminReq('/api/admin/teams/teams');
}

export async function updateTeamTwitter(teamId, twitterData) {
  return adminReq(`/api/admin/teams/teams/${teamId}/twitter`, {
    method: 'PUT',
    body: JSON.stringify(twitterData)
  });
}

export async function addTeamReporter(teamId, reporterData) {
  return adminReq(`/api/admin/teams/teams/${teamId}/reporters`, {
    method: 'POST',
    body: JSON.stringify(reporterData)
  });
}

export async function removeTeamReporter(teamId, reporterId) {
  return adminReq(`/api/admin/teams/teams/${teamId}/reporters/${reporterId}`, {
    method: 'DELETE'
  });
}

// RSS Management
export async function getRssFeeds() {
  return adminReq('/api/admin/rss/feeds');
}

export async function createRssFeed(feedData) {
  return adminReq('/api/admin/rss/feeds', {
    method: 'POST',
    body: JSON.stringify(feedData)
  });
}

export async function updateRssFeed(feedId, feedData) {
  return adminReq(`/api/admin/rss/feeds/${feedId}`, {
    method: 'PUT',
    body: JSON.stringify(feedData)
  });
}

export async function deleteRssFeed(feedId) {
  return adminReq(`/api/admin/rss/feeds/${feedId}`, {
    method: 'DELETE'
  });
}

export async function testRssFeed(feedUrl) {
  return adminReq('/api/admin/rss/test', {
    method: 'POST',
    body: JSON.stringify({ url: feedUrl })
  });
}

// Team Feed Subscriptions
export async function getTeamFeedSubscriptions(params = {}) {
  const queryString = new URLSearchParams(params).toString();
  const endpoint = queryString ? `/api/admin/team-feeds/subscriptions?${queryString}` : '/api/admin/team-feeds/subscriptions';
  return adminReq(endpoint);
}

export async function addTeamFeedSubscription(teamId, feedId) {
  return adminReq(`/api/admin/team-feeds/subscriptions/${teamId}/feeds`, {
    method: 'POST',
    body: JSON.stringify({ feedId })
  });
}

export async function removeTeamFeedSubscription(teamId, feedId) {
  return adminReq(`/api/admin/team-feeds/subscriptions/${teamId}/feeds/${feedId}`, {
    method: 'DELETE'
  });
}

export async function getAvailableFeeds() {
  return adminReq('/api/admin/team-feeds/available-feeds');
}

// Sync Operations
export async function syncTeamWindow(teamSlug, syncData) {
  return adminReq(`/api/sync/team/${teamSlug}/window`, {
    method: 'POST',
    body: JSON.stringify(syncData)
  });
}

export async function syncLiveNow() {
  return adminReq('/api/sync/live-now', {
    method: 'POST'
  });
}

export async function syncByDate(year, month, day) {
  return adminReq(`/api/sync/date/${year}/${month}/${day}`, {
    method: 'POST'
  });
}

export async function recomputeTeamSnapshot(teamSlug) {
  return adminReq(`/api/teams/${teamSlug}/recompute`, {
    method: 'POST'
  });
}

export async function recomputeAllTeams() {
  return adminReq('/api/teams/recompute-all', {
    method: 'POST'
  });
}

// League Management
export async function getLeagues(params = {}) {
  const queryString = new URLSearchParams(params).toString();
  const endpoint = queryString ? `/api/admin/leagues?${queryString}` : '/api/admin/leagues';
  return adminReq(endpoint);
}

export async function getLeague(leagueId) {
  return adminReq(`/api/admin/leagues/${leagueId}`);
}

export async function updateLeague(leagueId, updateData) {
  return adminReq(`/api/admin/leagues/${leagueId}`, {
    method: 'PATCH',
    body: JSON.stringify(updateData)
  });
}

export async function bulkUpdateLeagues(leagueIds, updateData) {
  return adminReq('/api/admin/leagues/bulk-update', {
    method: 'POST',
    body: JSON.stringify({ league_ids: leagueIds, ...updateData })
  });
}

export async function getLeagueStats() {
  return adminReq('/api/admin/leagues/stats');
}

// Country Management
export async function getCountries(params = {}) {
  const queryString = new URLSearchParams(params).toString();
  const endpoint = queryString ? `/api/admin/countries?${queryString}` : '/api/admin/countries';
  return adminReq(endpoint);
}

export async function updateCountry(countryId, updateData) {
  return adminReq(`/api/admin/countries/${countryId}`, {
    method: 'PATCH',
    body: JSON.stringify(updateData)
  });
}