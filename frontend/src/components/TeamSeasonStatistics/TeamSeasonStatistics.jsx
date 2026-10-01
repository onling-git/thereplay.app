import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import './TeamSeasonStatistics.css';

const SUMMARY_STATS = [
  { key: 'goalsScoredPer90', label: 'Goals Scored per 90', match: ['goals scored per 90', 'goals per 90'] },
  { key: 'goalsConcededPer90', label: 'Goals Conceded per 90', match: ['goals conceded per 90'] },
  { key: 'averagePossession', label: 'Average Possession', match: ['average possession', 'possession'] },
  { key: 'cleanSheets', label: 'Clean Sheets', match: ['clean sheets', 'clean sheet'] },
];

function getDetails(seasonStatistic) {
  return Array.isArray(seasonStatistic?.details) ? seasonStatistic.details : [];
}

function getValue(detail) {
  const value = detail?.value;
  if (value == null) return null;
  if (typeof value !== 'object') return value;
  return value.total ?? value.average ?? value.value ?? null;
}

function formatValue(detail) {
  const value = getValue(detail);
  if (value == null || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  const formatted = Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  const name = String(detail?.name || '').toLowerCase();
  return name.includes('possession') || name.includes('%') ? `${formatted}%` : formatted;
}

function findSummaryDetail(details, matchers) {
  return details.find((detail) => {
    const name = String(detail?.name || '').toLowerCase();
    return matchers.some((matcher) => name === matcher || name.includes(matcher));
  });
}

function seasonLabel(seasonStatistic) {
  return seasonStatistic?.season?.name || seasonStatistic?.season_id || 'Current season';
}

function AllStatisticsModal({ isOpen, onClose, seasonStatistic }) {
  if (!isOpen) return null;

  const details = getDetails(seasonStatistic);
  return (
    <div className="team-stats-modal-overlay" onClick={onClose}>
      <div className="team-stats-modal card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="team-stats-modal-title">
        <header className="team-stats-modal-header">
          <div>
            <h2 id="team-stats-modal-title" className="accent-heading">All Team Statistics</h2>
            <p>{seasonLabel(seasonStatistic)}</p>
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
                  <strong>{formatValue(detail)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamSeasonStatistics({ seasonStatistics, loading, error }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(null);

  useEffect(() => {
    if (!selectedSeason && seasonStatistics?.length) setSelectedSeason(seasonStatistics[0]);
  }, [seasonStatistics, selectedSeason]);

  const seasonStatistic = selectedSeason || seasonStatistics?.[0];
  const details = getDetails(seasonStatistic);

  return (
    <>
      <section className="card dashboard-card team-season-stats-card">
        <div className="team-season-stats-header">
          <div>
            <h6 className="accent-heading">Season Statistics</h6>
            {seasonStatistic && <span className="team-season-stats-season">{seasonLabel(seasonStatistic)}</span>}
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
                  <span>{stat.label}</span>
                  <strong>{formatValue(detail)}</strong>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <AllStatisticsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        seasonStatistic={seasonStatistic}
      />
    </>
  );
}
