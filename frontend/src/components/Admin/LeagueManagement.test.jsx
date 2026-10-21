import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeagueManagement from './LeagueManagement';
import * as api from '../../api/adminApi';

jest.mock('../../api/adminApi', () => ({
  getLeagues: jest.fn(), getCountries: jest.fn(), getLeagueStats: jest.fn(),
  updateLeague: jest.fn(), updateCountry: jest.fn(), bulkUpdateLeagues: jest.fn(),
  getCoverageStatus: jest.fn(), refreshCoverageCatalogue: jest.fn()
}));

beforeEach(() => {
  jest.clearAllMocks();
  api.getLeagues.mockResolvedValue([
    { id: 8, name: 'Premier League', country_id: 462, coverage_role: 'league', enabled: true, available: true, reports_enabled: true, effective_status: 'Enabled and available' },
    { id: 2, name: 'Champions League', country_id: 41, coverage_role: 'competition', enabled: false, available: true, reports_enabled: false, effective_status: 'Disabled by admin' }
  ]);
  api.getCountries.mockResolvedValue([{ id: 462, name: 'England', enabled: true, leagues_total: 1 }]);
  api.getLeagueStats.mockResolvedValue({ leagues: { enabled: 1, total: 2 }, countries: { enabled: 1, total: 1 } });
  api.getCoverageStatus.mockResolvedValue({ config: { initialized: true }, coverage: { teamIds: [1, 2] } });
  api.refreshCoverageCatalogue.mockResolvedValue({ ok: true });
  api.updateLeague.mockResolvedValue({});
  api.updateCountry.mockResolvedValue({});
});

test('displays effective state and separates public club leagues from competitions and reports', async () => {
  render(<LeagueManagement />);
  expect(await screen.findByText('Enabled and available')).toBeInTheDocument();
  expect(screen.getByText(/2 public clubs/)).toBeInTheDocument();
  expect(screen.getByLabelText('Coverage role for Premier League')).toHaveValue('league');
  expect(screen.getByLabelText('Coverage role for Champions League')).toHaveValue('competition');
  expect(screen.getByLabelText('AI reports for Premier League')).toBeChecked();
});

test('refresh discovers provider changes without automatically enabling them', async () => {
  render(<LeagueManagement />);
  fireEvent.click(await screen.findByText('Refresh from Sportmonks'));
  await waitFor(() => expect(api.refreshCoverageCatalogue).toHaveBeenCalledWith(false));
  expect(api.updateLeague).not.toHaveBeenCalled();
});

test('country switch and competition report switch persist distinct settings', async () => {
  render(<LeagueManagement />);
  fireEvent.click(await screen.findByLabelText('AI reports for Champions League'));
  await waitFor(() => expect(api.updateLeague).toHaveBeenCalledWith(2, { reports_enabled: true }));
  await screen.findByText('Coverage settings updated');
  fireEvent.click(screen.getByLabelText('England'));
  await waitFor(() => expect(api.updateCountry).toHaveBeenCalledWith(462, { enabled: false }));
});

test('uninitialized setup offers explicit one-time five-league launch configuration', async () => {
  api.getCoverageStatus.mockResolvedValue({ config: null, coverage: null });
  render(<LeagueManagement />);
  fireEvent.click(await screen.findByText('Initialize five-league launch coverage'));
  await waitFor(() => expect(api.refreshCoverageCatalogue).toHaveBeenCalledWith(true));
});

test('provider errors are visible and do not present a success message', async () => {
  api.refreshCoverageCatalogue.mockRejectedValue({ body: { error: 'Provider request incomplete' } });
  render(<LeagueManagement />);
  fireEvent.click(await screen.findByText('Refresh from Sportmonks'));
  expect(await screen.findByText('Provider request incomplete')).toBeInTheDocument();
  expect(screen.queryByText('Sportmonks catalogue and current league membership refreshed')).not.toBeInTheDocument();
});
