import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { TeamHubCommunitySection, TeamHubDiscussionView } from '../components/TeamHubCommunity';

const TeamCommunityDiscussion = () => {
  const { teamSlug, discussionId } = useParams();

  if (!discussionId) {
    return (
      <div className="team-overview">
        <h1>{teamSlug.replace(/-/g, ' ')} Community</h1>
        <Link to={`/${teamSlug}`} className="card-link">Back to team hub</Link>
        <TeamHubCommunitySection key={teamSlug} teamSlug={teamSlug} />
      </div>
    );
  }

  return <TeamHubDiscussionView teamSlug={teamSlug} discussionId={discussionId} />;
};

export default TeamCommunityDiscussion;
