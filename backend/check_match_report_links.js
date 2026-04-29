// Check match document and report references
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');
const Report = require('./models/Report');

async function checkMatchReportLinks() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB');

    const matchId = 19432238;
    
    // Get match document
    const match = await Match.findOne({ match_id: matchId });
    
    console.log('\n📊 MATCH DOCUMENT');
    console.log('='.repeat(80));
    console.log('Match ID:', match.match_id);
    console.log('Home Team:', match.teams?.home?.team_name, `(ID: ${match.teams?.home?.team_id})`);
    console.log('Away Team:', match.teams?.away?.team_name, `(ID: ${match.teams?.away?.team_id})`);
    console.log('Score:', match.score?.home, '-', match.score?.away);
    console.log('');
    
    // Check if match has report references
    console.log('Match has_report field:', match.has_report);
    console.log('Match report_id field:', match.report_id);
    console.log('Match reports field:', match.reports);
    console.log('');
    
    // Get all reports for this match
    const reports = await Report.find({ match_id: matchId });
    
    console.log('\n📝 REPORTS FOR THIS MATCH');
    console.log('='.repeat(80));
    console.log(`Found ${reports.length} report(s)\n`);
    
    reports.forEach((report, i) => {
      console.log(`REPORT ${i + 1}:`);
      console.log('  ID:', report._id);
      console.log('  Team ID:', report.team_id);
      console.log('  Team Slug:', report.team_slug);
      console.log('  Status:', report.status);
      console.log('  Headline:', report.headline);
      console.log('');
    });
    
    // Check if we need to update match document
    console.log('\n🔍 ANALYSIS');
    console.log('='.repeat(80));
    
    const wrexhamReport = reports.find(r => r.team_slug === 'wrexham');
    const southamptonReport = reports.find(r => r.team_slug === 'southampton');
    
    console.log('Wrexham report exists:', !!wrexhamReport);
    console.log('Southampton report exists:', !!southamptonReport);
    console.log('');
    
    if (wrexhamReport) {
      console.log('Wrexham report ID:', wrexhamReport._id);
      console.log('Wrexham report status:', wrexhamReport.status);
    }
    
    if (southamptonReport) {
      console.log('Southampton report ID:', southamptonReport._id);
      console.log('Southampton report status:', southamptonReport.status);
    }
    
    console.log('');
    console.log('Match document needs update?', 
      !match.has_report || 
      !match.reports || 
      match.reports.length !== reports.length
    );

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkMatchReportLinks();
