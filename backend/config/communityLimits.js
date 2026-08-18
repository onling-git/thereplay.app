function parseEnvInt(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

const COMMUNITY_LIMITS = {
  DISCUSSION_TITLE_MAX_CHARS: parseEnvInt('TEAM_HUB_DISCUSSION_TITLE_MAX_CHARS', 150),
  DISCUSSION_BODY_MAX_CHARS: parseEnvInt('TEAM_HUB_DISCUSSION_BODY_MAX_CHARS', 2000),
  COMMENT_BODY_MAX_CHARS: parseEnvInt('TEAM_HUB_COMMENT_BODY_MAX_CHARS', 1000),
};

module.exports = COMMUNITY_LIMITS;
