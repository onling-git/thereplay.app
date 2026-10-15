const normalizeType = (type) => String(type || "").toLowerCase().replace(/[\s_/-]/g, "");

export const isDismissalEvent = (type) =>
  ["redcard", "yellowredcard", "secondyellow", "secondyellowcard"].includes(normalizeType(type));

export const isScoringEvent = (type) =>
  ["goal", "owngoal", "penalty"].includes(normalizeType(type));

const commentText = (comment) => String(comment.comment || comment.comment_text || "").trim();

const matchesComment = (comment, event) => {
  if (comment.minute == null || event.minute == null ||
      Number(comment.minute) !== Number(event.minute) ||
      Number(comment.extra_minute || 0) !== Number(event.extra_minute || 0)) return false;

  const text = commentText(comment).toLowerCase();
  const player = String(event.player_name || event.player || "").trim().toLowerCase();
  if (!player || !text.includes(player)) return false;

  if (isDismissalEvent(event.type)) {
    return /\b(second yellow|yellow\/red|red card|sent off|dismissed|ejected)\b/.test(text);
  }
  if (isScoringEvent(event.type)) {
    return comment.is_goal === true ||
      /\b(scores|scored|scoring)\b/.test(text) ||
      /^goal[!.\s]/.test(text);
  }
  return false;
};

export const prepareLiveComments = (comments, events = []) => {
  const grouped = new Map();
  const result = [];

  for (const comment of comments) {
    const event = events.find((candidate) =>
      candidate.rescinded !== true &&
      (isScoringEvent(candidate.type) || isDismissalEvent(candidate.type)) &&
      matchesComment(comment, candidate));

    if (!event) {
      result.push(comment);
      continue;
    }

    const existing = grouped.get(event);
    if (existing) {
      const text = commentText(comment);
      if (!existing.texts.includes(text)) existing.texts.push(text);
      existing.comment.comment = existing.texts.join(" ");
      continue;
    }

    const prepared = {
      ...comment,
      comment: commentText(comment),
      is_goal: isScoringEvent(event.type),
      is_important: true,
      matchingEvent: event,
    };
    grouped.set(event, { comment: prepared, texts: [prepared.comment] });
    result.push(prepared);
  }

  return result;
};
