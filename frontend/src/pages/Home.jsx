import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import Header from "../components/Header/Header";
import FooterNav from "../components/FooterNav/FooterNav";
import TopLeagues from "../components/TopLeagues/TopLeagues";
import LiveScoreCards from "../components/LiveScoreCards/LiveScoreCards";
import TopStories from "../components/TopStories/TopStories";
import { AdSenseAd, PremiumBanner } from "../components/AdSense";
import { getLiveMatches, getNews } from "../api";

import "./css/home.css";



const Home = () => {
  const [liveMatches, setLiveMatches] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);

  // Helper function to determine match status for LiveScoreCards component
  const getMatchStatus = (match) => {
    const shortName = match.match_status?.short_name || match.status;
    
    if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'LIVE', 'IN_PLAY'].includes(shortName)) {
      return 'live';
    } else if (['FT', 'AET', 'PEN', 'FINISHED'].includes(shortName)) {
      return 'finished';
    } else {
      return 'upcoming';
    }
  };

  // Helper function to check if match should be shown (live or upcoming only)
  const shouldShowMatch = (match) => {
    const status = getMatchStatus(match);
    return status === 'live' || status === 'upcoming';
  };

  // Load live matches and news on component mount
  useEffect(() => {
    const loadHomeData = async () => {
      setLoading(true);
      try {
        // Load live matches and top news in parallel
        const [matchesData, newsData] = await Promise.all([
          getLiveMatches(20).catch((error) => {
            console.log('Live matches API not available, using fallback data');
            // Fallback data while API is being deployed - only live and upcoming
            return [
              {
                id: "1",
                match_id: 1,
                date: new Date().toISOString(),
                teams: {
                  home: { team_name: "Manchester City" },
                  away: { team_name: "Liverpool" }
                },
                score: { home: 2, away: 1 },
                status: "live",
                match_status: { short_name: "2H" },
                minute: 75,
                match_info: { starting_at: new Date().toISOString() }
              },
              {
                id: "2", 
                match_id: 2,
                date: new Date(Date.now() + 1000 * 60 * 60 * 1).toISOString(),
                teams: {
                  home: { team_name: "Arsenal" },
                  away: { team_name: "Chelsea" }
                },
                score: { home: null, away: null },
                status: "upcoming",
                match_status: { short_name: "NS" },
                match_info: { starting_at: new Date(Date.now() + 1000 * 60 * 60 * 1).toISOString() }
              },
              {
                id: "3",
                match_id: 3,
                date: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
                teams: {
                  home: { team_name: "Manchester United" },
                  away: { team_name: "Tottenham" }
                },
                score: { home: null, away: null },
                status: "upcoming",
                match_status: { short_name: "NS" },
                match_info: { starting_at: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString() }
              },
              {
                id: "4",
                match_id: 4,
                date: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
                teams: {
                  home: { team_name: "Newcastle" },
                  away: { team_name: "Brighton" }
                },
                score: { home: null, away: null },
                status: "upcoming",
                match_status: { short_name: "NS" },
                match_info: { starting_at: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString() }
              },
              {
                id: "5",
                match_id: 5,
                date: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
                teams: {
                  home: { team_name: "Everton" },
                  away: { team_name: "Crystal Palace" }
                },
                score: { home: null, away: null },
                status: "upcoming",
                match_status: { short_name: "NS" },
                match_info: { starting_at: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString() }
              }
            ];
          }),
          getNews(5).catch((error) => {
            console.log('News API not available, using fallback data:', error);
            // Fallback data while API is being deployed
            return [
              {
                id: 1,
                title: "Premier League Transfer Window Updates",
                summary: "Latest transfer news and rumors from the Premier League as clubs prepare for the upcoming window.",
                source: "BBC Sport",
                published_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                url: "https://www.bbc.com/sport/football/premier-league"
              },
              {
                id: 2,
                title: "Champions League Draw Results",
                summary: "The Champions League knockout stage draw has been completed with several exciting matchups confirmed.",
                source: "UEFA",
                published_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
                url: "https://www.uefa.com/uefachampionsleague/"
              },
              {
                id: 3,
                title: "La Liga Title Race Intensifies",
                summary: "With the season heating up, the battle for the La Liga title is becoming more competitive than ever.",
                source: "ESPN",
                published_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
                url: "https://www.espn.com/soccer/league/_/name/esp.1"
              },
              {
                id: 4,
                title: "Bundesliga Weekend Preview",
                summary: "A comprehensive look at the key fixtures and storylines for this weekend's Bundesliga matches.",
                source: "Sky Sports", 
                published_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
                url: "https://www.skysports.com/bundesliga"
              }
            ];
          })
        ]);
        
        // Filter to only live and upcoming matches, then transform
        const filteredMatches = matchesData.filter(shouldShowMatch);
        const transformedMatches = filteredMatches.map(match => ({
          id: match.match_id || match.id,
          date: match.match_info?.starting_at || match.date,
          home_team: match.teams?.home?.team_name || match.home_team,
          away_team: match.teams?.away?.team_name || match.away_team,
          home_logo: match.teams?.home?.logo || match.home_logo,
          away_logo: match.teams?.away?.logo || match.away_logo,
          status: getMatchStatus(match),
          score: match.score || { home: null, away: null }
        }));
        
        // Ensure we have at least 5 matches, add more upcoming if needed
        if (transformedMatches.length < 5) {
          // Add more fallback upcoming matches to reach minimum of 5
          const additionalMatches = [
            {
              id: "fallback-3",
              date: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
              home_team: "Manchester United",
              away_team: "Tottenham",
              status: "upcoming",
              score: { home: null, away: null }
            },
            {
              id: "fallback-4",
              date: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
              home_team: "Newcastle",
              away_team: "Brighton",
              status: "upcoming",
              score: { home: null, away: null }
            },
            {
              id: "fallback-5",
              date: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(),
              home_team: "Everton",
              away_team: "Crystal Palace",
              status: "upcoming",
              score: { home: null, away: null }
            }
          ];
          
          const needed = 5 - transformedMatches.length;
          transformedMatches.push(...additionalMatches.slice(0, needed));
        }
        
        setLiveMatches(transformedMatches);
        setNews(newsData);
      } catch (error) {
        console.error('Error loading home data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHomeData();
  }, []);

  return (
    <div>
      <Header />
      <div className="home-content">
        {/* Header Ad */}
        <AdSenseAd 
          slot="1234567890" // Replace with your actual ad slot ID
          format="rectangle"
          className="adsense-header adsense-large-rectangle"
        />
        <PremiumBanner />
        
        <TopLeagues />
        
        {/* Inline Ad between sections */}
        <AdSenseAd 
          slot="0987654321" // Replace with your actual ad slot ID
          format="auto"
          className="adsense-inline adsense-banner"
        />
        
        {/* Live Scores Feed */}
        <div className="livescores-section">
          <div className="section-header">
            <h2>Live Scores</h2>
            <Link to="/#live-scores" className="view-more-link">View All →</Link>
          </div>
          
          {loading ? (
            <div className="loading-content">Loading live scores...</div>
          ) : (
            <LiveScoreCards matches={liveMatches.slice(0, 8)} />
          )}
        </div>
        
        {/* Another inline ad */}
        <AdSenseAd 
          slot="1122334455" // Replace with your actual ad slot ID
          format="rectangle"
          className="adsense-inline adsense-medium-rectangle"
        />
        
        {/* News Feed */}
        <div className="news-section">
          <div className="section-header">
            <h2>Latest News</h2>
            <Link to="/news" className="view-more-link">View All News →</Link>
          </div>
          
          {loading ? (
            <div className="loading-content">Loading latest news...</div>
          ) : news.length > 0 ? (
            <div className="news-feed-home">
              {news.slice(0, 4).map((article) => (
                <div key={article.id} className="news-card-feed">
                  <div className="news-card-content">
                    <div className="news-meta-feed">
                      <span className="news-source-feed">{article.source}</span>
                      <span className="news-time-feed">
                        {new Date(article.published_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="news-title-feed">
                      <a href={article.url} target="_blank" rel="noopener noreferrer">
                        {article.title}
                      </a>
                    </h3>
                    <p className="news-summary-feed">
                      {article.summary.slice(0, 100)}...
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TopStories />
          )}
        </div>
        
        {/* Footer Ad */}
        <AdSenseAd 
          slot="5544332211" // Replace with your actual ad slot ID
          format="auto"
          className="adsense-footer adsense-leaderboard"
        />
      </div>
      <FooterNav />
    </div>
  );
};

export default Home;
