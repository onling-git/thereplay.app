// backend/utils/comments.js
// Shared helpers for comment merging/deduping
function mergeComments(existingArr, incomingArr) {
  // Map keyed primarily by `order` when present, then by explicit provider id, then text+minute fallback.
  const map = new Map();
  const keyFor = (c) => {
    if (!c) return null;
    if (c.order != null) return `order:${String(c.order)}`;
    if (c.comment_id != null || c.id != null) return `id:${c.comment_id || c.id}`;
    return `text:${String(c.comment || c.comment_text || '').slice(0,200)}|m:${c.minute || 0}`;
  };

  if (Array.isArray(existingArr)) {
    for (const c of existingArr) {
      const k = keyFor(c) || `gen:existing:${map.size}`;
      if (!map.has(k)) map.set(k, c);
    }
  }

  if (Array.isArray(incomingArr)) {
    for (const c of incomingArr) {
      const k = keyFor(c) || `gen:incoming:${map.size}`;
      // incoming wins on collisions
      map.set(k, c);
    }
  }

  const out = Array.from(map.values());
  out.sort((a,b) => (Number(a.order ?? a.minute ?? 0) - Number(b.order ?? b.minute ?? 0)));
  return out;
}

module.exports = { mergeComments };
