import { getTeamPreferences, updateTeamPreferences } from '../api/auth';

const PENDING_KEY = 'pending-team-hub-preference';

function validateChoice(teamId, action) {
  if (!Number.isSafeInteger(Number(teamId)) || Number(teamId) <= 0 || !['favourite', 'follow'].includes(action)) {
    throw new Error('Invalid team selection');
  }
}

export function queueTeamPreference(teamId, action) {
  validateChoice(teamId, action);
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ teamId: Number(teamId), action }));
}

export function clearPendingTeamPreference() {
  sessionStorage.removeItem(PENDING_KEY);
}

export async function saveTeamHubPreference(teamId, action) {
  validateChoice(teamId, action);
  const response = await getTeamPreferences();
  const preferences = response?.data?.team_preferences;
  if (!preferences) throw new Error('Unable to load your team preferences');

  const followedTeams = preferences.followed_teams || [];
  const isCurrentFavourite = String(preferences.favourite_team) === String(teamId);
  const alreadyFollowing = followedTeams.some((id) => String(id) === String(teamId));

  if ((action === 'favourite' && preferences.favourite_team) ||
      (action === 'follow' && (isCurrentFavourite || alreadyFollowing))) {
    return preferences;
  }

  const update = action === 'favourite'
    ? { favourite_team: Number(teamId) }
    : { followed_teams: [...followedTeams, Number(teamId)] };
  const result = await updateTeamPreferences(update);
  if (!result?.data?.user) throw new Error('Unable to save your team preferences');
  return { ...preferences, ...result.data.user };
}

export async function applyPendingTeamPreference(user) {
  const stored = sessionStorage.getItem(PENDING_KEY);
  if (!stored) return user;

  let choice;
  try {
    choice = JSON.parse(stored);
    validateChoice(choice?.teamId, choice?.action);
  } catch {
    clearPendingTeamPreference();
    return user;
  }

  const preferences = await saveTeamHubPreference(choice.teamId, choice.action);
  if (sessionStorage.getItem(PENDING_KEY) === stored) clearPendingTeamPreference();
  return { ...user, ...preferences };
}