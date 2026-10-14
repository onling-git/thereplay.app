const SITE_URL = 'https://thereplay.app';

const toIsoDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    console.warn('Invalid match report structured data timestamp:', value);
    return undefined;
  }
  return date.toISOString();
};

const MatchReportStructuredData = ({ data, teamSlug, matchId }) => {
  const report = data?.report;
  if (!report || !teamSlug || !matchId) return null;

  const slug = teamSlug.toLowerCase();
  if (String(data.match_id) !== String(matchId)) return null;
  if (typeof report === 'object' && (
    (report.team_slug && report.team_slug !== slug) ||
    (report.match_id && String(report.match_id) !== String(matchId))
  )) return null;

  const reportUrl = `${SITE_URL}/${encodeURIComponent(slug)}/match/${encodeURIComponent(matchId)}/report`;
  const eventSlug = data.home_team_slug || slug;
  const organization = {
    '@id': `${SITE_URL}/#organization`,
    '@type': 'Organization',
    name: 'The Replay',
    url: SITE_URL,
  };
  const legacy = typeof report === 'string';
  const headline = legacy
    ? `${data.home_team} vs ${data.away_team} Match Report`
    : report.generated?.headline || report.headline;
  if (!headline) return null;

  const paragraphs = legacy ? report.split('\n') : (
    report.generated?.summary_paragraphs || report.summary_paragraphs || []
  );
  const description = paragraphs.find((paragraph) => paragraph.trim())?.trim();
  const images = (report.images || []).filter((image) => image.trim()).map((image) => {
    const url = new URL(image, SITE_URL);
    if (!['https:', 'http:'].includes(url.protocol)) {
      throw new Error('Match report images must use HTTP or HTTPS URLs');
    }
    return url.href;
  });
  const published = toIsoDate(report.createdAt);
  const modified = toIsoDate(report.updatedAt) || published;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    '@id': `${reportUrl}#article`,
    url: reportUrl,
    headline,
    ...(description ? { description } : {}),
    ...(images.length ? { image: images } : {}),
    ...(published ? { datePublished: published } : {}),
    ...(modified ? { dateModified: modified } : {}),
    author: organization,
    publisher: { '@id': organization['@id'] },
    isPartOf: {
      '@id': `${SITE_URL}/#website`,
      '@type': 'WebSite',
      name: 'The Replay',
      url: SITE_URL,
      publisher: { '@id': organization['@id'] },
    },
    mainEntityOfPage: reportUrl,
    about: [
      { '@id': `${SITE_URL}/${encodeURIComponent(eventSlug)}/match/${encodeURIComponent(matchId)}#event` },
      { '@id': `${SITE_URL}/${encodeURIComponent(slug)}/` },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
      }}
    />
  );
};

export default MatchReportStructuredData;
