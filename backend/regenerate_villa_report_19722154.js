// Regenerate the Aston Villa report for match 19722154 using the FIXED pipeline,
// writing to the production DB (overwrites the inverted report).
require('dotenv').config({ path: '.env.production', override: true });
const mongoose = require('mongoose');
const { generateReportPipeline } = require('./services/reportPipeline');
const { saveReportToDatabase } = require('./controllers/reportControllerV2');

async function main() {
  await mongoose.connect(process.env.DBURI);
  console.log('Connected. Regenerating report for match 19722154, team aston-villa...');

  const { report, metadata } = await generateReportPipeline({
    matchId: 19722154,
    teamSlug: 'aston-villa'
  });

  console.log('\n=== GENERATED ===');
  console.log('headline:', report.headline);
  (report.summary_paragraphs || []).forEach((p, i) => console.log(`[${i}] ${p}`));
  console.log('key_moments:');
  (report.key_moments || []).forEach(k => console.log(' -', k));

  await saveReportToDatabase({ report, matchId: 19722154, teamSlug: 'aston-villa', metadata });
  console.log('\nSaved to production DB.');
  await mongoose.disconnect();
}

main().catch(err => { console.error('FAILED:', err.message || err); process.exit(1); });
