// scripts/test_generate_reports_19431868.js
// Simple tester: calls generateBothReports for match 19431868 and logs results.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { generateBothReports } = require('../controllers/reportController');

const MONGO = process.env.DBURI || process.env.MONGO_URI || 'mongodb://localhost:27017/fulltime';

async function main() {
  console.log('Connecting to', MONGO);
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    const results = await generateBothReports(19431868);
    console.log('generateBothReports result:', results && results.map(r => ({ _id: r._id || r, team_focus: r.team_focus || r.team_slug || null })));
  } catch (e) {
    console.error('generateBothReports error:', e);
  }
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
