// src/hooks/useTeamMatchInfo.js
import { useState, useEffect } from 'react';
import { getTeamWithCurrentMatches, getTeamSnapshot } from '../api';

/**
 * Custom hook to get team data with current match information
 * @param {string} teamSlug - The team slug to fetch data for
 * @param {boolean} preferCurrent - Whether to prefer current dynamic data (default: true)
 * @returns {Object} - { team, loading, error, usingCurrentData, refetch }
 */
export function useTeamMatchInfo(teamSlug, preferCurrent = true) {
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingCurrentData, setUsingCurrentData] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!teamSlug) return;
      
      setLoading(true);
      setError(null);

      try {
        if (preferCurrent) {
          // Try the new dynamic API first
          try {
            const data = await getTeamWithCurrentMatches(teamSlug);
            setTeam(data);
            setUsingCurrentData(true);
            return;
          } catch (currentErr) {
            console.warn('[useTeamMatchInfo] Failed to get current matches, falling back to snapshot:', currentErr);
            // Fall through to snapshot API
          }
        }

        // Use the snapshot API
        const data = await getTeamSnapshot(teamSlug);
        setTeam(data);
        setUsingCurrentData(false);

      } catch (err) {
        setError(err.body || err.message || 'Failed to fetch team data');
        setTeam(null);
        setUsingCurrentData(false);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamSlug, preferCurrent]);

  const refetch = async () => {
    if (!teamSlug) return;
    
    setLoading(true);
    setError(null);

    try {
      if (preferCurrent) {
        // Try the new dynamic API first
        try {
          const data = await getTeamWithCurrentMatches(teamSlug);
          setTeam(data);
          setUsingCurrentData(true);
          return;
        } catch (currentErr) {
          console.warn('[useTeamMatchInfo] Failed to get current matches, falling back to snapshot:', currentErr);
          // Fall through to snapshot API
        }
      }

      // Use the snapshot API
      const data = await getTeamSnapshot(teamSlug);
      setTeam(data);
      setUsingCurrentData(false);

    } catch (err) {
      setError(err.body || err.message || 'Failed to fetch team data');
      setTeam(null);
      setUsingCurrentData(false);
    } finally {
      setLoading(false);
    }
  };

  return {
    team,
    loading,
    error,
    usingCurrentData,
    refetch
  };
}

/**
 * Hook to get just the current match info for a team (lighter weight)
 * Now uses match IDs and fetches actual match data
 * @param {string} teamSlug - The team slug
 * @returns {Object} - { lastMatch, nextMatch, loading, error, refetch }
 */
export function useCurrentMatches(teamSlug) {
  const { team, loading: teamLoading, error: teamError, refetch: refetchTeam } = useTeamMatchInfo(teamSlug, true);
  const [matchData, setMatchData] = useState({ lastMatch: null, nextMatch: null });
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState(null);

  useEffect(() => {
    const fetchMatches = async () => {
      if (!team || teamLoading) return;
      
      // If we have the legacy match_info data, use it
      if (team.last_match_info || team.next_match_info) {
        setMatchData({
          lastMatch: team.last_match_info || null,
          nextMatch: team.next_match_info || null
        });
        return;
      }

      // Otherwise, fetch matches by ID
      if (!team.last_match && !team.next_match) {
        setMatchData({ lastMatch: null, nextMatch: null });
        return;
      }

      setMatchLoading(true);
      setMatchError(null);

      try {
        const { getMatchById } = await import('../api');
        const promises = [];
        
        // Fetch last match if ID exists
        if (team.last_match) {
          promises.push(
            getMatchById(team.last_match)
              .then(match => ({ type: 'last', match }))
              .catch(err => ({ type: 'last', error: err }))
          );
        }
        
        // Fetch next match if ID exists
        if (team.next_match) {
          promises.push(
            getMatchById(team.next_match)
              .then(match => ({ type: 'next', match }))
              .catch(err => ({ type: 'next', error: err }))
          );
        }

        const results = await Promise.allSettled(promises);
        
        const newMatchData = { lastMatch: null, nextMatch: null };
        
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            const { type, match, error } = result.value;
            if (!error && match) {
              // Transform match data to match the expected format
              const transformedMatch = transformMatchToMatchInfo(match, teamSlug);
              newMatchData[type === 'last' ? 'lastMatch' : 'nextMatch'] = transformedMatch;
            }
          }
        });
        
        setMatchData(newMatchData);
        
      } catch (err) {
        setMatchError(err.message || 'Failed to fetch match data');
        console.error('Error fetching team matches:', err);
      } finally {
        setMatchLoading(false);
      }
    };

    fetchMatches();
  }, [team, teamLoading, teamSlug]);

  const refetch = async () => {
    await refetchTeam();
    // The useEffect above will automatically refetch matches when team data changes
  };

  return {
    lastMatch: matchData.lastMatch,
    nextMatch: matchData.nextMatch,
    loading: teamLoading || matchLoading,
    error: teamError || matchError,
    refetch
  };
}

/**
 * Transform full match data to match the expected match_info format
 */
function transformMatchToMatchInfo(match, teamSlug) {
  if (!match) return null;

  // More comprehensive team detection
  const homeTeam = match.teams?.home || { 
    team_name: match.home_team || 'Home Team',
    team_slug: match.home_team_slug || null
  };
  const awayTeam = match.teams?.away || { 
    team_name: match.away_team || 'Away Team',
    team_slug: match.away_team_slug || null
  };

  // Check multiple ways to identify if this is the home team
  const isHome = 
    homeTeam.team_slug === teamSlug ||
    match.home_team_slug === teamSlug ||
    (homeTeam.team_name && homeTeam.team_name.toLowerCase().replace(/\s+/g, '-') === teamSlug) ||
    (match.home_team && match.home_team.toLowerCase().replace(/\s+/g, '-') === teamSlug);
  
  const opponentTeam = isHome ? awayTeam : homeTeam;
  const homeScore = match.score?.home ?? 0;
  const awayScore = match.score?.away ?? 0;
  
  const goalsFor = isHome ? homeScore : awayScore;
  const goalsAgainst = isHome ? awayScore : homeScore;
  
  // Determine win/loss/draw for finished matches
  let win = null;
  const isFinished = ['FT', 'finished', 'ended', 'full-time'].includes(
    (match.match_status?.state || match.match_status?.developer_name || '').toLowerCase()
  );
  
  if (isFinished) {
    if (goalsFor > goalsAgainst) win = true;
    else if (goalsFor < goalsAgainst) win = false;
    else win = null; // draw
  }

  return {
    match_id: match.match_id,
    date: match.match_info?.starting_at || match.date,
    opponent_name: opponentTeam.team_name || opponentTeam.name || 'Unknown Opponent',
    opponent_slug: opponentTeam.team_slug || null,
    home_game: isHome,
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    win: win,
    status: match.match_status?.state || match.match_status?.developer_name || 'unknown',
    league: match.match_info?.league || null,
    venue: match.match_info?.venue || null,
    // Include full match data for advanced use cases
    _fullMatch: match
  };
}