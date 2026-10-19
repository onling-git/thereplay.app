const crypto = require('crypto');
const ReportGenerationLock = require('../models/ReportGenerationLock');

const LEASE_MS = 10 * 60 * 1000;

async function withReportGenerationLock(matchId, teamSlug, generate) {
  if (!Number.isSafeInteger(Number(matchId)) || Number(matchId) <= 0 || typeof teamSlug !== 'string' || !teamSlug.trim()) {
    const error = new Error('A positive match ID and non-empty team slug are required for report generation');
    error.status = 400;
    throw error;
  }
  const key = `${Number(matchId)}:${String(teamSlug).trim().toLowerCase()}`;
  const owner = crypto.randomUUID();
  try {
    await ReportGenerationLock.findOneAndUpdate(
      { _id: key, expires_at: { $lte: new Date() } },
      { $set: { owner, expires_at: new Date(Date.now() + LEASE_MS) } },
      { upsert: true, new: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    const busy = new Error(`Report generation already in progress for ${key}`);
    busy.status = 409;
    throw busy;
  }

  let leaseError;
  let renewal = Promise.resolve();
  const heartbeat = setInterval(() => {
    renewal = renewal.then(async () => {
      if (leaseError) return;
      const result = await ReportGenerationLock.updateOne(
        { _id: key, owner },
        { $set: { expires_at: new Date(Date.now() + LEASE_MS) } }
      );
      if (result.matchedCount !== 1) throw new Error(`Report generation lease lost for ${key}`);
    }).catch(error => {
      leaseError = error;
      console.error('[report-generation-lock] Lease renewal failed:', error.message);
    });
  }, 30000);
  heartbeat.unref();

  async function assertOwnership() {
    await renewal;
    if (leaseError) throw leaseError;
    const owned = await ReportGenerationLock.exists({ _id: key, owner, expires_at: { $gt: new Date() } });
    if (!owned) throw new Error(`Report generation lease lost for ${key}`);
  }

  try {
    return await generate(assertOwnership);
  } finally {
    clearInterval(heartbeat);
    await renewal;
    try {
      await ReportGenerationLock.deleteOne({ _id: key, owner });
    } catch (error) {
      console.error('[report-generation-lock] Could not release lease:', error.message);
    }
  }
}

module.exports = { withReportGenerationLock };
