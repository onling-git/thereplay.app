import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import './TeamSeasonStatistics.css';

const SUMMARY_STATS = [
  { key: 'goalsScored', label: 'Goals Scored', match: ['goals'] },
  { key: 'goalsConceded', label: 'Goals Conceded', match: ['goals conceded'] },
  { key: 'averagePossession', label: 'Average Possession', match: ['average possession', 'possession'] },
  { key: 'cleanSheets', label: 'Clean Sheets', match: ['cleansheets', 'clean sheets', 'clean sheet'] },
];

const HIDDEN_STATISTICS = new Set([
  'number of goals',
  'both teams to score',
  'scoring minutes',
  'conceded scoring minutes',
  'players footing',
  'appearing players',
  'most substituted players',
  'most injured players',
  'most scored half',
  'most frequent scoring minute',
  'national team players',
  'goal results',
]);

function getDetails(seasonStatistic) {
  return Array.isArray(seasonStatistic?.details) ? seasonStatistic.details : [];
}

function isVisibleStatistic(detail) {
  return !HIDDEN_STATISTICS.has(String(detail?.name || '').trim().toLowerCase());
}

function getValue(detail) {
  const value = detail?.value ?? detail?.data?.value;
  if (value == null) return null;
  if (typeof value !== 'object') return value;

  const valueKeys = [
    'total',
    'average',
    'value',
    'goals',
    'conceded',
    'number',
    'clean_sheets',
    'cleanSheets',
    'count',
  ];

  for (const key of valueKeys) {
    if (value[key] != null) return value[key];
  }

  const groupedValue = value.all ?? value.team ?? value.home ?? value.away;
  if (groupedValue && typeof groupedValue === 'object') {
    return groupedValue.count ?? groupedValue.average ?? groupedValue.percentage ?? null;
  }

  return null;
}

function formatValue(detail) {
  const value = getValue(detail);
  if (value != null && value !== '') return formatScalar(value, detail?.name);

  return formatValueParts(detail).join(' · ');
}

function formatValueParts(detail) {
  const rawValue = detail?.value ?? detail?.data?.value;
  const name = String(detail?.name || '').toLowerCase();
  const metricValue = rawValue?.all ?? rawValue;

  if (metricValue && typeof metricValue === 'object') {
    if (metricValue.count != null && metricValue.average != null) {
      if (name.includes('possession') || name.includes('%')) {
        return [`${formatScalar(metricValue.average, detail?.name)} average`];
      }
      return [
        `${formatScalar(metricValue.count, detail?.name)} total`,
        `${formatScalar(metricValue.average, detail?.name)} avg/game`,
      ];
    }
    if (metricValue.total != null && metricValue.average != null) {
      return [
        `${formatScalar(metricValue.total, detail?.name)} total`,
        `${formatScalar(metricValue.average, detail?.name)} avg/game`,
      ];
    }
  }

  const value = getValue(detail);
  if (value != null && value !== '') return [formatScalar(value, detail?.name)];

  if (!rawValue || typeof rawValue !== 'object') return ['—'];

  const parts = [];
  flattenValue(rawValue, [], parts);
  return parts.length > 0 ? parts : ['—'];
}

function formatScalar(value, context = '') {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  const formatted = Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  const name = String(context).toLowerCase();
  return name.includes('possession') || name.includes('%') ? `${formatted}%` : formatted;
}

function flattenValue(value, path, parts) {
  if (value == null) return;
  if (typeof value !== 'object') {
    const label = path.join(' ');
    if (label.toLowerCase() === 'id' || label.toLowerCase().endsWith(' player id')) return;
    parts.push(`${label}: ${formatScalar(value, label)}`);
    return;
  }

  Object.entries(value).forEach(([key, childValue]) => {
    const label = key.replace(/_/g, ' ').replace(/(\d) (\d)/g, '$1.$2');
    flattenValue(childValue, [...path, label], parts);
  });
}

function findSummaryDetail(details, matchers) {
  return details.find((detail) => {
    const name = String(detail?.name || '').toLowerCase();
    return matchers.some((matcher) => name === matcher || name.includes(matcher));
  });
}

