import React from 'react';
import { useParams } from 'react-router-dom';
import { TeamHubDiscussionView } from '../components/TeamHubCommunity';

const TeamCommunityDiscussion = () => {
  const { teamSlug, discussionId } = useParams();

  return <TeamHubDiscussionView teamSlug={teamSlug} discussionId={discussionId} />;
};

export default TeamCommunityDiscussion;
