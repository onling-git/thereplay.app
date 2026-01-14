const mongoose = require('mongoose');
const { get } = require('./utils/sportmonks');
const Match = require('./models/Match');
const Team = require('./models/Team');
const { normaliseFixture } = require('./utils/normaliseFixture');

async function manualSouthamptonSync() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay');
        console.log('✅ Connected to MongoDB');

        console.log('⚽ Manually syncing cup fixtures for today (2026-01-10)...');
        const targetDate = '2026-01-10';
        
        try {
            console.log(`📅 Fetching fixtures for ${targetDate} with stage/round data...`);
            const data = await get(`/fixtures/date/${targetDate}`, {
                include: 'league,season,participants,stage,round'
            });
            
            const fixtures = data?.data || [];
            console.log(`📊 Found ${fixtures.length} total fixtures for ${targetDate}`);
            
            // Filter for cup competitions (FA Cup is league ID 24)
            const cupFixtures = fixtures.filter(fixture => {
                const league = fixture.league;
                return league && (
                    league.id === 24 || // FA Cup
                    league.name?.toLowerCase().includes('cup') ||
                    league.name?.toLowerCase().includes('trophy')
                );
            });
            
            console.log(`🏆 Found ${cupFixtures.length} cup fixtures for ${targetDate}`);
            cupFixtures.forEach(fixture => {
                const home = fixture.participants?.find(p => p.meta?.location === 'home')?.name || 'Unknown';
                const away = fixture.participants?.find(p => p.meta?.location === 'away')?.name || 'Unknown';
                console.log(`- ${home} vs ${away} (${fixture.league?.name})`);
            });
            
            // Process cup fixtures
            for (const fixture of cupFixtures) {
                try {
                    const normalized = normaliseFixture(fixture);
                    
                    await Match.findOneAndUpdate(
                        { sportmonks_id: normalized.sportmonks_id },
                        normalized,
                        { upsert: true, new: true }
                    );
                    
                    console.log(`✅ Processed: ${normalized.teams.home.name} vs ${normalized.teams.away.name}`);
                } catch (err) {
                    console.error(`❌ Error processing fixture ${fixture.id}:`, err.message);
                }
            }
            
        } catch (apiError) {
            console.error('❌ Error fetching fixtures from API:', apiError.message);
        }
        
        console.log('✅ Manual sync completed successfully');
        
        // Now let's check if Southampton has matches today
        console.log('\n🔍 Checking Southampton matches for today...');
        
        const southamptonMatches = await Match.find({
            date: { $regex: `^${targetDate}` },
            $or: [
                { 'teams.home.name': /southampton/i },
                { 'teams.away.name': /southampton/i }
            ]
        }).populate('teams.home teams.away');
        
        console.log(`Found ${southamptonMatches.length} Southampton matches for today:`);
        southamptonMatches.forEach(match => {
            console.log(`- ${match.teams.home.name} vs ${match.teams.away.name} (${match.competition_name || 'Unknown'}) at ${match.time || 'TBD'}`);
            if (match.match_info?.stage) {
                console.log(`  Stage: ${match.match_info.stage.name}`);
            }
            if (match.match_info?.round) {
                console.log(`  Round: ${match.match_info.round.name}`);
            }
        });
        
        // Update Southampton's next match if we found FA Cup fixtures
        if (southamptonMatches.length > 0) {
            console.log('\n🔄 Updating Southampton team record...');
            const southampton = await Team.findOne({ name: /southampton/i });
            if (southampton) {
                console.log(`Current next_match: ${southampton.next_match}`);
                
                // Find the earliest match today
                const nextMatch = southamptonMatches.sort((a, b) => new Date(a.date) - new Date(b.date))[0];
                southampton.next_match = nextMatch._id;
                await southampton.save();
                
                console.log(`✅ Updated Southampton's next_match to: ${nextMatch._id}`);
                console.log(`Match: ${nextMatch.teams.home.name} vs ${nextMatch.teams.away.name}`);
            } else {
                console.log('❌ Southampton team not found in database');
            }
        }
        
    } catch (error) {
        console.error('❌ Error during manual sync:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
        process.exit();
    }
}

manualSouthamptonSync();