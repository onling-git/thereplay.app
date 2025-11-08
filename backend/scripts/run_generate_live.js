#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Report = require('../models/Report');
const { generateBothReports } = require('../controllers/reportController');

async function main() {
  const matchId = process.argv[2] ? Number(process.argv[2]) : 19431868;
  const force = process.argv.includes('--force') || process.argv.includes('-f');
  if (!process.env.DBURI && !process.env.MONGODB_URI) {
    console.error('Missing DBURI in env. Set DBURI in backend/.env or MONGODB_URI in environment.');
    process.exit(2);
  }

  const uri = process.env.DBURI || process.env.MONGODB_URI;
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB');

  try {
    if (force) {
      console.log(`--force: removing existing reports for match ${matchId} and clearing match.reports`);
      try {
        await Report.deleteMany({ match_id: matchId });
        // clear reports pointer on match so generateBothReports will run normally
        await Match.findOneAndUpdate({ match_id: matchId }, { $unset: { reports: '' } });
        console.log('Existing reports removed and match.reports cleared');
      } catch (e) {
        console.warn('Failed to remove existing reports or clear match.reports (non-fatal):', e?.message || e);
      }
    }

    console.log(`Generating reports for match ${matchId}...`);
    const results = await generateBothReports(matchId);
    console.log('Returned by generateBothReports:', JSON.stringify(results, null, 2));

    // fetch persisted reports for the match
    const persisted = await Report.find({ match_id: matchId }).lean();
    console.log('Persisted reports for match:', JSON.stringify(persisted, null, 2));
  } catch (e) {
    console.error('Error during generation:', e && (e.stack || e.message) ? (e.stack || e.message) : e);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected DB');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
