import React, { useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { TeamHubSummary } from './TeamHubSummary.mjs';

let island;
let depot;
let root;
let initialSlug;
let hydrated;
let host;

export function hydrateTeamHubIsland() {
  island = document.getElementById('team-hub-island');
  depot = document.getElementById('team-hub-depot');
  const bootstrap = document.getElementById('team-hub-initial-data');
  if (!island || !depot || !bootstrap) return;
  try {
    const { data, slug } = JSON.parse(bootstrap.textContent);
    initialSlug = slug;
    let resolveHydrated;
    hydrated = new Promise(resolve => { resolveHydrated = resolve; });
    function InitialSummary() {
      useEffect(() => { resolveHydrated(); }, []);
      return <TeamHubSummary data={data} slug={slug} />;
    }
    root = hydrateRoot(island, <InitialSummary />, {
      onRecoverableError: error => console.error('Team hub hydration failed:', error),
    });
    return () => {
      root.unmount();
      island = null;
      depot = null;
      root = null;
      host = null;
      initialSlug = null;
    };
  } catch (error) {
    console.error('Could not hydrate team hub:', error);
    island = null;
  }
}

export function hasTeamHubIsland(slug) {
  return Boolean(island && root && initialSlug === slug);
}

export function attachTeamHubIsland(target) {
  host = target;
  target.appendChild(island);
  return () => {
    if (host === target) host = null;
    if (island.parentNode === target) depot.appendChild(island);
  };
}

export function updateTeamHubIsland(data, slug, target) {
  hydrated.then(() => {
    if (host === target && island.parentNode === target && slug === initialSlug) {
      root.render(<TeamHubSummary data={data} slug={slug} />);
    }
  });
}
