const { get } = require('./sportmonks');

// Generic paginator for Sportmonks v3 endpoints that return pagination metadata.
// Usage: paginate('/teams', { include: '...' }, (item) => { ... })
async function paginate(path, params = {}, onItem, { pageStart = 1, maxPages = Infinity, delayMs = 150 } = {}) {
  let page = pageStart;
  let pages = 1;

  while (page <= pages && page - pageStart + 1 <= maxPages) {
    const { data } = await get(path, { ...params, page });
    const items = Array.isArray(data?.data) ? data.data : [];
    const meta = data?.meta || data?.pagination || data?.meta?.pagination;

    // Process the page
    for (const it of items) {
      await onItem(it);
    }

    // Work out pagination
    if (data?.meta?.pagination) {
      pages = Number(data.meta.pagination.total_pages || data.meta.pagination.total || page);
    } else if (meta?.total_pages) {
      pages = Number(meta.total_pages);
    } else {
      // No pagination meta? Assume single page.
      pages = page;
    }

    page += 1;
    if (page <= pages && delayMs) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

module.exports = { paginate };
