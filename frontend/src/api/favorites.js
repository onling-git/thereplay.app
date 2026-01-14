// src/api/favorites.js
const API_BASE = process.env.REACT_APP_API_BASE || 'https://virtuous-exploration-production.up.railway.app';

async function favoritesReq(path, opts = {}) {
  const token = localStorage.getItem('authToken');
  
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...opts.headers
    },
    credentials: 'include',
    ...opts
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let body;
    try { 
      body = JSON.parse(text); 
    } catch { 
      body = { message: text || res.statusText }; 
    }
    const err = new Error('API error');
    err.status = res.status;
    err.body = body;
    throw err;
  }
  
  return await res.json().catch(() => null);
}

// Get user's favorite matches
export async function getFavoriteMatches(params = {}) {
  const searchParams = new URLSearchParams();
  
  if (params.upcoming) searchParams.append('upcoming', 'true');
  if (params.past) searchParams.append('past', 'true');
  if (params.limit) searchParams.append('limit', params.limit);
  if (params.page) searchParams.append('page', params.page);
  
  const queryString = searchParams.toString();
  return favoritesReq(`/api/favorites${queryString ? `?${queryString}` : ''}`);
}

// Get favorite matches count/stats
export async function getFavoriteMatchesCount() {
  return favoritesReq('/api/favorites/count');
}

// Check if a match is favorited
export async function checkFavoriteStatus(matchId) {
  return favoritesReq(`/api/favorites/check/${matchId}`);
}

// Add a match to favorites
export async function addFavoriteMatch(matchId) {
  return favoritesReq('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ match_id: matchId })
  });
}

// Remove a match from favorites
export async function removeFavoriteMatch(matchId) {
  return favoritesReq(`/api/favorites/${matchId}`, {
    method: 'DELETE'
  });
}

// Toggle favorite status
export async function toggleFavoriteMatch(matchId) {
  try {
    const statusResponse = await checkFavoriteStatus(matchId);
    const isFavorited = statusResponse?.data?.is_favorited || false;
    
    if (isFavorited) {
      await removeFavoriteMatch(matchId);
      return { success: true, action: 'removed' };
    } else {
      await addFavoriteMatch(matchId);
      return { success: true, action: 'added' };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.body?.message || error.message || 'Failed to toggle favorite' 
    };
  }
}