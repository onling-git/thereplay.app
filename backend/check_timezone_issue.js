// Check timezone handling for match 19432244
const mongoose = require('mongoose');
require('dotenv').config();
const Match = require('./models/Match');
const { get: smGet } = require('./utils/sportmonks');

async function checkTimezoneIssue() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    const matchId = 19432244;
    
    // Get from API
    console.log('🔄 Fetching from SportMonks API...');
    const res = await smGet(`fixtures/${matchId}`, { include: 'state' });
    const apiData = res?.data?.data || res?.data;
    
    console.log('\n📊 API Data:');
    console.log('   starting_at:', apiData.starting_at);
    console.log('   starting_at_timestamp:', apiData.starting_at_timestamp);
    
    // Convert timestamp to readable date
    if (apiData.starting_at_timestamp) {
      const timestampDate = new Date(apiData.starting_at_timestamp * 1000);
      console.log('   Timestamp as date:', timestampDate.toISOString());
      console.log('   Timestamp as UK time:', timestampDate.toLocaleString('en-GB', { timeZone: 'Europe/London' }));
      console.log('   Current time:', new Date().toISOString());
      console.log('   Current UK time:', new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' }));
    }
    
    // Get from DB
    const dbMatch = await Match.findOne({ match_id: matchId }).lean();
    
    console.log('\n📦 DB Data:');
    console.log('   date:', dbMatch.date);
    console.log('   starting_at:', dbMatch.match_info?.starting_at);
    console.log('   starting_at_timestamp:', dbMatch.match_info?.starting_at_timestamp);
    
    // Compare
    const apiTimestamp = apiData.starting_at_timestamp;
    const dbTimestamp = dbMatch.match_info?.starting_at_timestamp;
    
    if (apiTimestamp && dbTimestamp) {
      const diff = apiTimestamp - dbTimestamp;
      console.log('\n⏰ Timestamp Comparison:');
      console.log('   API timestamp:', apiTimestamp);
      console.log('   DB timestamp:', dbTimestamp);
      console.log('   Difference (seconds):', diff);
      console.log('   Difference (hours):', diff / 3600);
      
      if (diff !== 0) {
        console.log('   ⚠️ TIMESTAMPS DO NOT MATCH!');
      } else {
        console.log('   ✅ Timestamps match');
      }
    }
    
    // Check if match should be live right now
    const now = Date.now() / 1000; // current timestamp in seconds
    const matchTime = apiData.starting_at_timestamp;
    const timeSinceStart = (now - matchTime) / 60; // minutes
    
    console.log('\n🕐 Should this match be live?');
    console.log('   Current time (timestamp):', Math.floor(now));
    console.log('   Match start (timestamp):', matchTime);
    console.log('   Minutes since kickoff:', Math.floor(timeSinceStart));
    console.log('   Match state from API:', apiData.state?.state, `(${apiData.state?.short_name})`);
    
    if (timeSinceStart >= 0 && timeSinceStart <= 120) {
      console.log('   ✅ Match should be live or recently finished');
    } else if (timeSinceStart < 0) {
      console.log('   ⏰ Match hasn\'t started yet (in', Math.abs(Math.floor(timeSinceStart)), 'minutes)');
    } else {
      console.log('   ✅ Match finished', Math.floor(timeSinceStart), 'minutes ago');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message || err);
  } finally {
    await mongoose.disconnect();
  }
}

checkTimezoneIssue();
