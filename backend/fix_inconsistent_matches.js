require('dotenv').config();
const { get } = require('./utils/sportmonks');
const Match = require('./models/Match');
const mongoose = require('mongoose');

async function fixInconsistentMatches() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB');
    
    // Get today's date range
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekFromNow = new Date(todayStart);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    
    // Find matches for the next 7 days
    const matches = await Match.find({
      $or: [
        { 'match_info.starting_at': { $gte: todayStart, $lt: weekFromNow } },
        { date: { $gte: todayStart, $lt: weekFromNow } }
      ]
    })
    .limit(100)
    .lean();
    
    console.log(`\n📊 Checking ${matches.length} matches for inconsistencies\n`);
    
    const matchesToUpdate = [];
    
    for (const match of matches) {
      const timestamp = match.match_info?.starting_at_timestamp;
      const starting_at = match.match_info?.starting_at;
      
      if (timestamp && starting_at) {
        const timestampDate = new Date(timestamp * 1000);
        const startingAtDate = new Date(starting_at);
        const diff = Math.abs(timestampDate.getTime() - startingAtDate.getTime());
        
        if (diff > 60000) { // More than 1 minute difference
          matchesToUpdate.push({
            match_id: match.match_id,
            home: match.teams?.home?.team_name,
            away: match.teams?.away?.team_name,
            diff_minutes: Math.round(diff / 60000)
          });
        }
      } else if (!timestamp || !starting_at) {
        matchesToUpdate.push({
          match_id: match.match_id,
          home: match.teams?.home?.team_name,
          away: match.teams?.away?.team_name,
          diff_minutes: 'Missing data'
        });
      }
    }
    
    if (matchesToUpdate.length === 0) {
      console.log('✅ No inconsistent matches found!');
      return;
    }
    
    console.log(`⚠️  Found ${matchesToUpdate.length} matches with inconsistencies:\n`);
    matchesToUpdate.forEach((m, i) => {
      console.log(`${i + 1}. Match ${m.match_id}: ${m.home} vs ${m.away} (${m.diff_minutes} min difference)`);
    });
    
    console.log('\n🔧 Updating matches from SportMonks API...\n');
    
    let updated = 0;
    let failed = 0;
    
    for (const matchInfo of matchesToUpdate) {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
        
        console.log(`Fetching match ${matchInfo.match_id}...`);
        const response = await get(`fixtures/${matchInfo.match_id}`, {
          include: 'state;participants;scores;venue;events;stage;league'
        });
        
        const data = response.data.data;
        
        // Parse participants
        const homeTeam = data.participants?.find(p => p.meta?.location === 'home');
        const awayTeam = data.participants?.find(p => p.meta?.location === 'away');
        
        // Parse scores
        const homeScore = data.scores?.find(s => s.participant_id === homeTeam?.id)?.score?.goals || 0;
        const awayScore = data.scores?.find(s => s.participant_id === awayTeam?.id)?.score?.goals || 0;
        
        // Update the match
        const update = {
          'match_info.starting_at': data.starting_at,
          'match_info.starting_at_timestamp': data.starting_at_timestamp,
          'date': new Date(data.starting_at),
          'match_status.name': data.state?.state,
          'match_status.short_name': data.state?.short_name,
          'match_status.state': data.state?.state,
          'score.home': homeScore,
          'score.away': awayScore,
          'updated_at': new Date()
        };
        
        await Match.updateOne(
          { match_id: matchInfo.match_id },
          { $set: update }
        );
        
        const newDate = new Date(data.starting_at_timestamp * 1000);
        console.log(`  ✅ Updated to: ${newDate.toLocaleString()}`);
        updated++;
        
      } catch (error) {
        console.error(`  ❌ Failed: ${error.message}`);
        failed++;
      }
    }
    
    console.log(`\n📊 Summary: ${updated} updated, ${failed} failed`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixInconsistentMatches();
