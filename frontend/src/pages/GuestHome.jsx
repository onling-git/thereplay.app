import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Newspaper, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import TeamSearch from '../components/TeamSearch/TeamSearch';
import TeamSeasonStatistics from '../components/TeamSeasonStatistics/TeamSeasonStatistics';
import StandingsPositionCard from '../components/StandingsPositionCard/StandingsPositionCard';
import StandingsModal from '../components/StandingsModal/StandingsModal';
import CompetitionsCard from '../components/CompetitionsCard/CompetitionsCard';
import football from '../assets/images/football-icon.svg';
import './css/teamoverview.css';
import './css/guesthome.css';

const TEAM_NAME = 'Your Favourite FC';
const TEAM_ID = 'example-favourite';
const teamNames = ['Northbridge United', 'Riverside City', TEAM_NAME, 'Athletic Rovers', 'Kingsway Town', 'Harbour FC'];
const table = teamNames.map((name, index) => {
  const won = [8, 7, 6, 5, 4, 3][index];
  const drawn = 2;
  const goalsFor = [25, 23, 21, 19, 16, 13][index];
  const goalsAgainst = [9, 11, 12, 14, 17, 20][index];
  return {
    participant_id: name === TEAM_NAME ? TEAM_ID : `example-${index}`,
    team_name: name, team_image: football, position: index + 1,
    played: 10, won, drawn, lost: 10 - won - drawn,
    goals_for: goalsFor, goals_against: goalsAgainst,
    goal_difference: goalsFor - goalsAgainst, points: won * 3 + drawn,
    form: ['W', 'D', 'W', 'L', 'W'], trend: 'up',
  };
});
const standings = [{ _id: 'example-league', league_name: 'Example Premier League', season_name: 'Example season', table }];
const seasonStatistics = [{
  season_id: 'example-season', season: { name: 'Example season' },
  details: [
    { name: 'Goals', value: 21 },
    { name: 'Goals conceded', value: 12 },
    { name: 'Average possession', value: 54 },
    { name: 'Clean sheets', value: 4 },
    { name: 'Games played', value: 10 },
    { name: 'Team wins', value: 6 },
    { name: 'Team draws', value: 2 },
    { name: 'Team lost', value: 2 },
    { name: 'Shots on target', value: 52 },
  ],
}];
const competitions = [{ competition_id: 'example-cup', competition_name: 'Example National Cup', current_stage: 'Quarter-finals', is_still_participating: true }];
const recentMatches = [
  { opponent: 'Riverside City', date: '17 Oct', home: true, score: '2 - 1' },
  { opponent: 'Athletic Rovers', date: '10 Oct', home: false, score: '1 - 0' },
  { opponent: 'Harbour FC', date: '3 Oct', home: true, score: '3 - 0' },
];
const upcomingMatches = [
  { opponent: 'Kingsway Town', date: '31 Oct', home: true, time: '15:00' },
  { opponent: 'Northbridge United', date: '7 Nov', home: false, time: '17:30' },
  { opponent: 'Harbour FC', date: '14 Nov', home: true, time: '15:00' },
];
const stories = [
  { title: 'A late winner sends the home crowd wild', category: 'Match report', body: 'Your Favourite FC came from behind to beat Riverside City 2-1. A last-minute finish sealed the points after an energetic second-half performance.' },
  { title: 'All eyes on the trip to Arsenal', category: 'Match preview', body: 'The manager has a full squad available for the example fixture at Arsenal. The midfield battle could decide a closely contested afternoon.' },
  { title: 'Academy graduate signs a new deal', category: 'Club news', body: 'Young midfielder Alex Morgan has agreed a new contract after an impressive run in the first team.' },
];

