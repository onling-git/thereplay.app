import { useLayoutEffect, useRef } from 'react';
import { TeamHubSummary } from './TeamHubSummary.mjs';
import { attachTeamHubIsland, hasTeamHubIsland, updateTeamHubIsland } from './teamHubIsland';

export default function TeamHubSummarySlot({ summary, slug, story }) {
  const container = useRef(null);
  const hasIsland = hasTeamHubIsland(slug);
  useLayoutEffect(() => {
    if (!hasIsland) return undefined;
    const target = container.current;
    return attachTeamHubIsland(target);
  }, [hasIsland, slug]);

  useLayoutEffect(() => {
    if (hasIsland && summary) updateTeamHubIsland(summary, slug, container.current);
  }, [hasIsland, slug, summary]);

  if (hasIsland) return <div ref={container} />;
  if (summary) return <TeamHubSummary data={summary} slug={slug} />;
  return story ? <section className="team-story-section">
    {story.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
  </section> : null;
}
