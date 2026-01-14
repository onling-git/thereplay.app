const mongoose = require('mongoose');
const Match = require('./models/Match');
const Team = require('./models/Team');

async function createTestSouthamptonFACupMatch() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay');
        console.log('✅ Connected to MongoDB');

        // First, let's find Southampton's team record
        console.log('🔍 Finding Southampton team...');
        const southampton = await Team.findOne({ name: /southampton/i });
        
        if (!southampton) {
            console.log('❌ Southampton team not found');
            return;
        }
        
        console.log(`✅ Found Southampton: ${southampton.name} (ID: ${southampton._id})`);
        
        // Create a test FA Cup match for today
        const testMatch = {
            sportmonks_id: 99999999, // Test ID
            date: '2026-01-10T15:00:00.000Z',
            time: '15:00',
            competition_name: 'FA Cup',
            competition_logo: 'https://cdn.sportmonks.com/images/soccer/leagues/24.png',
            teams: {
                home: {
                    id: southampton._id,
                    name: southampton.name,
                    logo: southampton.logo || ''
                },
                away: {
                    id: new mongoose.Types.ObjectId(), // Test opponent ID
                    name: 'Swansea City',
                    logo: 'https://cdn.sportmonks.com/images/soccer/teams/314.png'
                }
            },
            match_info: {
                stage: {
                    id: 274,
                    name: 'Third Round',
                    type: 'cup'
                },
                round: {
                    id: 2741,
                    name: 'Third Round'
                }
            },
            status: 'NS', // Not Started
            venue: {
                name: 'St. Mary\'s Stadium',
                city: 'Southampton'
            }
        };

        console.log('🏆 Creating test FA Cup match...');
        const createdMatch = await Match.findOneAndUpdate(
            { sportmonks_id: testMatch.sportmonks_id },
            testMatch,
            { upsert: true, new: true }
        );
        
        console.log(`✅ Created match: ${testMatch.teams.home.name} vs ${testMatch.teams.away.name}`);
        console.log(`   Stage: ${testMatch.match_info.stage.name}`);
        console.log(`   Match ID: ${createdMatch._id}`);
        
        // Update Southampton's next_match reference
        console.log('🔄 Updating Southampton next_match reference...');
        southampton.next_match = createdMatch._id;
        await southampton.save();
        
        console.log(`✅ Updated Southampton's next_match to: ${createdMatch._id}`);
        
        // Verify the update
        console.log('\n🔍 Verifying Southampton matches for today...');
        const todayMatches = await Match.find({
            date: { 
                $gte: new Date('2026-01-10T00:00:00.000Z'),
                $lt: new Date('2026-01-11T00:00:00.000Z')
            },
            $or: [
                { 'teams.home.id': southampton._id },
                { 'teams.away.id': southampton._id }
            ]
        });
        
        console.log(`Found ${todayMatches.length} Southampton matches for today:`);
        todayMatches.forEach(match => {
            console.log(`- ${match.teams.home.name} vs ${match.teams.away.name} (${match.competition_name || 'Unknown'})`);
            console.log(`  Match ID: ${match._id}`);
            if (match.match_info?.stage) {
                console.log(`  Stage: ${match.match_info.stage.name}`);
            }
        });
        
        console.log('\n✅ Manual Southampton FA Cup fixture created successfully!');
        console.log('🌐 You can now test the frontend - Southampton should show today\'s FA Cup match');
        
    } catch (error) {
        console.error('❌ Error during manual fixture creation:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
        process.exit();
    }
}

createTestSouthamptonFACupMatch();