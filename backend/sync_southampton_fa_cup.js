const mongoose = require('mongoose');
const { get } = require('./utils/sportmonks');
const Match = require('./models/Match');
const Team = require('./models/Team');
const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');

async function syncSouthamptonFACup() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay');
        console.log('✅ Connected to MongoDB');

        // Fetch the specific Southampton FA Cup fixture
        console.log('⚽ Fetching Southampton FA Cup fixture (ID: 19615714)...');
        
        try {
            const fixtureData = await get('/fixtures/19615714', {
                include: 'participants'
            });
            
            const fixture = fixtureData?.data?.data;
            if (!fixture) {
                console.log('❌ Fixture not found');
                return;
            }
            
            console.log(`📊 Found fixture: ${fixture.name}`);
            console.log(`🏆 Competition: ${fixture.league?.name} (ID: ${fixture.league_id})`);
            console.log(`📅 Date: ${fixture.starting_at}`);
            console.log(`🏟️ Venue: ${fixture.venue?.name || 'Unknown'}`);
            
            // Debug the fixture structure before normalization
            console.log('\n🔍 Debug fixture structure:');
            console.log('- Fixture ID:', fixture.id);
            console.log('- Participants:', fixture.participants);
            console.log('- League ID:', fixture.league_id);
            console.log('- Stage ID:', fixture.stage_id);
            
            // Normalize and save the fixture
            console.log('💾 Processing and saving fixture...');
            const normalized = normaliseFixtureToMatchDoc(fixture);
            
            console.log('📋 Normalized fixture:');
            console.log('- Match ID:', normalized.match_id);
            console.log('- Teams:', normalized.teams);
            console.log('- Competition:', normalized.competition_name);
            
            const savedMatch = await Match.findOneAndUpdate(
                { match_id: normalized.match_id },
                normalized,
                { upsert: true, new: true }
            );
            
            console.log(`✅ Saved match: ${normalized.teams.home.name} vs ${normalized.teams.away.name}`);
            console.log(`   Match ID: ${savedMatch._id}`);
            console.log(`   Competition: ${normalized.competition_name}`);
            if (normalized.match_info?.stage) {
                console.log(`   Stage: ${normalized.match_info.stage.name}`);
            }
            if (normalized.match_info?.round) {
                console.log(`   Round: ${normalized.match_info.round.name}`);
            }
            
            // Update Southampton's next_match reference
            console.log('\n🔄 Updating Southampton team record...');
            const southampton = await Team.findOne({ name: /southampton/i });
            
            if (southampton) {
                console.log(`Found Southampton team: ${southampton.name} (ID: ${southampton._id})`);
                console.log(`Current next_match: ${southampton.next_match}`);
                
                // Check if this match is today and earlier than current next_match
                const matchDate = new Date(savedMatch.date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                
                if (matchDate >= today && matchDate < tomorrow) {
                    console.log('🎯 This is today\'s match - updating next_match reference');
                    southampton.next_match = savedMatch._id;
                    await southampton.save();
                    
                    console.log(`✅ Updated Southampton's next_match to: ${savedMatch._id}`);
                    console.log(`   New next match: ${savedMatch.teams.home.name} vs ${savedMatch.teams.away.name}`);
                } else {
                    console.log('📅 This match is not today - keeping current next_match');
                }
            } else {
                console.log('❌ Southampton team not found in database');
            }
            
            // Verify the final state
            console.log('\n🔍 Final verification - Southampton matches today:');
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);
            
            const todayMatches = await Match.find({
                date: { 
                    $gte: todayStart,
                    $lt: todayEnd
                },
                $or: [
                    { 'teams.home.name': /southampton/i },
                    { 'teams.away.name': /southampton/i }
                ]
            });
            
            console.log(`Found ${todayMatches.length} Southampton matches for today:`);
            todayMatches.forEach(match => {
                console.log(`- ${match.teams.home.name} vs ${match.teams.away.name}`);
                console.log(`  Competition: ${match.competition_name}`);
                console.log(`  Time: ${match.time}`);
                console.log(`  Match ID: ${match._id}`);
            });
            
        } catch (apiError) {
            console.error('❌ Error fetching fixture from API:', apiError.message);
        }
        
    } catch (error) {
        console.error('❌ Error during sync:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
        process.exit();
    }
}

syncSouthamptonFACup();