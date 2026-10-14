const SITE_URL = "https://thereplay.app";
const teamId = (slug) => `${SITE_URL}/${encodeURIComponent(slug)}/`;

const buildNextMatchEvent = (team, match) => {
  if (!match?.match_id || !match.opponent_name || match.opponent_name === "Unknown Opponent") return null;
  if (typeof match.home_game !== "boolean" || !match.date) return null;

  const startDate = new Date(match.date);
  if (Number.isNaN(startDate.getTime())) {
    console.warn("Invalid team hub structured data kickoff:", match.date);
    return null;
  }

  const ownTeam = { "@id": teamId(team.slug) };
  const opponent = {
    "@type": "SportsTeam",
    ...(match.opponent_slug ? { "@id": teamId(match.opponent_slug) } : {}),
    name: match.opponent_name,
  };
  const homeSlug = match.home_game ? team.slug : match.opponent_slug || team.slug;
  const rawStatus = match._fullMatch?.match_status || match._fullMatch?.status || match.status;
  const status = String(rawStatus?.developer_name || rawStatus?.short_name || rawStatus?.state || rawStatus || "").toLowerCase();
  const eventStatus = {
    ns: "EventScheduled",
    upcoming: "EventScheduled",
    scheduled: "EventScheduled",
    not_started: "EventScheduled",
    "not started": "EventScheduled",
    canc: "EventCancelled",
    cancelled: "EventCancelled",
    canceled: "EventCancelled",
    postponed: "EventPostponed",
    postp: "EventPostponed",
  }[status];

  return {
    "@type": "SportsEvent",
    "@id": `${SITE_URL}/${encodeURIComponent(homeSlug)}/match/${encodeURIComponent(match.match_id)}#event`,
    name: match.home_game
      ? `${team.name} vs ${match.opponent_name}`
      : `${match.opponent_name} vs ${team.name}`,
    startDate: startDate.toISOString(),
    ...(eventStatus ? { eventStatus: `https://schema.org/${eventStatus}` } : {}),
    homeTeam: match.home_game ? ownTeam : opponent,
    awayTeam: match.home_game ? opponent : ownTeam,
    sport: team.sport?.trim() || "Football",
    ...(match.venue?.name ? {
      location: {
        "@type": "Place",
        ...(match.venue.slug ? { "@id": `${SITE_URL}/venues/${encodeURIComponent(match.venue.slug)}#place` } : {}),
        name: match.venue.name,
      },
    } : {}),
  };
};

const SportsTeamStructuredData = ({ team, nextMatch }) => {
  if (!team?.name || !team?.slug) return null;

  const sameAs = (team.sameAs || []).map((url) => url.trim()).filter(Boolean);
  const homeVenue = team.venue?.name ? {
    "@type": "Place",
    ...(team.venue.slug ? { "@id": `${SITE_URL}/venues/${encodeURIComponent(team.venue.slug)}#place` } : {}),
    name: team.venue.name,
  } : null;
  const sportsTeam = {
    "@type": "SportsTeam",
    "@id": teamId(team.slug),
    name: team.name,
    sport: team.sport?.trim() || "Football",
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(homeVenue ? { location: homeVenue } : {}),
  };
  const pageUrl = `${SITE_URL}/${encodeURIComponent(team.slug)}`;
  const event = buildNextMatchEvent(team, nextMatch);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      sportsTeam,
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        isPartOf: {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          name: "The Replay",
          url: SITE_URL,
        },
        about: { "@id": sportsTeam["@id"] },
        provider: {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: "The Replay",
          url: SITE_URL,
        },
        ...(event ? { mentions: { "@id": event["@id"] } } : {}),
      },
      ...(event ? [event] : []),
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Prevent stored text from terminating the script when serialized as HTML.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
      }}
    />
  );
};

export default SportsTeamStructuredData;
