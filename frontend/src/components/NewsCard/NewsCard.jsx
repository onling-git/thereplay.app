import React, { useState, useEffect } from "react";
import { getNewsForTeam } from "../../api";
import htmlToPlainText from "../../utils/htmlToPlainText";
import "./newsCard.css";

const NewsCard = ({
  articles,
  teamSlug,
  maxArticles = 4,
  showViewMore = false,
  viewMorePath = "/news",
  onArticleClick,
}) => {
  const [teamNews, setTeamNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch team news if teamSlug is provided but no articles
  useEffect(() => {
    if (teamSlug && (!articles || articles.length === 0)) {
      setLoading(true);
      setError(null);
      
      getNewsForTeam(teamSlug, maxArticles)
        .then(response => {
          
          // Handle both direct array response and wrapped response
          const newsData = Array.isArray(response) ? response : (response.data || response.articles || []);
          
          setTeamNews(newsData);
        })
        .catch(err => {
          console.error('Error fetching team news:', err);
          console.error('[DEBUG] Error details:', err);
          setError(err.message);
          setTeamNews([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [teamSlug, articles, maxArticles]);

  // Use provided articles or fetched team news
  const displayArticles = articles && articles.length > 0 ? articles : teamNews;

  if (loading) {
    return (
      <div className="team-news-loading">
        <p>Loading team news...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="team-news-loading">
        <p>Unable to load news: {error}</p>
      </div>
    );
  }

  if (!displayArticles || displayArticles.length === 0) {
    return (
      <div className="team-news-loading">
        <p>No news available</p>
        {teamSlug && <p style={{fontSize: '0.9em', opacity: 0.7, marginTop: '8px'}}>No recent articles found for this team</p>}
      </div>
    );
  }

  const displayedArticles = displayArticles.slice(0, maxArticles);

  return (
    <div className="news-section">
      <div className="news-feed">
        {displayedArticles.map((article) => (
          <div key={article.id} className="news-card">

            <div className="news-card-image" aria-hidden={article.image_url ? undefined : true}>
              {article.image_url && (
                <img src={article.image_url} alt={article.title} loading="lazy" width="224" height="140" />
              )}
            </div>
            <div className="news-card-content">
              <div className="news-meta">
                <span className="news-source">{article.source}</span>
                <span className="news-separator">·</span>
                <span className="news-time">
                  {new Date(article.published_at).toLocaleDateString()}
                </span>
              </div>
              <p className="news-card-title">
                <a href={article.url} onClick={onArticleClick} target={onArticleClick ? undefined : "_blank"} rel="noopener noreferrer">
                  {article.title}
                </a>
              </p>
              <p className="news-summary">{htmlToPlainText(article.summary).slice(0, 100)}...</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewsCard;
