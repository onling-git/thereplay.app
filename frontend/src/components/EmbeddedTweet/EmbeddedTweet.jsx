import React from 'react';
import './EmbeddedTweet.css';

const EmbeddedTweet = ({ tweet }) => {
  if (!tweet || !tweet.text) return null;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatEngagement = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count?.toString() || '0';
  };

  const handleTweetClick = () => {
    if (tweet.url) {
      window.open(tweet.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="embedded-tweet" onClick={handleTweetClick}>
      <div className="tweet-header">
        <div className="tweet-author">
          {tweet.author?.profilePicture && (
            <img 
              src={tweet.author.profilePicture} 
              alt={`${tweet.author.name || tweet.author.userName} profile`}
              className="profile-picture"
            />
          )}
          <div className="author-info">
            <div className="author-name">
              {tweet.author?.name || tweet.author?.userName}
              {tweet.author?.isBlueVerified && (
                <span className="verified-badge" title="Verified">✓</span>
              )}
            </div>
            <div className="author-handle">@{tweet.author?.userName}</div>
          </div>
        </div>
        <div className="tweet-logo">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#1d9bf0">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </div>
      </div>
      
      <div className="tweet-content">
        <p>{tweet.text}</p>
      </div>
      
      <div className="tweet-footer">
        <div className="tweet-date">
          {tweet.created_at && formatDate(tweet.created_at)}
        </div>
        <div className="tweet-engagement">
          {tweet.engagement?.likes > 0 && (
            <span className="engagement-stat">
              <span className="heart-icon">♥</span>
              {formatEngagement(tweet.engagement.likes)}
            </span>
          )}
          {tweet.engagement?.retweets > 0 && (
            <span className="engagement-stat">
              <span className="retweet-icon">🔄</span>
              {formatEngagement(tweet.engagement.retweets)}
            </span>
          )}
          {tweet.engagement?.replies > 0 && (
            <span className="engagement-stat">
              <span className="reply-icon">💬</span>
              {formatEngagement(tweet.engagement.replies)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmbeddedTweet;