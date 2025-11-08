// scripts/regenerate_reports_for_match.js
require('dotenv').config();
const mongoose = require('mongoose');
const { generateBothReports } = require('../controllers/reportController');

async function main() {
  const matchId = process.argv[2] || process.env.INSPECT_MATCH_ID;
  if (!matchId) {
    console.error('Usage: node regenerate_reports_for_match.js <matchId>');
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.DBURI, { dbName: process.env.DBNAME || undefined });

  try {
    const reports = await generateBothReports(Number(matchId));
    console.log('Generated reports:', reports.map(r => ({ _id: r._id, team_focus: r.team_focus, man_of_the_match: r.man_of_the_match }))); 
  } catch (e) {
    console.error('generateBothReports failed:', e.message || e);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