function applyStandingTotals(details, teamStanding) {
  if (!teamStanding) return details;

  return details.map((detail) => {
    const name = String(detail?.name || '').toLowerCase();
    if (name === 'goals' && teamStanding.goals_for != null) {
      return { ...detail, value: { total: teamStanding.goals_for } };
    }
    if (name === 'goals conceded' && teamStanding.goals_against != null) {
      return { ...detail, value: { total: teamStanding.goals_against } };
    }
    if (name === 'games played' && teamStanding.played != null) {
      return { ...detail, value: { total: teamStanding.played } };
    }
    if (name === 'team wins' && teamStanding.won != null) {
      return { ...detail, value: { total: teamStanding.won } };
    }
    if (name === 'team draws' && teamStanding.drawn != null) {
      return { ...detail, value: { total: teamStanding.drawn } };
    }
    if (name === 'team lost' && teamStanding.lost != null) {
      return { ...detail, value: { total: teamStanding.lost } };
    }
    return detail;
  });
}

function seasonLabel(seasonStatistic) {
  return seasonStatistic?.season?.name || seasonStatistic?.season_id || 'Current season';
}

function AllStatisticsModal({ isOpen, onClose, seasonStatistic, sourceGamesPlayed, standingsGamesPlayed }) {
  if (!isOpen) return null;

  const details = getDetails(seasonStatistic).filter(isVisibleStatistic);
  return (
    <div className="team-stats-modal-overlay" onClick={onClose}>
      <div className="team-stats-modal card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="team-stats-modal-title">
        <header className="team-stats-modal-header">
          <div>
            <h2 id="team-stats-modal-title" className="accent-heading">All Team Statistics</h2>
            <p>{seasonLabel(seasonStatistic)}</p>
            {sourceGamesPlayed && standingsGamesPlayed && sourceGamesPlayed < standingsGamesPlayed && (
              <p className="team-stats-coverage-note">
                Detailed metrics are based on {sourceGamesPlayed} matches; standings totals cover {standingsGamesPlayed}.
              </p>
            )}
          </div>
          <button className="team-stats-close" type="button" onClick={onClose} aria-label="Close statistics">
            <X size={22} />
          </button>
        </header>
        <div className="team-stats-modal-body">
          {details.length === 0 ? (
            <p className="team-stats-empty">No statistics are available for this season.</p>
          ) : (
            <div className="team-stats-list">
              {details.map((detail) => (
                <div className="team-stat-row" key={detail.id || `${detail.type_id}-${detail.name}`}>
                  <span>{detail.name || `Statistic ${detail.type_id}`}</span>
                  <strong className="team-stat-value">
                    {formatValueParts(detail).map((part, index) => (
                      <span key={`${detail.id || detail.type_id}-${index}`}>{part}</span>
                    ))}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamSeasonStatistics({ seasonStatistics, loading, error, teamStanding }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(null);

  useEffect(() => {
    if (!selectedSeason && seasonStatistics?.length) setSelectedSeason(seasonStatistics[0]);
  }, [seasonStatistics, selectedSeason]);

  const seasonStatistic = selectedSeason || seasonStatistics?.[0];
  const rawDetails = getDetails(seasonStatistic);
  const sourceGamesPlayed = getValue(rawDetails.find((detail) => String(detail?.name || '').toLowerCase() === 'games played'));
  const details = applyStandingTotals(rawDetails, teamStanding);
  const displaySeasonStatistic = seasonStatistic ? { ...seasonStatistic, details } : seasonStatistic;

  return (
    <>
      <section className="card dashboard-card team-season-stats-card">
        <div className="team-season-stats-header">
          <div>
            <h6 className="accent-heading">Season Statistics</h6>
            {/* {seasonStatistic && <span className="team-season-stats-season">{seasonLabel(seasonStatistic)}</span>} */}
          </div>
          <button className="card-link team-stats-view-button" type="button" onClick={() => setIsModalOpen(true)} disabled={!seasonStatistic}>
            View all →
          </button>
        </div>

        {loading && <p className="team-stats-state">Loading statistics...</p>}
        {!loading && error && <p className="team-stats-state error">Statistics unavailable</p>}
        {!loading && !error && !seasonStatistic && <p className="team-stats-state">No season statistics available.</p>}
        {!loading && !error && seasonStatistic && (
          <div className="team-season-stat-grid">
            {SUMMARY_STATS.map((stat) => {
              const detail = findSummaryDetail(details, stat.match);
              return (
                <div className="team-season-stat" key={stat.key}>
                  <span className="team-season-stat-value">{formatValue(detail)}</span>
                  <span className="team-season-stat-label">{stat.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <AllStatisticsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        seasonStatistic={displaySeasonStatistic}
        sourceGamesPlayed={sourceGamesPlayed}
        standingsGamesPlayed={teamStanding?.played}
      />
    </>
  );
}
