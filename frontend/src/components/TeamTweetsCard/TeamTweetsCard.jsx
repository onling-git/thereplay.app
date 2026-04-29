import React, { useState, useEffect } from "react";
import "./teamTweetsCard.css";

const TeamTweetsCard = ({ teamSlug, maxTweets = 10 }) => {
  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!teamSlug) return;

    const fetchTweets = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${
            process.env.REACT_APP_API_BASE ||
            "https://virtuous-exploration-production.up.railway.app"
          }/api/tweets/team/${encodeURIComponent(teamSlug)}?feedType=team_feed&limit=${maxTweets}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setTweets(data.tweets || []);
      } catch (err) {
        console.error("Error fetching team tweets:", err);
        setError(err.message);
        setTweets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTweets();
  }, [teamSlug, maxTweets]);

  // Decode HTML entities in tweet text
  const decodeHTML = (html) => {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  };

  // Format time ago
  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const tweetDate = new Date(dateString);
    const diffMs = now - tweetDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${diffMins}m`;
    } else if (diffHours < 24) {
      return `${diffHours}h`;
    } else if (diffDays < 7) {
      return `${diffDays}d`;
    } else {
      return tweetDate.toLocaleDateString();
    }
  };

  // Format engagement numbers
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  // Don't render if loading, error, or no tweets
  if (loading) return null;
  if (error) return null;
  if (!tweets || tweets.length === 0) return null;

  return (
    <div className="tweets-section">
      <div className="tweets-feed">
        {tweets.map((tweet) => (
          <div key={tweet.tweet_id} className="tweet-card">
            {/* Show retweet indicator if this is a retweet */}
            {tweet.isRetweet && (
              <div className="retweet-indicator">
                <svg viewBox="0 0 24 24" className="retweet-icon">
                  <g>
                    <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path>
                  </g>
                </svg>
                <span>{tweet.author?.name || "Unknown"} Retweeted</span>
              </div>
            )}

            {/* Show original tweet author if this is a retweet, otherwise show current author */}
            <div className="tweet-header">
              {(tweet.isRetweet ? tweet.retweetedTweet?.author?.profilePicture : tweet.author?.profilePicture) && (
                <img
                  src={tweet.isRetweet ? tweet.retweetedTweet.author.profilePicture : tweet.author.profilePicture}
                  alt={tweet.isRetweet ? tweet.retweetedTweet.author.name : tweet.author.name}
                  className="tweet-avatar"
                />
              )}
              <div className="tweet-author-info">
                <div className="tweet-author-name">
                  {tweet.isRetweet ? (tweet.retweetedTweet?.author?.name || "Unknown") : (tweet.author?.name || "Unknown")}
                  {(tweet.isRetweet ? tweet.retweetedTweet?.author?.isBlueVerified : tweet.author?.isBlueVerified) && (
                    <svg
                      className="verified-badge"
                      viewBox="0 0 24 24"
                      aria-label="Verified account"
                    >
                      <g>
                        <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"></path>
                      </g>
                    </svg>
                  )}
                </div>
                <div className="tweet-meta">
                  <span className="tweet-username">
                    @{tweet.isRetweet ? (tweet.retweetedTweet?.author?.userName || "unknown") : (tweet.author?.userName || "unknown")}
                  </span>
                  <span className="tweet-separator">·</span>
                  <span className="tweet-time">
                    {formatTimeAgo(tweet.isRetweet && tweet.retweetedTweet?.created_at ? tweet.retweetedTweet.created_at : tweet.created_at)}
                  </span>
                </div>
              </div>
            </div>

            {/* Show original tweet text for retweets, or regular text */}
            <div className="tweet-content">
              <p className="tweet-text">
                {decodeHTML(tweet.isRetweet && tweet.retweetedTweet?.text ? tweet.retweetedTweet.text : tweet.text)}
              </p>
              
              {/* Display media/images if available */}
              {((tweet.isRetweet ? tweet.retweetedTweet?.media : tweet.media) || []).length > 0 && (
                <div className="tweet-media">
                  {(tweet.isRetweet ? tweet.retweetedTweet.media : tweet.media).map((media, idx) => (
                    <div key={idx} className="tweet-media-item">
                      {media.type === 'photo' && (
                        <img 
                          src={media.media_url_https || media.url} 
                          alt="Tweet media" 
                          className="tweet-image"
                        />
                      )}
                      {media.type === 'video' && (
                        <div className="tweet-video-placeholder">
                          <span>🎥 Video</span>
                        </div>
                      )}
                      {media.type === 'animated_gif' && (
                        <div className="tweet-video-placeholder">
                          <span>GIF</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Display quoted tweet if available */}
              {tweet.isQuote && tweet.quotedTweet && (
                <div className="quoted-tweet">
                  <div className="quoted-tweet-header">
                    {tweet.quotedTweet.author?.profilePicture && (
                      <img
                        src={tweet.quotedTweet.author.profilePicture}
                        alt={tweet.quotedTweet.author.name}
                        className="quoted-tweet-avatar"
                      />
                    )}
                    <div className="quoted-tweet-author">
                      <span className="quoted-author-name">{tweet.quotedTweet.author?.name || "Unknown"}</span>
                      <span className="quoted-author-username">@{tweet.quotedTweet.author?.userName || "unknown"}</span>
                    </div>
                  </div>
                  <p className="quoted-tweet-text">{decodeHTML(tweet.quotedTweet.text)}</p>
                  {tweet.quotedTweet.media && tweet.quotedTweet.media.length > 0 && (
                    <div className="tweet-media">
                      {tweet.quotedTweet.media.map((media, idx) => (
                        <div key={idx} className="tweet-media-item">
                          {media.type === 'photo' && (
                            <img 
                              src={media.media_url_https || media.url} 
                              alt="Quoted tweet media" 
                              className="tweet-image"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="tweet-engagement">
              <div className="engagement-stat">
                <svg viewBox="0 0 24 24" className="engagement-icon">
                  <g>
                    <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path>
                  </g>
                </svg>
                <span>{formatNumber(tweet.replyCount || 0)}</span>
              </div>
              <div className="engagement-stat">
                <svg viewBox="0 0 24 24" className="engagement-icon">
                  <g>
                    <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path>
                  </g>
                </svg>
                <span>{formatNumber(tweet.retweetCount || 0)}</span>
              </div>
              <div className="engagement-stat">
                <svg viewBox="0 0 24 24" className="engagement-icon">
                  <g>
                    <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path>
                  </g>
                </svg>
                <span>{formatNumber(tweet.likeCount || 0)}</span>
              </div>
            </div>

            <a
              href={tweet.url}
              target="_blank"
              rel="noopener noreferrer"
              className="tweet-link"
            >
              View on X
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeamTweetsCard;
