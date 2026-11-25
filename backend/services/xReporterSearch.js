const axios = require('axios');

const SEARCH_URL = 'https://api.x.com/2/tweets/search/recent';

function reporterQuery(handles) {
  if (!Array.isArray(handles) || !handles.length) throw new Error('Reporter handles are required');
  const cleaned = [...new Set(handles.map(handle => String(handle).replace(/^@/, '').toLowerCase()))];
  if (cleaned.some(handle => !/^[a-z0-9_]{1,15}$/.test(handle))) throw new Error('Invalid reporter handle');
  const query = `(${cleaned.map(handle => `from:${handle}`).join(' OR ')})`;
  if (query.length > 512) throw new Error('Reporter search exceeds the X API query limit');
  return query;
}

function normalizePost(post, users) {
  const author = users.get(post.author_id);
  if (!author?.id || !author.username || !post.id || !post.text || !post.created_at) {
    throw new Error('X API returned a reporter post without required fields');
  }
  return {
    id: post.id, text: post.text, createdAt: post.created_at,
    url: `https://x.com/${author.username}/status/${post.id}`,
    author: {
      id: author.id, userName: author.username, name: author.name,
      profilePicture: author.profile_image_url, isBlueVerified: author.verified
    },
    likeCount: post.public_metrics?.like_count || 0,
    retweetCount: post.public_metrics?.retweet_count || 0,
    replyCount: post.public_metrics?.reply_count || 0,
    quoteCount: post.public_metrics?.quote_count || 0,
    lang: post.lang
  };
}

async function searchReporterPosts(handles, { since, until, bearerToken, maxPages = 3 }) {
  const start = new Date(since);
  const end = new Date(until);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
    throw new Error('A valid reporter search window is required');
  }
  if (!bearerToken) throw new Error('X reporter bearer token is not configured');
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10) {
    throw new Error('X reporter search page limit must be between 1 and 10');
  }
  const params = {
    query: reporterQuery(handles), start_time: start.toISOString(), end_time: end.toISOString(),
    max_results: 100, expansions: 'author_id',
    'tweet.fields': 'author_id,created_at,public_metrics,lang',
    'user.fields': 'name,username,profile_image_url,verified'
  };
  const tweets = [];
  let nextToken;
  for (let page = 0; page < maxPages; page++) {
    const response = await axios.get(SEARCH_URL, {
      headers: { Authorization: `Bearer ${bearerToken}` },
      params: { ...params, ...(nextToken ? { next_token: nextToken } : {}) },
      timeout: 5000
    });
    const body = response.data;
    if (!body || !body.meta || !Number.isInteger(body.meta.result_count)
      || body.meta.result_count < 0 || !Array.isArray(body.data || [])
      || body.meta.result_count !== (body.data || []).length || body.errors?.length) {
      throw new Error('X reporter search returned an incomplete response');
    }
    const users = new Map((body.includes?.users || []).map(user => [user.id, user]));
    for (const post of body.data || []) tweets.push(normalizePost(post, users));
    console.info(`[reporter-tweets] X search page ${page + 1}: ${(body.data || []).length} posts, ${users.size} users`);
    nextToken = body.meta?.next_token;
    if (!nextToken) return { tweets, searchQuery: params.query, apiSource: 'x-api' };
  }
  throw new Error(`X reporter search exceeded its ${maxPages}-page limit`);
}

module.exports = { reporterQuery, searchReporterPosts };
