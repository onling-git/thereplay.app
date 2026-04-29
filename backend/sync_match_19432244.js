// Manually sync match 19432244 to get latest data
const mongoose = require('mongoose');
require('dotenv').config();
const { get: smGet } = require('./utils/sportmonks');
const Match = require('./models/Match');

async function syncMatch19432244() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    const matchId = 19432244;
    
    console.log(`🔄 Fetching latest data for match ${matchId} from SportMonks...\n`);
    
    // Try different include combinations
    const includesToTry = [
      'events;participants;scores;periods;state;lineups;statistics;comments',
      'state;scores;statistics;lineups;events;comments',
      'state;scores;lineups;events;comments',
      'state;scores;events'
    ];
    
    let matchData = null;
    let usedInclude = null;
    
    for (const include of includesToTry) {
      try {
        console.log(`Trying include: ${include}`);
        const res = await smGet(`fixtures/${matchId}`, { include });
        matchData = res?.data?.data || res?.data;
        if (matchData) {
          usedInclude = include;
          console.log(`✅ Successfully fetched with include: ${include}\n`);
          break;
        }
      } catch (e) {
        console.log(`❌ Failed with include: ${include}`);
      }
    }
    
    if (!matchData) {
      console.log('❌ Could not fetch match data from SportMonks');
      process.exit(1);
    }
    
    // Display current status from API
    console.log('📊 Match Data from SportMonks:');
    console.log('   Match ID:', matchData.id);
    console.log('   State:', matchData.state?.state || matchData.state?.name || 'N/A');
    console.log('   Status:', matchData.state?.short_name || 'N/A');
    console.log('   Starting at:', matchData.starting_at);
    
    // Check if we have participants
    const participants = matchData.participants?.data || matchData.participants || [];
    console.log('\n👥 Participants:', participants.length);
    if (participants.length >= 2) {
      console.log('   Home:', participants[0]?.name || 'N/A');
      console.log('   Away:', participants[1]?.name || 'N/A');
    }
    
    // Check scores
    const scores = matchData.scores?.data || matchData.scores || [];
    console.log('\n⚽ Scores:', scores.length);
    scores.forEach(score => {
      console.log(`   - ${score.description}: ${score.score.goals}`);
    });
    
    // Check statistics
    const statistics = matchData.statistics?.data || matchData.statistics || [];
    console.log('\n📈 Statistics:', statistics.length);
    if (statistics.length > 0) {
      console.log('   Sample stats:');
      statistics.slice(0, 5).forEach(stat => {
        const type = stat.type?.name || stat.type || 'Unknown';
        console.log(`      - ${type}: ${JSON.stringify(stat.data)}`);
      });
    }
    
    // Check events
    const events = matchData.events?.data || matchData.events || [];
    console.log('\n⚽ Events:', events.length);
    if (events.length > 0) {
      console.log('   Recent events:');
      events.slice(0, 5).forEach(evt => {
        console.log(`      - ${evt.minute || '?'}' ${evt.type?.name || evt.type}: ${evt.player?.name || 'N/A'}`);
      });
    }
    
    // Check lineups
    const lineups = matchData.lineups?.data || matchData.lineups || [];
    console.log('\n👥 Lineups:', lineups.length, 'groups');
    
    // Check comments
    const comments = matchData.comments?.data || matchData.comments || [];
    console.log('\n💬 Comments:', comments.length);
    if (comments.length > 0) {
      console.log('   Recent comments:');
      comments.slice(0, 3).forEach(comment => {
        console.log(`      - ${comment.minute || '?'}': ${(comment.comment || '').substring(0, 60)}...`);
      });
    }
    
    console.log('\n🔧 Would you like to update the database with this data? (Manual confirmation required)');
    console.log('   Current DB status: NS');
    console.log('   API status:', matchData.state?.short_name || matchData.state?.state || 'N/A');
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

syncMatch19432244();
