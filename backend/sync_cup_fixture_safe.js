const mongoose = require('mongoose');
const { get } = require('./utils/sportmonks');
const Match = require('./models/Match');
const Team = require('./models/Team');
const { normaliseCupFixture } = require('./utils/normaliseCupFixture');

async function syncSouthamptonCupFixture() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay');
        console.log('✅ Connected to MongoDB');

        console.log('⚽ Fetching Southampton FA Cup fixture (ID: 19615714)...');
        
        const fixtureResponse = await get('/fixtures/19615714', {
            include: 'participants'
        });
        
        const cupFixture = fixtureResponse?.data?.data;
        if (!cupFixture) {
            console.log('❌ Cup fixture not found in API response');
            return;
        }
        
        console.log('📋 Cup fixture data received:');
        console.log(`- Name: ${cupFixture.name}`);
        console.log(`- Date: ${cupFixture.starting_at}`);
        console.log(`- League ID: ${cupFixture.league_id}`);
        console.log(`- Stage ID: ${cupFixture.stage_id}`);
        console.log(`- Participants: ${cupFixture.participants?.length || 0}`);
        
        if (cupFixture.participants) {
            cupFixture.participants.forEach(p => {
                console.log(`  - ${p.name} (${p.meta?.location}, SportMonks ID: ${p.id})`);
            });
        }

        // Use the dedicated cup fixture normalization
        console.log('🔄 Normalizing cup fixture...');
        const normalizedCup = normaliseCupFixture(cupFixture);
        
        if (!normalizedCup) {
            console.log('❌ Failed to normalize cup fixture');
            return;
        }
        
        console.log('✅ Cup fixture normalized successfully:');
        console.log(`- Match ID: ${normalizedCup.match_id}`);
        console.log(`- Competition: ${normalizedCup.competition_name}`);
        console.log(`- Home: ${normalizedCup.teams.home.name}`);
        console.log(`- Away: ${normalizedCup.teams.away.name}`);
        
        // Now map to actual team records in database
        console.log('🔍 Mapping to database team records...');
        
        // Find Southampton by SportMonks ID first, then by name
        let southamptonTeam = await Team.findOne({ team_id: normalizedCup.teams.away.sportmonks_id });
        if (!southamptonTeam) {
            southamptonTeam = await Team.findOne({ name: { $regex: 'southampton', $options: 'i' } });
        }
        
        // Find Doncaster by SportMonks ID first, then by name  
        let doncasterTeam = await Team.findOne({ team_id: normalizedCup.teams.home.sportmonks_id });
        if (!doncasterTeam) {
            doncasterTeam = await Team.findOne({ name: { $regex: 'doncaster', $options: 'i' } });
        }
        
        if (southamptonTeam) {
            console.log(`✅ Found Southampton: ${southamptonTeam.name} (${southamptonTeam._id})`);
            normalizedCup.teams.away.id = southamptonTeam._id;
            normalizedCup.teams.away.logo = southamptonTeam.logo || normalizedCup.teams.away.logo;
        } else {
            console.log('⚠️  Southampton team not found in database - will use placeholder ID');
        }
        
        if (doncasterTeam) {
            console.log(`✅ Found Doncaster: ${doncasterTeam.name} (${doncasterTeam._id})`);
            normalizedCup.teams.home.id = doncasterTeam._id;
            normalizedCup.teams.home.logo = doncasterTeam.logo || normalizedCup.teams.home.logo;
        } else {
            console.log('⚠️  Doncaster team not found in database - will use placeholder ID');
        }

        // Save the cup fixture
        console.log('💾 Saving cup fixture to database...');
        const savedMatch = await Match.findOneAndUpdate(
            { match_id: normalizedCup.match_id },
            normalizedCup,
            { upsert: true, new: true }
        );
        
        console.log('✅ Cup fixture saved successfully:');
        console.log(`- Database ID: ${savedMatch._id}`);
        console.log(`- Match: ${savedMatch.teams.home.name} vs ${savedMatch.teams.away.name}`);
        console.log(`- Date: ${savedMatch.date}`);
        console.log(`- Competition: ${savedMatch.competition_name}`);

        // Update Southampton's next_match if this is today's match
        if (southamptonTeam) {
            const matchDate = new Date(savedMatch.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            if (matchDate >= today && matchDate < tomorrow) {
                console.log('📅 This is today\'s match - updating Southampton\'s next_match...');
                console.log(`Previous next_match: ${southamptonTeam.next_match}`);
                
                southamptonTeam.next_match = savedMatch._id;
                await southamptonTeam.save();
                
                console.log(`✅ Updated Southampton's next_match to: ${savedMatch._id}`);
            } else {
                console.log('📅 Match is not today - keeping current next_match');
            }
        }
        
        console.log('\n🎉 Cup fixture sync completed successfully!');
        console.log('🌐 Southampton\'s FA Cup match is now available for frontend testing');

    } catch (error) {
        console.error('❌ Error during cup fixture sync:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
        process.exit();
    }
}

syncSouthamptonCupFixture();