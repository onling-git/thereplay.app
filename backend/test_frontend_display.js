require('dotenv').config();
const Match = require('./models/Match');
const mongoose = require('mongoose');

async function testFrontendData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB');
    
    // Simulate what the frontend receives
    const matches = await Match.find({
      match_id: { $in: [19432238, 19432230] }
    }).lean();
    
    console.log('\n📊 Simulating Frontend Data:\n');
    
    for (const match of matches) {
      console.log(`Match ${match.match_id}: ${match.teams?.home?.team_name} vs ${match.teams?.away?.team_name}`);
      
      // This is how LiveScoreCards.jsx processes the time
      let matchDate;
      if (match.match_info?.starting_at_timestamp && Number.isFinite(match.match_info.starting_at_timestamp)) {
        matchDate = new Date(match.match_info.starting_at_timestamp * 1000);
        console.log('  Using starting_at_timestamp (CORRECT):');
      } else if (match.match_info?.starting_at) {
        matchDate = new Date(match.match_info.starting_at);
        console.log('  Using starting_at (FALLBACK):');
      } else {
        matchDate = new Date(match.date);
        console.log('  Using date (LAST RESORT):');
      }
      
      console.log('    UTC:', matchDate.toUTCString());
      console.log('    Local:', matchDate.toLocaleString());
      console.log('    Display time:', matchDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }));
      
      // Check what day it is
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const matchDay = matchDate.toDateString();
      const todayStr = now.toDateString();
      const tomorrowStr = tomorrow.toDateString();
      
      if (matchDay === todayStr) {
        console.log('    Day: TODAY ✓');
      } else if (matchDay === tomorrowStr) {
        console.log('    Day: TOMORROW ✓');
      } else {
        console.log(`    Day: ${matchDay}`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testFrontendData();
