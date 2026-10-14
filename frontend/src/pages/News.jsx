import React, { useState, useEffect, useRef } from "react";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { getNews, getNewsForLeague, getNewsForTeam, getNewsLeagues } from "../api";
import { AdSenseAd } from "../components/AdSense";
import htmlToPlainText from "../utils/htmlToPlainText";
import { legacyTeamNewsPath } from "../utils/teamNewsUrl.mjs";
import { normalizeNewsCollection, newsPageUrl } from "../utils/newsCollection.mjs";
import NewsStructuredData from "../components/NewsStructuredData";
import "./css/news.css";

export function NewsRoute() {
  const { pathname, search, hash } = useLocation();
  const redirect = legacyTeamNewsPath(pathname, search, hash);
  return redirect ? <Navigate to={redirect} replace /> : <News />;
}

const News = () => {
  const { teamSlug: routeTeamSlug } = useParams();
  const [searchParams] = useSearchParams();
  const teamSlug = routeTeamSlug || searchParams.get("team");
  const teamName = teamSlug?.replace(/-/g, " ");
  const [initialCollection] = useState(() => {
    const snapshot = document.getElementById('news-initial-data');
    if (!snapshot) return null;
    try {
      const data = JSON.parse(snapshot.textContent);
      if (data.pageUrl !== newsPageUrl(teamSlug)) return null;
      return normalizeNewsCollection(data);
    } catch (error) {
      console.error('Invalid initial news data:', error);
      return null;
    }
  });
  const initialPending = useRef(Boolean(initialCollection));
  const [news, setNews] = useState(initialCollection?.articles || []);
  const [collection, setCollection] = useState(initialCollection);
  const [loadedKey, setLoadedKey] = useState(initialCollection ? `${teamSlug || ''}:all` : null);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState("all");
  const [loading, setLoading] = useState(!initialCollection);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.getElementById('news-initial-data')?.remove();
  }, []);

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

  useEffect(() => {
    let active = true;
    const loadNews = async () => {
      if (initialPending.current) {
        initialPending.current = false;
        setNews(initialCollection.articles);
        return;
      }
      setLoading(true);
      setError(null);
      setNews([]);

      try {
        const response = teamSlug
          ? await getNewsForTeam(teamSlug)
          : selectedLeague === "all"
            ? await getNews()
            : await getNewsForLeague(selectedLeague);
        const normalized = normalizeNewsCollection(response);
        if (active) {
          setNews(normalized.articles);
          setCollection(normalized);
          setLoadedKey(`${teamSlug || ''}:${selectedLeague}`);
        }
      } catch (err) {
        if (active) {
          console.error("Error loading news:", err);
          setError("Failed to load news");
          setCollection(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadNews();
    return () => { active = false; };
  }, [selectedLeague, teamSlug, initialCollection]);

  const handleLeagueChange = (e) => {
    setSelectedLeague(e.target.value);
  };

  if (loading || (!error && loadedKey !== `${teamSlug || ''}:${selectedLeague}`)) {
    return (
      <div className="news-page">
        <NewsStructuredData teamSlug={teamSlug} pending />
        <div className="news-loading" role="status">Loading news...</div>
      </div>
    );
  }

  return (
    <div>
      <NewsStructuredData
        teamSlug={teamSlug}
        collection={!error && loadedKey === `${teamSlug || ''}:${selectedLeague}` ? collection : null}
      />
      <div className="news-page">
        <div className="news-header">
          <h1>{teamName ? `${teamName} News` : "Football News"}</h1>

          {teamSlug ? (
            <Link to="/news" className="card-link">All football news</Link>
          ) : (
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
          )}
        </div>
        <div>
          <p className="news-intro">
            Stay up to date with the latest football news, transfer updates,
            match reports and analysis from leagues around the world. Filter by
            competition to follow stories that matter most to you.
          </p>
          <p className="news-summary-text">
            Showing {news.length} of the latest articles
            {teamName
              ? ` related to ${teamName}`
              : selectedLeague !== "all"
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
              {!teamSlug && selectedLeague !== "all" && (
                <p>
                  Try selecting a different league or browse all competitions
                  for the latest updates.
                </p>
              )}
            </div>
          ) : (
            <div className="news-list">
              {news.map((article) => (
                <article key={article.id} className="card news-card">
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
                      {article.kind === 'match-report' ? (
                        <Link to={new URL(article.url).pathname}>{article.title}</Link>
                      ) : (
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {article.title}
                        </a>
                      )}
                    </h2>

                    <p className="news-summary">{htmlToPlainText(article.summary)}</p>

                    <div className="news-actions">
                      {article.kind === 'match-report' ? (
                        <Link to={new URL(article.url).pathname}>Read More →</Link>
                      ) : (
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Read More →
                        </a>
                      )}
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
