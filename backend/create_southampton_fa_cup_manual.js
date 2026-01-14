const mongoose = require('mongoose');
const Match = require('./models/Match');
const Team = require('./models/Team');

async function createSouthamptonFACupMatch() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay');
        console.log('✅ Connected to MongoDB');

        // Find team records
        console.log('🔍 Finding team records...');
        const southampton = await Team.findOne({ name: /southampton/i });
        const doncaster = await Team.findOne({ name: /doncaster/i });
        
        console.log(`Southampton: ${southampton ? southampton.name + ' (ID: ' + southampton._id + ')' : 'NOT FOUND'}`);
        console.log(`Doncaster: ${doncaster ? doncaster.name + ' (ID: ' + doncaster._id + ')' : 'NOT FOUND'}`);

        // Create the match document based on the API response you provided
        const matchData = {
            match_id: 19615714,
            date: new Date('2026-01-10T15:00:00Z'),
            time: '15:00',
            status: 'NS', // Not Started
            competition_name: 'FA Cup',
            competition_logo: 'https://cdn.sportmonks.com/images/soccer/leagues/24.png',
            league_id: 24,
            season_id: 25919,
            teams: {
                home: {
                    id: doncaster ? doncaster._id : new mongoose.Types.ObjectId(),
                    name: 'Doncaster Rovers',
                    logo: doncaster ? doncaster.logo : 'https://cdn.sportmonks.com/images/soccer/teams/11/235.png'
                },
                away: {
                    id: southampton ? southampton._id : new mongoose.Types.ObjectId(),
                    name: 'Southampton',
                    logo: southampton ? southampton.logo : 'https://cdn.sportmonks.com/images/soccer/teams/1/65.png'
                }
            },
            match_info: {
                stage: {
                    id: 77479414,
                    name: 'Round 3',
                    type: 'cup'
                }
            },
            venue: {
                id: 894,
                name: 'Eco-Power Stadium', // Doncaster's stadium
                city: 'Doncaster'
            },
            events: [],
            scores: {
                home: null,
                away: null
            }
        };

        console.log('💾 Creating Southampton FA Cup match...');
        const savedMatch = await Match.findOneAndUpdate(
            { match_id: matchData.match_id },
            matchData,
            { upsert: true, new: true }
        );

        console.log(`✅ Created/Updated match: ${matchData.teams.home.name} vs ${matchData.teams.away.name}`);
        console.log(`   Match ID: ${savedMatch._id}`);
        console.log(`   Competition: ${matchData.competition_name}`);
        console.log(`   Stage: ${matchData.match_info.stage.name}`);
        console.log(`   Date: ${matchData.date}`);

        // Update Southampton's next_match
        if (southampton) {
            console.log('🔄 Updating Southampton next_match reference...');
            console.log(`Current next_match: ${southampton.next_match}`);
            
            southampton.next_match = savedMatch._id;
            await southampton.save();
            
            console.log(`✅ Updated Southampton's next_match to: ${savedMatch._id}`);
        }

        console.log('\n🎉 Success! Southampton\'s FA Cup match is now in the database.');
        console.log('🌐 You can now test the frontend - Southampton should show today\'s FA Cup match');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
        process.exit();
    }
}

createSouthamptonFACupMatch();