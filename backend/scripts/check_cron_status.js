/**
 * check_cron_status.js
 * Check if cron jobs are running on Railway
 * 
 * This script checks:
 * 1. If the backend is accessible
 * 2. Recent database activity from cron jobs
 * 3. When the last live sync happened
 * 
 * Usage:
 *   node scripts/check_cron_status.js
 */

require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

const BASE = process.env.SELF_BASE || 'https://virtuous-exploration-production.up.railway.app';
const ADMIN_KEY = process.env.ADMIN_API_KEY;
const MONGO_URI = process.env.MONGO_URI || process.env.DBURI;

async function checkCronStatus() {
  console.log('🔍 Checking cron status on Railway...\n');

  try {
    // 1. Check backend health
    console.log('1️⃣ Checking backend health...');
    const health = await axios.get(`${BASE}/health`, { timeout: 10000 });
    console.log('✅ Backend is running:', health.data);
    console.log('');

    // 2. Connect to database
    if (!MONGO_URI) {
      console.error('❌ MONGO_URI not set, skipping database checks');
      return;
    }

    console.log('2️⃣ Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check Match collection for recent updates
    console.log('3️⃣ Checking recent match updates...');
    const Match = mongoose.model('Match', new mongoose.Schema({}, { strict: false, collection: 'matches' }));
    
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    
    // Check for matches updated in last 5 minutes (should happen if cron is running)
    const recentUpdates = await Match.countDocuments({
      updatedAt: { $gte: fiveMinutesAgo }
    });
    
    console.log(`   Matches updated in last 5 minutes: ${recentUpdates}`);
    
    if (recentUpdates === 0) {
      console.log('   ⚠️  No recent updates - cron may not be running!');
      
      // Check for updates in last 30 minutes
      const older = await Match.countDocuments({
        updatedAt: { $gte: thirtyMinutesAgo }
      });
      console.log(`   Matches updated in last 30 minutes: ${older}`);
    } else {
      console.log('   ✅ Cron appears to be running (recent updates detected)');
    }
    console.log('');

    // Check for live matches
    console.log('4️⃣ Checking for live matches in database...');
    const liveMatches = await Match.find({
      $or: [
        { 'match_status.state': { $in: ['inplay', 'live', '1H', '2H', 'HT', 'LIVE'] } },
        { status_code: { $in: ['LIVE', '1H', '2H', 'HT', 'ET'] } }
      ]
    }).limit(10).select('match_id home_team away_team match_status score minute updatedAt');
    
    console.log(`   Found ${liveMatches.length} live matches in database`);
    
    if (liveMatches.length > 0) {
      console.log('   Live matches:');
      liveMatches.forEach(m => {
        const lastUpdate = m.updatedAt ? new Date(m.updatedAt) : null;
        const minutesAgo = lastUpdate ? Math.floor((now - lastUpdate) / 60000) : '?';
        console.log(`   - ${m.home_team} vs ${m.away_team}`);
        console.log(`     Score: ${m.score?.home || 0}-${m.score?.away || 0}, Minute: ${m.minute || '?'}'`);
        console.log(`     Last updated: ${minutesAgo} minutes ago`);
      });
    }
    console.log('');

    // Check today's matches
    console.log('5️⃣ Checking today\'s matches...');
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const todayMatches = await Match.countDocuments({
      $or: [
        { 'match_info.starting_at': { $gte: todayStart, $lt: todayEnd } },
        { date: { $gte: todayStart, $lt: todayEnd } }
      ]
    });
    
    console.log(`   Total matches today: ${todayMatches}`);
    console.log('');

    // Recommendations
    console.log('📋 Summary:');
    if (recentUpdates === 0 && liveMatches.length === 0) {
      console.log('   ⚠️  WARNING: Cron may not be running properly!');
      console.log('   💡 Recommendations:');
      console.log('      1. Check Railway logs for cron startup messages');
      console.log('      2. Verify ADMIN_API_KEY is set in Railway environment');
      console.log('      3. Verify SELF_BASE is set correctly in Railway');
      console.log('      4. Run: node scripts/trigger_live_sync.js to manually sync');
      console.log('      5. Consider restarting the Railway deployment');
    } else if (recentUpdates > 0) {
      console.log('   ✅ Cron appears to be working!');
      if (liveMatches.length === 0) {
        console.log('   ℹ️  No live matches currently (this is normal if no games are live)');
      }
    }

    await mongoose.disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('📄 Response:', error.response.data);
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

checkCronStatus();
