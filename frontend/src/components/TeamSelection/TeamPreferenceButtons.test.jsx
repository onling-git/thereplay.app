import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '../../contexts/AuthContext';
import TeamPreferenceButtons from './TeamPreferenceButtons';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../Auth/AuthModal', () => ({ isOpen, onClose }) => isOpen ? <div role="dialog" aria-label="Sign up or sign in"><button onClick={onClose}>Cancel</button></div> : null);

const team = { id: 65, name: 'Southampton' };
const selectTeamPreference = jest.fn();

beforeEach(() => {
  sessionStorage.clear();
  selectTeamPreference.mockReset().mockResolvedValue(undefined);
  useAuth.mockReturnValue({ user: { favourite_team: null, followed_teams: [] }, isAuthenticated: true, loading: false, selectTeamPreference });
});

test('preserves button styles and saves the selected team', async () => {
  render(<TeamPreferenceButtons team={team} />);
  expect(screen.getByRole('button', { name: 'Favourite team' })).toHaveClass('btn');
  expect(screen.getByRole('button', { name: 'Follow team' })).toHaveClass('btn-secondary');
  fireEvent.click(screen.getByRole('button', { name: 'Favourite team' }));
  await waitFor(() => expect(selectTeamPreference).toHaveBeenCalledWith(65, 'favourite'));
});

test('hides the favourite button on every hub once any favourite is selected', () => {
  useAuth.mockReturnValue({ user: { favourite_team: 19, followed_teams: [] }, isAuthenticated: true });
  render(<TeamPreferenceButtons team={team} />);
  expect(screen.queryByRole('button', { name: 'Favourite team' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Follow team' })).toBeInTheDocument();
});

test.each([{ favourite_team: '65', followed_teams: [] }, { favourite_team: 19, followed_teams: ['65'] }])('hides follow for a favourite or followed team: %p', (user) => {
  useAuth.mockReturnValue({ user, isAuthenticated: true });
  render(<TeamPreferenceButtons team={team} />);
  expect(screen.queryByRole('button', { name: 'Follow team' })).not.toBeInTheDocument();
});

test.each(['Favourite team', 'Follow team'])('queues a guest choice and opens signup/login: %s', (buttonName) => {
  useAuth.mockReturnValue({ isAuthenticated: false, loading: false });
  render(<TeamPreferenceButtons team={team} />);
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
  expect(screen.getByRole('dialog', { name: 'Sign up or sign in' })).toBeInTheDocument();
  expect(JSON.parse(sessionStorage.getItem('pending-team-hub-preference'))).toEqual({ teamId: 65, action: buttonName === 'Favourite team' ? 'favourite' : 'follow' });
  expect(selectTeamPreference).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(sessionStorage.length).toBe(0);
});

test('keeps selection available and reports failed saves', async () => {
  selectTeamPreference.mockRejectedValue(new Error('Unavailable'));
  render(<TeamPreferenceButtons team={team} />);
  fireEvent.click(screen.getByRole('button', { name: 'Follow team' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save');
  expect(screen.getByRole('button', { name: 'Follow team' })).toBeEnabled();
});