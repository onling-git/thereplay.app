import { useState } from 'react';
import { ArrowUp, Heart, MessageCircle, Repeat2, Trophy } from 'lucide-react';
import AuthModal from '../components/Auth/AuthModal';
import football from '../assets/images/football-icon.svg';
import news from '../assets/images/newspaper-regular-full.svg';
import './css/guesthome.css';

const badge = (id) => `https://cdn.sportmonks.com/images/soccer/teams/${id % 32}/${id}.png`;
const clubs = [
  { id: 8, name: 'Liverpool' },
  { id: 9, name: 'Manchester City' },
  { id: 'your-club', name: 'Your Club' },
  { id: 18, name: 'Chelsea' },
  { id: 20, name: 'Newcastle United' },
  { id: 15, name: 'Aston Villa' },
];
const team = clubs[2];
const clubBadge = (club) => club.id === team.id ? football : badge(club.id);
const table = clubs.map((club, index) => {
  const won = [8, 7, 6, 5, 4, 3][index];
  const goalsFor = [25, 23, 21, 19, 16, 13][index];
  const goalsAgainst = [9, 11, 12, 14, 17, 20][index];
  return {
    participant_id: club.id, team_name: club.name, team_image: clubBadge(club),
    position: index + 1, played: 10, won, drawn: 2, lost: 8 - won,
    goals_for: goalsFor, goals_against: goalsAgainst,
    goal_difference: goalsFor - goalsAgainst, points: won * 3 + 2,
    form: ['W', 'D', 'W', 'L', 'W'], trend: 'up',
  };
});
const statistics = [
  { label: 'Goals Scored', value: 21 },
  { label: 'Goals Conceded', value: 12 },
  { label: 'Average Possession', value: '54%' },
  { label: 'Clean Sheets', value: 4 },
];
const competitions = [
  { competition_id: 'fa-cup', competition_name: 'FA Cup', current_stage: 'Third round', is_still_participating: true },
  { competition_id: 'league-cup', competition_name: 'Carabao Cup', current_stage: 'Fourth round', is_still_participating: true },
];

function fixture(opponent, date, home, round, score) {
  return {
    match_id: `preview-${round}`, team_name: team.name, team_logo: football,
    opponent_name: opponent.name, opponent_logo: badge(opponent.id),
    opponent_slug: opponent.name.toLowerCase().replaceAll(' ', '-'),
    date, home_game: home, status: score ? 'FT' : 'upcoming',
    score: score ? { home: score[0], away: score[1] } : undefined,
    venue: { city_name: home ? 'Home ground' : opponent.name },
    league: { name: 'Premier League' },
    _fullMatch: { match_info: { round: { name: round } } },
  };
}
const nextMatch = fixture(clubs[3], '2026-10-24T14:00:00Z', true, 11);
const recentMatches = [
  fixture(clubs[4], '2026-10-17T14:00:00Z', true, 10, [2, 1]),
  fixture(clubs[5], '2026-10-10T16:30:00Z', false, 9, [0, 1]),
  fixture(clubs[1], '2026-10-03T14:00:00Z', true, 8, [1, 1]),
];
const upcomingMatches = [
  fixture(clubs[0], '2026-10-31T17:30:00Z', false, 12),
  fixture(clubs[5], '2026-11-07T15:00:00Z', true, 13),
  fixture(clubs[4], '2026-11-14T15:00:00Z', false, 14),
];
const stories = [
  { id: 'late-winner', source: 'Match report', title: 'Your Club leave it late to edge Newcastle at home', summary: 'A patient second-half display and a decisive finish secure three points in front of a roaring home crowd.' },
  { id: 'chelsea-preview', source: 'Match preview', title: 'Your Club v Chelsea: the midfield battle that could decide it', summary: 'Pressing, quick transitions and control of the middle third take centre stage ahead of a big afternoon.' },
  { id: 'training', source: 'Club news', title: 'Inside training: sharp finishing and a focus on the next challenge', summary: 'The squad turn their attention to Chelsea, with combinations in the final third high on the agenda.' },
].map((story) => ({ ...story, url: '#news', published_at: '2026-10-18T12:00:00Z', image_url: football }));
const reactions = [
  { name: 'Home End Notes', handle: 'HomeEndNotes', initials: 'HE', text: 'That noise when the winner went in. Nothing beats a late goal at home. Kept believing right to the end.', replies: 18, reposts: 42, likes: 386, time: '12m' },
  { name: 'Terrace Talk', handle: 'TerraceTalk', initials: 'TT', text: 'The midfield won us that game. Every second ball, every recovery. More of that against Chelsea please.', replies: 9, reposts: 27, likes: 214, time: '28m' },
  { name: 'Away Day Regular', handle: 'AwayDayRegular', initials: 'AD', text: 'Credit to Newcastle, they made us work for it. Our bench changed the tempo just when we needed it. Huge three points.', replies: 24, reposts: 31, likes: 298, time: '45m' },
];
const discussions = [
  { title: 'Same midfield for the Chelsea game?', body: 'The balance looked spot on after the break. Would you keep the same three for Saturday or bring in fresh legs?', author: 'MatchdayRegular', comments: 24 },
  { title: 'Who was your player of the match against Newcastle?', body: 'The winner will get the headlines, but that recovery tackle at 1-1 was the turning point for me.', author: 'HomeEndVoice', comments: 38 },
  { title: 'Away end roll call: Liverpool', body: 'Early train booked. Who else is making the trip up to Anfield? Should be a brilliant away day.', author: 'AwayDays', comments: 16 },
];

