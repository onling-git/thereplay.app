import { isDismissalEvent } from "./liveCommentary";

const normalizeName = (name) => String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
const normalizeType = (type) => String(type || "").toLowerCase().replace(/[\s_/-]/g, "");

export function getPlayerLineupEventDetails(player, events = [], teamSide) {
  const details = [];
  const seenIds = new Set();

  const matchesPlayer = (event, related = false) => {
    const id = related ? event.related_player_id : event.player_id;
    if (player.player_id != null && id != null) {
      return String(player.player_id) === String(id);
    }
    const name = related
      ? event.related_player_name || event.related_player
      : event.player_name || event.player;
    const playerName = normalizeName(player.player_name);
    return Boolean(playerName && playerName === normalizeName(name));
  };

  for (const event of events) {
    const type = normalizeType(event.type);
    if (event.rescinded === true ||
        (type !== "owngoal" && teamSide && event.team && event.team !== teamSide)) continue;
    if (event.id != null) {
      if (seenIds.has(String(event.id))) continue;
      seenIds.add(String(event.id));
    }

    const add = (kind, relatedPlayer = null) => details.push({
      kind,
      minute: event.minute,
      extraMinute: event.extra_minute,
      relatedPlayer,
    });

    if (type === "goal" || type === "penalty") {
      if (matchesPlayer(event)) add("goal");
      if (matchesPlayer(event, true)) add("assist");
    }
    if (matchesPlayer(event)) {
      if (type === "owngoal") add("own-goal");
      if (type === "yellowcard") add("yellow-card");
      if (isDismissalEvent(event.type)) add("red-card");
      if (type === "substitution" || type === "sub") {
        add("sub-on", event.related_player_name || event.related_player);
      }
    }
    if ((type === "substitution" || type === "sub") && matchesPlayer(event, true)) {
      add("sub-off", event.player_name || event.player);
    }
  }

  return details.sort((a, b) =>
    Number(a.minute ?? Infinity) - Number(b.minute ?? Infinity) ||
    Number(a.extraMinute || 0) - Number(b.extraMinute || 0));
}

export function getPlayerLineupEvents(player, events = [], teamSide) {
  const details = getPlayerLineupEventDetails(player, events, teamSide);
  const count = (kind) => details.filter((event) => event.kind === kind).length;
  const yellowCards = count("yellow-card");
  return {
    goals: count("goal"),
    ownGoals: count("own-goal"),
    assists: count("assist"),
    card: count("red-card") || yellowCards >= 2 ? "red" : yellowCards > 0 ? "yellow" : null,
  };
}
