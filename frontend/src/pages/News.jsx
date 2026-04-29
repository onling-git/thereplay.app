import React, { useState, useEffect } from "react";
import { getNews, getNewsForLeague, getNewsLeagues } from "../api";
import { AdSenseAd } from "../components/AdSense";
import "./css/news.css";

const News = () => {
  const [news, setNews] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Format published date
  const formatPublishedDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  };

  // Load news based on selected league
  const loadNews = async (leagueFilter = "all") => {
    setLoading(true);
    setError(null);

    try {
      let newsData;
      if (leagueFilter === "all") {
        newsData = await getNews();
      } else {
        newsData = await getNewsForLeague(leagueFilter);
      }
      setNews(newsData);
    } catch (err) {
      console.error("Error loading news:", err);
      setError("Failed to load news");
    } finally {
      setLoading(false);
    }
  };

  // Load leagues for filter
  useEffect(() => {
    const loadLeagues = async () => {
      try {
        const leaguesData = await getNewsLeagues();
        setLeagues(leaguesData);
      } catch (err) {
        console.error("Error loading news leagues:", err);
      }
    };

    loadLeagues();
  }, []);

  // Load news when component mounts or league filter changes
  useEffect(() => {
    loadNews(selectedLeague);
  }, [selectedLeague]);

  const handleLeagueChange = (e) => {
    setSelectedLeague(e.target.value);
  };

  if (loading) {
    return (
      <div>
        <div className="news-loading">Loading news...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="news-page">
        <div className="news-header">
          <h1>Football News</h1>

          <div className="league-filter">
            <label htmlFor="league-select">Filter by League:</label>
            <select
              id="league-select"
              value={selectedLeague}
              onChange={handleLeagueChange}
              className="league-select"
            >
              <option value="all">All Leagues</option>
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <p className="news-intro">
            Stay up to date with the latest football news, transfer updates,
            match reports and analysis from leagues around the world. Filter by
            competition to follow stories that matter most to you.
          </p>
          <p className="news-summary-text">
            Showing {news.length} of the latest articles
            {selectedLeague !== "all"
              ? ` from the selected league`
              : " across all leagues"}
            .
          </p>
        </div>
        {error && <div className="error-message">{error}</div>}

        {/* Inline Ad */}
        <AdSenseAd
          slot="8038180302"
          format="rectangle"
          className="adsense-inline adsense-medium-rectangle"
        />

        <div className="news-container">
          {news.length === 0 ? (
            <div className="no-news">
              <p>No football news articles found for the selected filter.</p>
              {selectedLeague !== "all" && (
                <p>
                  Try selecting a different league or browse all competitions
                  for the latest updates.
                </p>
              )}
            </div>
          ) : (
            <div className="news-list">
              {news.map((article) => (
                <article key={article.id} className="news-card">
                  {article.image_url && (
                    <div className="news-image">
                      <img src={article.image_url} alt={article.title} />
                    </div>
                  )}

                  <div className="news-content">
                    <div className="news-meta">
                      <span className="news-source">{article.source}</span>
                      {article.league_name && (
                        <span className="news-league">
                          {article.league_name}
                        </span>
                      )}
                      <span className="news-time">
                        {formatPublishedDate(article.published_at)}
                      </span>
                    </div>

                    <h2 className="news-title">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {article.title}
                      </a>
                    </h2>

                    <p className="news-summary">{article.summary}</p>

                    <div className="news-actions">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn"
                      >
                        Read More →
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Footer Ad */}
        <AdSenseAd
          slot="8038180302"
          format="auto"
          className="adsense-footer adsense-leaderboard"
        />
      </div>
    </div>
  );
};

export default News;