function FixtureTeams({ match, onLogin }) {
  const sides = [
    { name: team.name, image: football },
    { name: match.opponent_name, image: match.opponent_logo },
  ];
  if (!match.home_game) sides.reverse();
  return sides.map((side) => (
    <div className="gh-fixture-team" key={side.name}>
      <img src={side.image} alt={side.name} />
      <button type="button" className="gh-link" onClick={onLogin}>{side.name}</button>
    </div>
  ));
}

export default function GuestHome() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const promptLogin = (event) => {
    event?.preventDefault();
    setShowAuthModal(true);
  };
  const action = (label) => <button type="button" className="gh-report-links link" onClick={promptLogin}>{label}</button>;
  const formatDate = (date) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const formatTime = (date) => new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <div className="guest-home">
        <section className="gh-intro" aria-labelledby="preview-intro-title">
          <div>
            <h2 id="preview-intro-title" className="gh-intro-title">Your club. Every match. One place.</h2>
            <p className="gh-intro-copy">Follow your team with live match updates, reports, news, fan reactions and the season at a glance.</p>
            <p className="gh-preview-label">Static preview with illustrative scores, stories and supporter posts. Sign in to follow your club.</p>
          </div>
        </section>

        <header className="gh-header">
          <div className="gh-identity">
            <div className="gh-badge"><img src={football} alt="Your Club badge" /></div>
            <div><h1 className="gh-title">Your Club</h1><ul className="gh-team-meta"><li>Premier League</li><li>·</li><li>Your home ground</li><li>·</li><li className="gh-position">3rd</li></ul></div>
          </div>
          <button type="button" className="gh-primary-button" onClick={promptLogin}>Choose your club</button>
        </header>

        <nav className="gh-tabs" aria-label="Hub sections">
          {['My Matches', 'Fixtures', 'News', 'Community'].map((label) => <button className="gh-link" type="button" key={label} onClick={promptLogin}>{label}</button>)}
        </nav>

        <div className="gh-grid">
          <div className="gh-column">
            <section className="gh-card gh-next-match">
              <div className="gh-card-header"><h2 className="gh-heading">Next Match</h2><span className="gh-kickoff">Sat 24 Oct</span></div>
              <div className="gh-match-teams">
                <div className="gh-match-side"><div className="gh-match-badge"><img src={football} alt={team.name} /></div><button type="button" className="gh-link" onClick={promptLogin}>{team.name}</button></div>
                <div className="gh-match-time"><strong>{formatTime(nextMatch.date)}</strong><span>{formatDate(nextMatch.date)}</span></div>
                <div className="gh-match-side"><div className="gh-match-badge gh-away-badge"><img src={nextMatch.opponent_logo} alt={nextMatch.opponent_name} /></div><button type="button" className="gh-link" onClick={promptLogin}>{nextMatch.opponent_name}</button></div>
              </div>
              <div className="gh-match-footer"><p>Home · Premier League · Matchweek 11</p>{action('Live updates')}</div>
            </section>

            {[{ title: 'Recent Matches', matches: recentMatches }, { title: 'Upcoming Matches', matches: upcomingMatches }].map(({ title, matches }) => (
              <section className="gh-card" key={title}>
                <div className="gh-card-header"><h2 className="gh-heading">{title}</h2>{action('See All →')}</div>
                {matches.map((match) => (
                  <div className="gh-fixture" key={match.match_id}>
                    <div className="gh-fixture-date"><strong>{match.score ? 'FT' : formatTime(match.date)}</strong><span>{formatDate(match.date)}</span></div>
                    <div className="gh-fixture-teams"><FixtureTeams match={match} onLogin={promptLogin} /></div>
                    <div className="gh-fixture-actions">{action('Live updates')}{match.score && action('Match report')}</div>
                  </div>
                ))}
              </section>
            ))}

            <section className="gh-card">
              <div className="gh-card-header"><h2 className="gh-heading"><span aria-hidden="true">𝕏</span> Fan Reactions</h2>{action('See All →')}</div>
              <div className="gh-reactions">
                {reactions.map((reaction) => (
                  <article className="gh-reaction" key={reaction.handle}>
                    <div className="gh-avatar" aria-hidden="true">{reaction.initials}</div>
                    <div className="gh-reaction-content">
                      <strong className="gh-author">{reaction.name}</strong><span className="gh-handle">@{reaction.handle}</span>
                      <p className="gh-reaction-text">{reaction.text}</p>
                      <div className="gh-engagement">
                        <span><MessageCircle aria-label="Replies" />{reaction.replies}</span>
                        <span><Repeat2 aria-label="Reposts" />{reaction.reposts}</span>
                        <span><Heart aria-label="Likes" />{reaction.likes}</span>
                      </div>
                    </div>
                    <div className="gh-reaction-aside"><span>{reaction.time}</span>{action('View on X')}</div>
                  </article>
                ))}
              </div>
            </section>

            <section className="gh-card gh-news">
              <div className="gh-card-header"><h2 className="gh-heading"><img src={news} alt="" />Latest News</h2>{action('View all →')}</div>
              <div className="gh-news-feed">
                {stories.map((story) => (
                  <div className="gh-story" key={story.id}>
                    <div className="gh-story-image"><img src={story.image_url} alt="" loading="lazy" /></div>
                    <div className="gh-story-content"><div className="gh-story-meta">{story.source} · {formatDate(story.published_at)}</div><a className="gh-story-title" href={story.url} onClick={promptLogin}>{story.title}</a><p className="gh-story-summary">{story.summary.slice(0, 100)}...</p></div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="gh-column">
            <section className="gh-card">
              <div className="gh-card-header"><h2 className="gh-heading">Season Statistics</h2>{action('View all →')}</div>
              <div className="gh-stat-grid">{statistics.map((stat) => <div className="gh-stat" key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>
            </section>
            <section className="gh-card">
              <div className="gh-card-header"><h2 className="gh-heading">Premier League</h2>{action('Full Table →')}</div>
              <div className="gh-standing-summary">
                <div className="gh-match-badge"><img src={football} alt={team.name} /></div>
                <div className="gh-form">{table[2].form.map((result, index) => <span className={`gh-form-${result.toLowerCase()}`} key={index}>{result}</span>)}</div>
                <ArrowUp className="gh-trend" aria-label="Moving up" />
              </div>
              <table className="gh-table">
                <thead><tr>{['#', 'Team', 'P', 'GD', 'Pts'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
                <tbody>{table.slice(1, 4).map((entry) => <tr key={entry.participant_id} className={entry.participant_id === team.id ? 'gh-current-team' : undefined}><td>{entry.position}</td><td><div className="gh-table-team"><img src={entry.team_image} alt="" /><span>{entry.team_name}</span></div></td><td>{entry.played}</td><td>+{entry.goal_difference}</td><td><strong>{entry.points}</strong></td></tr>)}</tbody>
              </table>
            </section>
            <section className="gh-card">
              <div className="gh-card-header"><h2 className="gh-heading">Other Competitions</h2></div>
              {competitions.map((competition) => <div className="gh-competition" key={competition.competition_id}><Trophy aria-hidden="true" /><div><strong>{competition.competition_name}</strong><span>{competition.current_stage}</span></div></div>)}
            </section>
            <section className="gh-card gh-community">
              <div className="gh-card-header"><h2 className="gh-heading">Community</h2>{action('Open HUB →')}</div>
              <p className="gh-community-welcome">Welcome to the community section for Your Club.</p>
              <div className="gh-community-content">
                {discussions.map((discussion) => (
                  <article className="gh-discussion" key={discussion.title}>
                    <h3 className="gh-discussion-title"><button type="button" className="gh-link" onClick={promptLogin}>{discussion.title}</button></h3>
                    <p className="gh-discussion-snippet">{discussion.body}</p>
                    <div className="gh-discussion-meta">{discussion.author} · 18 Oct · {discussion.comments} comments</div>
                  </article>
                ))}
              </div>
              <button type="button" className="gh-primary-button gh-new-post" onClick={promptLogin}>New Post</button>
            </section>
          </div>
        </div>
      </div>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} initialMode="login" />
    </>
  );
}
