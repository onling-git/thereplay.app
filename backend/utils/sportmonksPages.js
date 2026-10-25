const sportmonks = require('./sportmonks');

async function fetchSportmonksPages(path, params = {}, provider = sportmonks.get) {
  const items = [];
  const ids = new Set();
  for (let page = 1; page <= 100; page++) {
    const response = await provider(path, { ...params, per_page: 50, page });
    const body = response.data;
    if (!Array.isArray(body?.data)) throw new Error(`Invalid provider response for ${path}`);
    const pagination = body.pagination || body.meta?.pagination;
    if (pagination?.current_page != null && Number(pagination.current_page) !== page) {
      throw new Error(`Unexpected provider page for ${path}`);
    }
    for (const item of body.data) {
      if (item.id == null || ids.has(String(item.id))) throw new Error(`Missing or repeated provider ID for ${path}`);
      ids.add(String(item.id));
      items.push(item);
    }
    const more = pagination?.has_more === true || Number(pagination?.total_pages) > page;
    if (!more) return items;
    if (!body.data.length) throw new Error(`Empty intermediate provider page for ${path}`);
  }
  throw new Error(`Provider pagination limit exceeded for ${path}`);
}

module.exports = { fetchSportmonksPages };
