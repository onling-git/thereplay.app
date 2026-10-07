import { useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AuthModal from '../Auth/AuthModal';
import { clearPendingTeamPreference, queueTeamPreference } from '../../utils/teamHubPreferences';

export default function TeamPreferenceButtons({ team }) {
  const { user, isAuthenticated, loading, selectTeamPreference, teamPreferenceError } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);

  const hasFavourite = Boolean(user?.favourite_team);
  const isFavourite = String(user?.favourite_team) === String(team?.id);
  const isFollowing = (user?.followed_teams || []).some((id) => String(id) === String(team?.id));
  const showFavourite = !isAuthenticated || !hasFavourite;
  const showFollow = !isAuthenticated || (!isFavourite && !isFollowing);

  const chooseTeam = async (action) => {
    if (loading || !team?.id || inFlight.current) return;
    setError(null);
    try {
      if (!isAuthenticated) {
        queueTeamPreference(team.id, action);
        setModalOpen(true);
        return;
      }
      inFlight.current = true;
      setSaving(action);
      await selectTeamPreference(team.id, action);
    } catch {
      setError('Unable to save your team selection. Please try again.');
    } finally {
      inFlight.current = false;
      setSaving(null);
    }
  };

  const closeModal = () => {
    if (!isAuthenticated) clearPendingTeamPreference();
    setModalOpen(false);
  };

  return (
    <>
      {showFavourite && <button type="button" className="btn" disabled={loading || !team?.id || Boolean(saving)} onClick={() => chooseTeam('favourite')}>{saving === 'favourite' ? 'Saving...' : 'Favourite team'}</button>}
      {showFollow && <button type="button" className="btn-secondary" disabled={loading || !team?.id || Boolean(saving)} onClick={() => chooseTeam('follow')}>{saving === 'follow' ? 'Saving...' : 'Follow team'}</button>}
      {(error || teamPreferenceError) && <span role="alert">{error || teamPreferenceError}</span>}
      <AuthModal isOpen={modalOpen && !isAuthenticated} onClose={closeModal} initialMode="register" onboardingAfterRegister={false} />
    </>
  );
}