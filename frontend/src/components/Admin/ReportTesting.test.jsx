import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as adminApi from '../../api/adminApi';
import ReportTesting from './ReportTesting';

jest.mock('../../api/adminApi');
jest.mock('../ReportContent/ReportContent', () => function ReportPreview({ report }) {
  return <div>{report.headline}</div>;
});

const liveReport = { headline: 'Published report' };
const openaiReport = { headline: 'OpenAI draft', meta: { generated_by: 'gpt-4o-mini', writer_provider: 'openai' } };
const claudeReport = { headline: 'Claude draft', meta: { generated_by: 'claude-opus-5-5', writer_provider: 'claude' } };

beforeEach(() => {
  jest.resetAllMocks();
  adminApi.getMatchById.mockResolvedValue({ match_id: 123, home_team: 'Home', away_team: 'Away', home_team_slug: 'home', away_team_slug: 'away' });
  adminApi.getTeamMatchReport.mockResolvedValue({ report: liveReport });
  adminApi.getStagingReport.mockResolvedValue({ report: null });
});

async function loadMatch() {
  render(<ReportTesting />);
  fireEvent.click(screen.getByRole('button', { name: 'Load Match' }));
  await screen.findByText('Published report');
}

test.each(['v2', 'v3', 'v4'])('%s draft selection sends Claude only to the draft API', async version => {
  await loadMatch();
  fireEvent.change(screen.getByLabelText('Pipeline'), { target: { value: version } });
  await waitFor(() => expect(screen.getByLabelText('Draft writer')).toBeEnabled());
  expect(screen.getByLabelText('Draft writer')).toHaveValue('openai');
  fireEvent.change(screen.getByLabelText('Draft writer'), { target: { value: 'claude' } });
  adminApi.generateStagingReport.mockResolvedValue({ report: claudeReport });
  fireEvent.click(screen.getByRole('button', { name: `Generate ${version.toUpperCase()} Staging Draft` }));
  await screen.findByText('Claude draft');
  expect(adminApi.generateStagingReport).toHaveBeenCalledWith(123, 'home', { debug: true, version, writerProvider: 'claude' });
  expect(screen.getByText(/Writer: Claude/)).toBeInTheDocument();
  expect(adminApi.regenerateMatchReport).not.toHaveBeenCalled();
  expect(adminApi.promoteStagingReport).not.toHaveBeenCalled();
});

test('keeps the OpenAI snapshot while generating Claude and preserves published content', async () => {
  await loadMatch();
  adminApi.generateStagingReport.mockResolvedValueOnce({ report: openaiReport }).mockResolvedValueOnce({ report: claudeReport });
  fireEvent.click(screen.getByRole('button', { name: 'Generate V2 Staging Draft' }));
  await screen.findByText('OpenAI draft');
  fireEvent.click(screen.getByRole('button', { name: 'Keep for comparison' }));
  fireEvent.change(screen.getByLabelText('Draft writer'), { target: { value: 'claude' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate V2 Staging Draft' }));
  await screen.findByText('Claude draft');
  fireEvent.click(screen.getByRole('button', { name: 'Comparison snapshot' }));
  expect(screen.getByText('OpenAI draft')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Promote Draft to Live' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Live report' }));
  expect(screen.getByText('Published report')).toBeInTheDocument();
});

test('shows configuration errors and locks controls during generation', async () => {
  await loadMatch();
  let rejectGeneration;
  adminApi.generateStagingReport.mockImplementation(() => new Promise((resolve, reject) => { rejectGeneration = reject; }));
  fireEvent.click(screen.getByRole('button', { name: 'Generate V2 Staging Draft' }));
  expect(screen.getByLabelText('Draft writer')).toBeDisabled();
  expect(screen.getByLabelText('Pipeline')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Regenerate Live Report' })).toBeDisabled();
  rejectGeneration({ body: { detail: 'CLAUDE_API_KEY is not configured on the server' } });
  await screen.findByText('CLAUDE_API_KEY is not configured on the server');
  expect(screen.getByLabelText('Draft writer')).toBeEnabled();
});