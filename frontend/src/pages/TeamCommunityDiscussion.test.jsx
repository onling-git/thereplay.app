import { render, screen } from '@testing-library/react';
import { useParams } from 'react-router-dom';
import TeamCommunityDiscussion from './TeamCommunityDiscussion';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));
jest.mock('../components/TeamHubCommunity', () => ({
  TeamHubCommunitySection: ({ teamSlug }) => <div>Discussions for {teamSlug}</div>,
  TeamHubDiscussionView: ({ teamSlug, discussionId }) => <div>{teamSlug} discussion {discussionId}</div>,
}));

test('opens the community list for the team in the URL', () => {
  useParams.mockReturnValue({ teamSlug: 'manchester-city' });
  render(<TeamCommunityDiscussion />);

  expect(screen.getByRole('heading', { name: 'manchester city Community' })).toBeInTheDocument();
  expect(screen.getByText('Discussions for manchester-city')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to team hub' })).toHaveAttribute('href', '/manchester-city');
});

test('preserves individual team discussion pages', () => {
  useParams.mockReturnValue({ teamSlug: 'arsenal', discussionId: 'discussion-123' });
  render(<TeamCommunityDiscussion />);

  expect(screen.getByText('arsenal discussion discussion-123')).toBeInTheDocument();
  expect(screen.queryByText('Discussions for arsenal')).not.toBeInTheDocument();
});