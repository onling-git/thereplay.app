const NewsCollectionSnapshot = require('../models/NewsCollectionSnapshot');

async function recordNewsSnapshot(path, articles, limit) {
  if (limit !== 20) return;
  const visible = articles.filter(article => {
    try {
      if (typeof article.url !== 'string' || !article.url.trim()) return false;
      const url = new URL(article.url, 'https://thereplay.app');
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
    } catch {
      console.warn('[sitemap] Excluding invalid news URL:', article.id);
      return false;
    }
  });
  const dates = visible.map(article => {
    const value = article.kind === 'match-report' ? article.published_at : article.source_published_at;
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) && date <= new Date() ? date : null;
  });
  // An undated item means the collection's freshness cannot be established.
  const newest = dates.length && dates.every(Boolean)
    ? new Date(Math.max(...dates.map(date => date.getTime()))) : null;
  await NewsCollectionSnapshot.updateOne(
    { path }, { $set: { newest_published_at: newest } }, { upsert: true }
  );
}

module.exports = { recordNewsSnapshot };
