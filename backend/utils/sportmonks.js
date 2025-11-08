const axios = require('axios');

const baseURL = process.env.SPORTMONKS_BASE || 'https://api.sportmonks.com/v3/football';
const apiKey = process.env.SPORTMONKS_API_KEY;

if (!apiKey) {
  console.warn('[sportmonks] Warning: SPORTMONKS_API_KEY missing. Requests will fail.');
}

const sportmonks = axios.create({
  baseURL,
  timeout: 30000,
  params: { api_token: apiKey }
});

// jittered sleep
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Parse Retry-After header value (seconds or HTTP date)
function parseRetryAfter(val) {
  if (!val) return null;
  const n = Number(val);
  if (!Number.isNaN(n)) return n * 1000;
  const date = Date.parse(val);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

async function get(path, params = {}, opts = {}) {
  const url = `${baseURL.replace(/\/+$/,'')}/${path.replace(/^\/+/, '')}`;
  const fullParams = { api_token: apiKey, ...params };

  // log the outgoing request (mask token)
  const logParams = { ...fullParams, api_token: '***' };
  console.log('[sportmonks] GET', url, logParams);

  const maxRetries = Number(process.env.SPORTMONKS_MAX_RETRIES) || 8;
  const baseBackoff = Number(process.env.SPORTMONKS_BASE_BACKOFF_MS) || 500; // ms

  let attempt = 0;
  while (true) {
    try {
      return await sportmonks.get(path, { params: fullParams, ...opts });
    } catch (e) {
      attempt++;
      const status = e?.response?.status;
      const body = e?.response?.data;

      // handle 429 (rate limit) specially: respect Retry-After header when present
      if (status === 429 && attempt <= maxRetries) {
        const ra = parseRetryAfter(e?.response?.headers?.['retry-after']);
        let backoff = ra ?? Math.floor(baseBackoff * Math.pow(2, attempt - 1));
        // add random jitter up to 20%
        const jitter = Math.floor(backoff * 0.2 * Math.random());
        backoff = backoff + jitter;
        console.warn(`[sportmonks] 429 -> retry ${attempt}/${maxRetries} after ${backoff}ms for ${path}`);
        await sleep(backoff);
        continue;
      }

      // For server errors, retry a few times as well
      if ((status >= 500 && status < 600) && attempt <= maxRetries) {
        const backoff = Math.floor(baseBackoff * Math.pow(2, attempt - 1));
        const jitter = Math.floor(backoff * 0.1 * Math.random());
        const wait = backoff + jitter;
        console.warn(`[sportmonks] ${status} -> retry ${attempt}/${maxRetries} after ${wait}ms for ${path}`);
        await sleep(wait);
        continue;
      }

      // Give a helpful error message on failure and include returned body when available
      console.error('[sportmonks] ERROR', body || e.message);
      throw e;
    }
  }
}

module.exports = { get };
