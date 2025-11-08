// controllers/liveController.js
const { start, stop, status, add, remove } = require('../live/liveRefresher');

exports.liveStart = async (req, res) => {
  const intervalMs = Number(req.body?.intervalMs) || 30000;
  const result = start(intervalMs);
  res.json(result);
};

exports.liveStop = async (_req, res) => {
  res.json(stop());
};

exports.liveStatus = async (_req, res) => {
  res.json(status());
};

exports.liveAdd = async (req, res) => {
  const fixtureId = req.params.fixtureId;
  if (!fixtureId) return res.status(400).json({ error: 'fixtureId required' });
  const result = add(fixtureId);
  // trigger an immediate sync for the added fixture so events/status populate immediately
  try {
    const { syncFixtureInternal } = require('./syncController');
    syncFixtureInternal(Number(fixtureId)).catch(e => console.warn('Immediate sync failed for', fixtureId, e?.message || e));
  } catch (e) {
    console.warn('Failed to require syncController for immediate sync:', e?.message || e);
  }
  res.json(result);
};

exports.liveRemove = async (req, res) => {
  const fixtureId = req.params.fixtureId;
  if (!fixtureId) return res.status(400).json({ error: 'fixtureId required' });
  res.json(remove(fixtureId));
};
