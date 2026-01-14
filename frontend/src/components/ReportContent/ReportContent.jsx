import React from 'react';
import EmbeddedTweet from '../EmbeddedTweet';
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
  const embeddedTweets = generated?.embedded_tweets || [];

  // DEBUG: Log the report data to console
  console.log('🐛 ReportContent Debug:', {
    hasGenerated: !!generated,
    embeddedTweetsCount: embeddedTweets.length,
    embeddedTweets: embeddedTweets,
    reportKeys: Object.keys(report),
    generatedKeys: generated ? Object.keys(generated) : null
  });

  // Group tweets by placement hint for better positioning
  const tweetsByPlacement = embeddedTweets.reduce((acc, tweet) => {
    const placement = tweet.placement_hint || 'after_summary';
    if (!acc[placement]) acc[placement] = [];
    acc[placement].push(tweet);
    return acc;
  }, {});

  return (
    <article className="report-content structured">
      {/* Headline */}
      {generated?.headline && (
        <h2 className="report-headline">{generated.headline}</h2>
      )}

      {/* Summary paragraphs */}
      {generated?.summary_paragraphs && (
        <div className="report-section summary">
          {generated.summary_paragraphs.map((paragraph, index) => (
            <p key={index} className="summary-paragraph">{paragraph}</p>
          ))}
        </div>
      )}

      {/* Tweets after summary */}
      {embeddedTweets.length > 0 && (
        <div className="embedded-tweets-section">
          <h3>🐦 Social Media</h3>
          {embeddedTweets.map((tweet, index) => (
            <EmbeddedTweet key={tweet.tweet_id || index} tweet={tweet} />
          ))}
        </div>
      )}
      
      {/* DEBUG: Show when no tweets are available */}
      {embeddedTweets.length === 0 && (
        <div style={{background: '#f0f0f0', padding: '10px', margin: '10px 0', fontSize: '12px'}}>
          🐛 DEBUG: No embedded tweets found (Count: {embeddedTweets.length})
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

      {/* Commentary */}
      {generated?.commentary && generated.commentary.length > 0 && (
        <div className="report-section commentary">
          <h3>Commentary</h3>
          {generated.commentary.map((comment, index) => (
            <p key={index} className="commentary-item">{comment}</p>
          ))}
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

      {/* Tweets with POTM */}
      {tweetsByPlacement.with_potm && (
        <div className="embedded-tweets-section">
          {tweetsByPlacement.with_potm.map((tweet, index) => (
            <EmbeddedTweet key={tweet.tweet_id || index} tweet={tweet} />
          ))}
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