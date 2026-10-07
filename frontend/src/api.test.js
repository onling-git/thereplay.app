import { getTeamsByIds } from './api';

jest.mock('./api/base', () => ({ API_BASE: '' }));

afterEach(() => jest.restoreAllMocks());

test('resolves Southampton by ID beyond the first page and tolerates string IDs', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce({ ok: true, json: async () => ({ teams: [{ id: 1, name: 'Arsenal' }], pagination: { limit: 1000, hasMore: true } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ teams: [{ id: '65', name: 'Southampton', slug: 'southampton' }], pagination: { limit: 1000, hasMore: true } }) });
  expect(await getTeamsByIds([65])).toEqual([{ id: '65', name: 'Southampton', slug: 'southampton' }]);
  expect(fetchSpy).toHaveBeenNthCalledWith(2, '/api/teams?limit=1000&offset=1000', {});
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

test('stops immediately once all requested IDs are found', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ teams: [{ id: 65, slug: 'southampton' }], pagination: { hasMore: true } }) });
  expect(await getTeamsByIds(['65', 65])).toHaveLength(1);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});

test('stops at the last page if a saved team no longer exists', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ teams: [], pagination: { hasMore: false } }) });
  expect(await getTeamsByIds([65])).toEqual([]);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});

test('does not request teams when no IDs are supplied', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch');
  expect(await getTeamsByIds([])).toEqual([]);
  expect(fetchSpy).not.toHaveBeenCalled();
});