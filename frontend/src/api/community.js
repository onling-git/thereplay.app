const API_BASE = process.env.REACT_APP_API_BASE || 'https://virtuous-exploration-production.up.railway.app';

async function communityReq(path, opts = {}) {
  const token = localStorage.getItem('authToken');

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
    ...opts,
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

  return res.json().catch(() => null);
}

export async function listTeamDiscussions(teamSlug, params = {}) {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  if (params.sort) search.set('sort', String(params.sort));
  const q = search.toString();
  return communityReq(`/api/teams/${encodeURIComponent(teamSlug)}/hub/discussions${q ? `?${q}` : ''}`);
}

export async function createDiscussion(teamSlug, payload) {
  return communityReq(`/api/teams/${encodeURIComponent(teamSlug)}/hub/discussions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getDiscussion(teamSlug, discussionId, params = {}) {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  const q = search.toString();
  return communityReq(`/api/teams/${encodeURIComponent(teamSlug)}/hub/discussions/${encodeURIComponent(discussionId)}${q ? `?${q}` : ''}`);
}

export async function createComment(teamSlug, discussionId, payload) {
  return communityReq(`/api/teams/${encodeURIComponent(teamSlug)}/hub/discussions/${encodeURIComponent(discussionId)}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createReply(teamSlug, discussionId, payload) {
  return communityReq(`/api/teams/${encodeURIComponent(teamSlug)}/hub/discussions/${encodeURIComponent(discussionId)}/replies`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateDiscussion(teamSlug, discussionId, payload) {
  return communityReq(`/api/teams/${encodeURIComponent(teamSlug)}/hub/discussions/${encodeURIComponent(discussionId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteDiscussion(teamSlug, discussionId) {
  return communityReq(`/api/teams/${encodeURIComponent(teamSlug)}/hub/discussions/${encodeURIComponent(discussionId)}`, {
    method: 'DELETE',
  });
}

export async function updateComment(teamSlug, commentId, payload) {
  return communityReq(`/api/teams/${encodeURIComponent(teamSlug)}/hub/comments/${encodeURIComponent(commentId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteComment(teamSlug, commentId) {
  return communityReq(`/api/teams/${encodeURIComponent(teamSlug)}/hub/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
  });
}

export async function reportContent(teamSlug, payload) {
  return communityReq(`/api/teams/${encodeURIComponent(teamSlug)}/hub/reports`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