function ExampleFixtures({ title, matches }) {
  return (
    <section className="card dashboard-card">
      <div className="dashboard-card-header"><h2 className="accent-heading">{title}</h2></div>
      <ul className="preview-fixtures">
        {matches.map((match) => (
          <li key={match.opponent}>
            <div className="preview-fixture-date"><strong>{match.score ? 'FT' : match.time}</strong><span>{match.date}</span></div>
            <div className="preview-fixture-teams">
              <span><img src={football} alt="" />{match.home ? TEAM_NAME : match.opponent}</span>
              <span><img src={football} alt="" />{match.home ? match.opponent : TEAM_NAME}</span>
            </div>
            <strong className="preview-fixture-score">{match.score || (match.home ? 'Home' : 'Away')}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function GuestHome() {
  const { isAuthenticated } = useAuth();
  const [tableOpen, setTableOpen] = useState(false);
  const tableButton = useRef(null);

  const closeTable = () => {
    setTableOpen(false);
    tableButton.current?.focus();
  };

  useEffect(() => {
    if (!tableOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setTableOpen(false);
        tableButton.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [tableOpen]);

  return (
    <div className="team-overview guest-home">
      <section className="preview-intro" aria-labelledby="preview-intro-title">
        <div>
          <h2 id="preview-intro-title">Your club. Every match. One place.</h2>
          <p>Follow your team with live match updates, reports, news, fan reactions and the season at a glance.</p>
          <p className="preview-label">Example hub. All fixtures, results and stories below are made up.</p>
        </div>
        <div className="preview-team-search">
          <span><Search size={18} aria-hidden="true" /> Find your team</span>
          <TeamSearch />
          {isAuthenticated && <Link to="/account/team-preferences" className="card-link">Choose your favourite</Link>}
        </div>
      </section>

      <div className="team-overview-header">
        <div className="team-overview-header-left">
          <div className="team-badge-box preview-badge"><img src={football} alt="Your Favourite FC example badge" /><span>YFFC</span></div>
          <div className="team-overview-header-title">
            <h1>{TEAM_NAME}</h1>
            <ul><li>Example Premier League</li><li>The Home Ground</li><li className="league-position">3rd</li></ul>
          </div>
        </div>
      </div>

      <nav className="team-overview-tabs" aria-label="Example hub sections">
        <ul>
          <li><a href="#example-matches">Matches</a></li>
          <li><a href="#example-news">News</a></li>
          <li><a href="#example-community">Community</a></li>
          <li><Link to="/fixtures">Real fixtures</Link></li>
        </ul>
      </nav>

      <section className="team-overview-body">
        <div className="team-overview-grid">
          <div className="team-overview-body-left" id="example-matches">
            <section className="card next-match">
              <div className="next-match-header"><h2 className="accent-heading">Next Match</h2><span className="preview-label">Example fixture</span></div>
              <div className="preview-next-match">
                <div><img src={football} alt="" /><strong>Arsenal</strong></div>
                <div className="preview-kickoff"><strong>15:00</strong><span>Sat 24 Oct</span><span>Example fixture</span></div>
                <div><img src={football} alt="" /><strong>{TEAM_NAME}</strong></div>
              </div>
              <p className="preview-match-venue">Emirates Stadium</p>
            </section>
            <div className="dashboard-grid">
              <ExampleFixtures title="Recent Matches" matches={recentMatches} />
              <ExampleFixtures title="Upcoming Matches" matches={upcomingMatches} />
              <section className="card dashboard-card">
                <div className="dashboard-card-header"><h2 className="accent-heading">Fan Reactions</h2><span className="preview-label">Sample posts</span></div>
                <ul className="preview-reactions">
                  <li><strong>@HomeEndFan</strong><p>What a finish! Never count this team out.</p><span>Riverside City match</span></li>
                  <li><strong>@TerraceTalk</strong><p>That midfield partnership is getting better every week.</p><span>Riverside City match</span></li>
                </ul>
              </section>
            </div>
            <section className="card dashboard-card" id="example-news">
              <div className="dashboard-card-header"><h2 className="accent-heading"><Newspaper size={18} aria-hidden="true" /> Latest News</h2><Link to="/news" className="card-link">Real news</Link></div>
              <div className="preview-stories">
                {stories.map((story) => <details key={story.title}><summary><span>{story.category} / Example</span><strong>{story.title}</strong></summary><p>{story.body}</p></details>)}
              </div>
            </section>
          </div>

          <div className="team-overview-body-right">
            <TeamSeasonStatistics seasonStatistics={seasonStatistics} loading={false} error={false} teamStanding={table[2]} />
            <section className="card dashboard-card">
              <div className="standings-card-header"><h2 className="accent-heading">Example Premier League</h2><button ref={tableButton} type="button" className="card-link preview-text-button" onClick={() => setTableOpen(true)}>Full table</button></div>
              <StandingsPositionCard standings={standings} teamId={TEAM_ID} teamName={TEAM_NAME} teamImage={football} />
            </section>
            <section className="card dashboard-card">
              <div className="dashboard-card-header"><h2 className="accent-heading">Other Competitions</h2></div>
              <CompetitionsCard competitions={competitions} teamName={TEAM_NAME} />
            </section>
            <section className="card dashboard-card" id="example-community">
              <div className="dashboard-card-header"><h2 className="accent-heading"><MessageCircle size={18} aria-hidden="true" /> Community</h2></div>
              <div className="preview-stories">
                <details><summary><span>Example discussion / 2 replies</span><strong>Who starts in midfield on Saturday?</strong></summary><p><strong>HomeEndFan:</strong> Keep the same three after that second-half performance.</p><p><strong>TerraceTalk:</strong> Agreed. Their pressing made the difference.</p></details>
                <details><summary><span>Example discussion / 1 reply</span><strong>Your player of the match?</strong></summary><p><strong>MatchdayRegular:</strong> Our keeper. That save at 1-1 was just as important as the winner.</p></details>
              </div>
            </section>
          </div>
        </div>
      </section>
      {tableOpen && <div role="dialog" aria-modal="true" aria-label="Example league table"><StandingsModal isOpen onClose={closeTable} standings={standings} currentTeamId={TEAM_ID} /></div>}
    </div>
  );
}