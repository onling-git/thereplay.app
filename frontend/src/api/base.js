function resolveDefaultApiBase() {
  if (typeof window === 'undefined') {
    return 'https://virtuous-exploration-staging.up.railway.app';
  }

  const host = window.location.hostname;
  const isProductionHost = host === 'thereplay.app' || host === 'www.thereplay.app';

  if (isProductionHost) {
    return 'https://virtuous-exploration-production.up.railway.app';
  }

  return 'https://virtuous-exploration-staging.up.railway.app';
}

const envApiBase = process.env.REACT_APP_API_BASE;
const host = typeof window !== 'undefined' ? window.location.hostname : '';
const isPagesDevHost = host.endsWith('.pages.dev');

let API_BASE = envApiBase || resolveDefaultApiBase();

if (!envApiBase) {
  console.warn('[API] REACT_APP_API_BASE missing. Using hostname-based fallback:', API_BASE);
}

if (isPagesDevHost && /virtuous-exploration-production\.up\.railway\.app/i.test(API_BASE)) {
  API_BASE = 'https://virtuous-exploration-staging.up.railway.app';
  console.warn('[API] pages.dev host detected with production API base. Forcing staging API base:', API_BASE);
}

export { API_BASE };
