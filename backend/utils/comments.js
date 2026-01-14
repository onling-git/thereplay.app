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
  // Sort by minute first (descending), then by order within same minute (descending)
  out.sort((a,b) => {
    // Primary sort: by minute (descending - latest minute first)
    const minuteA = a?.minute != null && !isNaN(a.minute) ? Number(a.minute) : -1;
    const minuteB = b?.minute != null && !isNaN(b.minute) ? Number(b.minute) : -1;
    
    // If minutes are different, sort by minute (descending)
    if (minuteB !== minuteA) {
      return minuteB - minuteA;
    }
    
    // Secondary sort: within the same minute, sort by order (descending)
    const orderA = a?.order != null && !isNaN(a.order) ? Number(a.order) : 0;
    const orderB = b?.order != null && !isNaN(b.order) ? Number(b.order) : 0;
    
    return orderB - orderA;
  });
  return out;
}

module.exports = { mergeComments };
