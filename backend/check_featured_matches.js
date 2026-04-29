require('dotenv').config();
const Match = require('./models/Match');
const mongoose = require('mongoose');

async function checkFeaturedMatches() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB');
    
    // Get today's date range
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowEnd = new Date(todayStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 2); // Today + tomorrow
    
    console.log('\n📅 Checking matches from', todayStart.toISOString(), 'to', tomorrowEnd.toISOString());
    
    // Find matches for today and tomorrow
    const matches = await Match.find({
      $or: [
        { 'match_info.starting_at': { $gte: todayStart, $lt: tomorrowEnd } },
        { date: { $gte: todayStart, $lt: tomorrowEnd } }
      ]
    })
    .sort({ 'match_info.starting_at': 1, date: 1 })
    .limit(20)
    .lean();
    
    console.log(`\n📊 Found ${matches.length} matches for today/tomorrow\n`);
    
    for (const match of matches) {
      const timestamp = match.match_info?.starting_at_timestamp;
      const starting_at = match.match_info?.starting_at;
      const legacyDate = match.date;
      
      console.log(`\n🏟️  Match ${match.match_id}: ${match.teams?.home?.team_name} vs ${match.teams?.away?.team_name}`);
      console.log(`   League: ${match.match_info?.league?.name}`);
      console.log(`   Status: ${match.match_status?.name} (${match.match_status?.short_name})`);
      
      // Check for data consistency
      let hasIssue = false;
      
      if (timestamp) {
        const timestampDate = new Date(timestamp * 1000);
        console.log(`   starting_at_timestamp: ${timestampDate.toLocaleString()} (${timestampDate.toISOString()})`);
        
        if (starting_at) {
          const startingAtDate = new Date(starting_at);
          const diff = Math.abs(timestampDate.getTime() - startingAtDate.getTime());
          
          console.log(`   starting_at: ${startingAtDate.toLocaleString()} (${startingAtDate.toISOString()})`);
          
          if (diff > 60000) { // More than 1 minute difference
            hasIssue = true;
            console.log(`   ⚠️  WARNING: ${Math.round(diff / 60000)} minute difference between timestamp and starting_at!`);
          }
        } else {
          hasIssue = true;
          console.log(`   ⚠️  WARNING: starting_at is missing!`);
        }
      } else {
        hasIssue = true;
        console.log(`   ⚠️  WARNING: starting_at_timestamp is missing!`);
      }
      
      if (legacyDate) {
        console.log(`   date (legacy): ${new Date(legacyDate).toLocaleString()}`);
      }
      
      if (hasIssue) {
        console.log(`   ❌ This match has data inconsistencies!`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkFeaturedMatches();
