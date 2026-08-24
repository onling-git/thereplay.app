import React from 'react';
import { AdSenseAd } from '../AdSense';
import { ADSENSE_CONFIG } from '../../config/adsense';
import './ReportContent.css';

const ReportContent = ({ report }) => {
  if (!report) return <p>No report available.</p>;

  // Handle both legacy string reports and new structured reports
  if (typeof report === 'string') {
    return (
      <article className="report-content legacy">
        <div className="report-text">
          {report.split('\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </article>
    );
  }

  // New structured report format
  const { generated, content } = report;
  const socialSources = generated?.social_sources || report.social_sources || [];

  return (
    <article className="report-content structured">
      {/* Headline */}
      {generated?.headline && (
        <h1 className="report-headline">{generated.headline}</h1>
      )}

      {/* AdSense Ad after title */}
      <AdSenseAd
        slot={ADSENSE_CONFIG.AD_SLOTS.MATCH_INLINE}
        format="auto"
        responsive={true}
        className="adsense-inline adsense-medium-rectangle"
      />

      {/* Main match report: narrative and analysis are written together */}
      {generated?.summary_paragraphs && (
        <div className="report-section summary">
          <h3>Main Match Report</h3>
          <h4 className="report-subheading">Match Context / Analysis</h4>
          {generated.summary_paragraphs.map((paragraph, index) => (
            <p key={index} className="summary-paragraph">{paragraph}</p>
          ))}
        </div>
      )}

      {/* Key moments */}
      {generated?.key_moments && generated.key_moments.length > 0 && (
        <div className="report-section key-moments">
          <h3>Key Moments</h3>
          <ul>
            {generated.key_moments.map((moment, index) => (
              <li key={index}>{moment}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Player of the Match */}
      {generated?.player_of_the_match && (
        <div className="report-section potm">
          <h3>Player of the Match</h3>
          <div className="potm-content">
            <strong>{generated.player_of_the_match.player}</strong>
            {generated.player_of_the_match.reason && (
              <span> - {generated.player_of_the_match.reason}</span>
            )}
          </div>
        </div>
      )}

      {/* AdSense Ad after POTM */}
      {generated?.player_of_the_match && (
        <AdSenseAd
          slot={ADSENSE_CONFIG.AD_SLOTS.MATCH_FOOTER}
          format="auto"
          responsive={true}
          className="adsense-inline adsense-medium-rectangle"
        />
      )}

      {/* Lightweight attribution for social context used in the article */}
      {socialSources.length > 0 && (
        <div className="report-sources">
          <h3>Match Sources</h3>
          <ul>
            {socialSources.map((source, index) => {
              const account = source.handle ? `@${source.handle.replace(/^@/, '')}` : null;
              const credit = [source.author_name, account, source.publication]
                .filter(Boolean)
                .join(' / ');

              return (
                <li key={`${source.url || 'source'}-${index}`}>
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {credit || 'Original post'}
                    </a>
                  ) : (
                    credit || 'Original post'
                  )}
                  {source.context && <span> - {source.context}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Fallback to content field if structured data incomplete */}
      {!generated?.summary_paragraphs && content && (
        <div className="report-fallback">
          {content.split('\n\n').map((section, index) => (
            <p key={index}>{section}</p>
          ))}
        </div>
      )}

      {/* Sources */}
      {generated?.sources && generated.sources.length > 0 && (
        <div className="report-sources">
          <small>
            <strong>Sources:</strong> {generated.sources.join(', ')}
          </small>
        </div>
      )}
    </article>
  );
};

export default ReportContent;