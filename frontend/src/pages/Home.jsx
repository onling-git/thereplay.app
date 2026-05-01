import { useState, useEffect } from "react";

import LiveScoreCards from "../components/LiveScoreCards/LiveScoreCards";
import NewsCard from "../components/NewsCard/NewsCard";
import { AdSenseAd, PremiumBanner } from "../components/AdSense";
import {
  getLiveMatches,
  getTodayMatches,
  getNews,
  getLeagues,
  getLeagueFixtures,
} from "../api";

import HeaderNav from "../components/HeaderNav/HomeHeaderNav";

import football from "../assets/images/ball-icon.svg";
import arrow from "../assets/images/arrow-down-solid-full.svg";

import "./css/home.css";

const Home = () => {
  const [liveMatches, setLiveMatches] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date()); // Default to today
  const [availableLeagues, setAvailableLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState("all"); // 'all' or specific league ID

  // Helper function to determine match status for HomeLiveScoreCards component
  const getMatchStatus = (match) => {
    const shortName = match.match_status?.short_name || match.status;
    const stateName = match.match_status?.state;

    console.log(
      "getMatchStatus - match:",
      match.teams?.home?.team_name,
      "vs",
      match.teams?.away?.team_name,
    );
    console.log(
      "getMatchStatus - shortName:",
      shortName,
      "stateName:",
      stateName,
      "full match_status:",
      match.match_status,
    );

    if (
      [
        "1H",
        "2H",
        "1st",
        "2nd",
        "HT",
        "ET",
        "BT",
        "P",
        "SUSP",
        "LIVE",
        "IN_PLAY",
        "INPLAY_1ST_HALF",
        "INPLAY_2ND_HALF",
      ].includes(shortName) ||
      ["INPLAY_1ST_HALF", "INPLAY_2ND_HALF", "HALFTIME"].includes(stateName)
    ) {
      console.log("Status determined as: live");
      return "live";
    } else if (["FT", "AET", "PEN", "FINISHED"].includes(shortName)) {
      console.log("Status determined as: finished");
      return "finished";
    } else {
      console.log("Status determined as: upcoming");
      return "upcoming";
    }
  };

  // Handle date selection change
  const handleDateChange = (newDate) => {
    console.log("📅 Home: Date changed to:", newDate.toDateString());
    setSelectedDate(newDate);
  };

  // Handle league selection change
  const handleLeagueChange = (leagueId) => {
    console.log("🏆 Home: League changed to:", leagueId);
    setSelectedLeague(leagueId);
  };

  // Load available leagues on component mount
  useEffect(() => {
    const loadLeagues = async () => {
      try {
        const leagues = await getLeagues();
        console.log("🏆 Home: Loaded leagues:", leagues);
        setAvailableLeagues(leagues || []);
      } catch (error) {
        console.error("Error loading leagues:", error);
        setAvailableLeagues([]);
      }
    };

    loadLeagues();
  }, []);

  // Load live matches and news on component mount and when date/league changes
  useEffect(() => {
    const loadHomeData = async () => {
      setLoading(true);
      try {
        console.log(
          "📡 Home: Loading data for date:",
          selectedDate.toDateString(),
          "league:",
          selectedLeague,
        );

        // Format date as YYYY-MM-DD for API
        const dateString = selectedDate.toISOString().split("T")[0];
        console.log("🗓️ Home: API date string:", dateString);

        // Determine which API call to make based on league selection
        let matchesPromise;
        if (selectedLeague === "all") {
          // Load all matches for selected date
          matchesPromise = getTodayMatches(dateString).catch((error) => {
            console.log(
              "Today matches API not available, falling back to live matches",
              error,
            );
            // Fallback to getLiveMatches if getTodayMatches fails
            return getLiveMatches(20).catch(() => []);
          });
        } else {
          // Load matches for specific league and date
          matchesPromise = getLeagueFixtures(selectedLeague, dateString).catch(
            (error) => {
              console.log(
                "League fixtures API failed, falling back to all matches",
                error,
              );
              // Fallback to getTodayMatches if getLeagueFixtures fails
              return getTodayMatches(dateString).catch(() => []);
            },
          );
        }

        // Load matches for selected date/league and top news in parallel
        const [matchesData, newsData] = await Promise.all([
          matchesPromise,
          getNews(5).catch((error) => {
            console.log("News API not available, using fallback data:", error);
            // Fallback data while API is being deployed
            return [
              {
                id: 1,
                title: "Premier League Transfer Window Updates",
                summary:
                  "Latest transfer news and rumors from the Premier League as clubs prepare for the upcoming window.",
                source: "BBC Sport",
                published_at: new Date(
                  Date.now() - 1000 * 60 * 30,
                ).toISOString(),
                url: "https://www.bbc.com/sport/football/premier-league",
              },
              {
                id: 2,
                title: "Champions League Draw Results",
                summary:
                  "The Champions League knockout stage draw has been completed with several exciting matchups confirmed.",
                source: "UEFA",
                published_at: new Date(
                  Date.now() - 1000 * 60 * 60 * 2,
                ).toISOString(),
                url: "https://www.uefa.com/uefachampionsleague/",
              },
              {
                id: 3,
                title: "La Liga Title Race Intensifies",
                summary:
                  "With the season heating up, the battle for the La Liga title is becoming more competitive than ever.",
                source: "ESPN",
                published_at: new Date(
                  Date.now() - 1000 * 60 * 60 * 3,
                ).toISOString(),
                url: "https://www.espn.com/soccer/league/_/name/esp.1",
              },
              {
                id: 4,
                title: "Bundesliga Weekend Preview",
                summary:
                  "A comprehensive look at the key fixtures and storylines for this weekend's Bundesliga matches.",
                source: "Sky Sports",
                published_at: new Date(
                  Date.now() - 1000 * 60 * 60 * 5,
                ).toISOString(),
                url: "https://www.skysports.com/bundesliga",
              },
            ];
          }),
        ]);

        console.log(
          "🏠 Home: Raw matches data:",
          matchesData.length,
          "matches",
        );

        // Transform the matches (no need to filter since API already filtered by date)
        const transformedMatches = matchesData.map((match) => ({
          id: match.match_id || match.id,
          date: match.match_info?.starting_at_timestamp
            ? new Date(
                match.match_info.starting_at_timestamp * 1000,
              ).toISOString()
            : match.match_info?.starting_at || match.date,
          home_team: match.teams?.home?.team_name || match.home_team,
          away_team: match.teams?.away?.team_name || match.away_team,
          home_logo: match.teams?.home?.logo || match.home_logo,
          away_logo: match.teams?.away?.logo || match.away_logo,
          status: getMatchStatus(match),
          score: match.score || { home: null, away: null },
          minute: match.minute || match.match_info?.minute || null,
          match_status: match.match_status,
          match_info: match.match_info, // Preserve match_info for proper timezone handling
          league_id: match.match_info?.league?.id || match.league_id,
          league_name: match.match_info?.league?.name || match.league_name,
        }));

        console.log("⚽ Home: Final transformed matches:", transformedMatches);

        setLiveMatches(transformedMatches);
        
        // If news API returned empty array, use fallback data
        if (!newsData || newsData.length === 0) {
          console.log("📰 Home: News API returned empty, using fallback data");
          setNews([
            {
              id: 1,
              title: "Premier League Transfer Window Updates",
              summary: "Latest transfer news and rumors from the Premier League as clubs prepare for the upcoming window.",
              source: "BBC Sport",
              published_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
              url: "https://www.bbc.com/sport/football/premier-league",
            },
            {
              id: 2,
              title: "Champions League Draw Results",
              summary: "The Champions League knockout stage draw has been completed with several exciting matchups confirmed.",
              source: "UEFA",
              published_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
              url: "https://www.uefa.com/uefachampionsleague/",
            },
            {
              id: 3,
              title: "La Liga Title Race Intensifies",
              summary: "With the season heating up, the battle for the La Liga title is becoming more competitive than ever.",
              source: "ESPN",
              published_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
              url: "https://www.espn.com/soccer/league/_/name/esp.1",
            },
            {
              id: 4,
              title: "Bundesliga Weekend Preview",
              summary: "A comprehensive look at the key fixtures and storylines for this weekend's Bundesliga matches.",
              source: "Sky Sports",
              published_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
              url: "https://www.skysports.com/bundesliga",
            },
          ]);
        } else {
          setNews(newsData);
        }
      } catch (error) {
        console.error("Error loading home data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadHomeData();
  }, [selectedDate, selectedLeague]); // Reload when date or league changes

  return (
    <div>
      <HeaderNav
        selectedDate={selectedDate}
        onDateSelect={handleDateChange}
        availableLeagues={availableLeagues}
        selectedLeague={selectedLeague}
        onLeagueSelect={handleLeagueChange}
      />
      <div className="home-content">
        <div className="home-intro">
          <p>
            Follow live football scores, fixtures and results from leagues
            around the world. Stay updated with real-time match events, team
            performances, and the latest football news.
          </p>
        </div>
        {/* Header Ad */}
        <AdSenseAd
          slot="5183171853"
          format="rectangle"
          className="adsense-header adsense-large-rectangle"
        />
        <PremiumBanner />

        {/* Live Scores Feed */}

        <div className="home-scorecard-title">
          <div className="home-scorecard-title-left">
            <div>
              <img src={football} alt="Football" />
              <h2>Featured Scores</h2>
            </div>
            <p>
              Live and upcoming matches from today’s football schedule across
              major leagues.
            </p>
          </div>

          <div className="home-scorecard-title-right">
            <a href="/fixtures">View all</a>
            <img src={arrow} alt="" />
          </div>
        </div>
        <div>
          {loading ? (
            <div className="loading-content">Loading live scores...</div>
          ) : (
            <LiveScoreCards matches={liveMatches.slice(0, 8)} />
          )}
        </div>

        {/* Another inline ad */}
        <AdSenseAd
          slot="8038180302"
          format="rectangle"
          className="adsense-inline adsense-medium-rectangle"
        />

        {/* News Feed */}
        <div className="home-news-title">
          <div className="home-news-title-left">
            <div>
              <img src={football} alt="Football" />
              <h2>Latest News</h2>
            </div>
            <p>
              Catch up with the latest football news, transfer updates, and
              match analysis from top leagues worldwide.
            </p>
          </div>

          <div className="home-news-title-right">
            <a href="/news">View all</a>
            <img src={arrow} alt="" />
          </div>
        </div>
        {loading ? (
          <div className="loading-content">Loading latest news...</div>
        <NewsCard
          articles={news}
          maxArticles={4}
          showViewMore={true}
          viewMorePath="/news"
        />

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

export default Home;
