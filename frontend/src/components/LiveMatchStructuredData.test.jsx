import { render } from '@testing-library/react';
import LiveMatchStructuredData from './LiveMatchStructuredData';

const matchUrl = 'https://thereplay.app/southampton/match/19729063';
const graph = { '@context': 'https://schema.org', '@graph': [
  { '@type': 'SportsEvent', '@id': `${matchUrl}#event`, name: '</script><script>test</script>' },
] };
const script = () => document.getElementById('live-match-structured-data');

test('renders a real JSON-LD script and canonical link without unsafe HTML containers', () => {
  const { unmount } = render(<LiveMatchStructuredData graph={graph} matchUrl={matchUrl} matchId="19729063" />);
  expect(script().tagName).toBe('SCRIPT');
  expect(script().type).toBe('application/ld+json');
  expect(script().textContent).not.toContain('<');
  expect(JSON.parse(script().textContent)).toEqual(graph);
  expect(document.querySelector('link[rel="canonical"]').href).toBe(matchUrl);
  unmount();
  expect(script()).toBeNull();
  expect(document.querySelector('link[data-live-match-canonical]')).toBeNull();
});

test('preserves initial server markup while loading, then replaces it without duplication', () => {
  const initial = document.createElement('script');
  initial.type = 'application/ld+json';
  initial.id = 'live-match-structured-data';
  initial.setAttribute('data-match-id', '19729063');
  initial.textContent = JSON.stringify(graph);
  document.head.appendChild(initial);
  const { rerender } = render(<LiveMatchStructuredData matchId="19729063" />);
  expect(script()).toBe(initial);
  rerender(<LiveMatchStructuredData graph={graph} matchUrl={matchUrl} matchId="19729063" />);
  expect(document.querySelectorAll('#live-match-structured-data')).toHaveLength(1);
  expect(JSON.parse(script().textContent)).toEqual(graph);
});

test('removes previous markup when the route changes or the page errors', () => {
  const { rerender } = render(<LiveMatchStructuredData graph={graph} matchUrl={matchUrl} matchId="19729063" />);
  rerender(<LiveMatchStructuredData matchId="19729064" />);
  expect(script()).toBeNull();
  rerender(<LiveMatchStructuredData graph={graph} matchUrl={matchUrl} matchId="19729063" />);
  rerender(<LiveMatchStructuredData clear />);
  expect(script()).toBeNull();
});
