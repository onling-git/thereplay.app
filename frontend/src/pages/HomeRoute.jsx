import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFavoriteTeam } from '../hooks/useFavoriteTeam';
import GuestHome from './GuestHome';

export default function HomeRoute() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { favoriteTeam, loading, error } = useFavoriteTeam();

  if (authLoading || (isAuthenticated && user?.favourite_team &&
      (loading || (!favoriteTeam && !error)))) {
    return <p role="status">Loading your home...</p>;
  }

  if (isAuthenticated && favoriteTeam?.slug && !error) {
    return <Navigate to={`/${favoriteTeam.slug}`} replace />;
  }

  return <GuestHome />;
}