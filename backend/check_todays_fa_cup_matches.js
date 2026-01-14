require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');
const Team = require('./models/Team');

async function checkTodaysFACupFixtures() {
    try {
        // Connect to MongoDB
        console.log('Connected to MongoDB');
        await mongoose.connect(process.env.DBURI);

        console.log('🏆 Checking today\'s FA Cup fixtures in database...');
        
        // Find all matches for today
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        
        const todaysMatches = await Match.find({
            date: {
                $gte: startOfDay,
                $lt: endOfDay
            },
            competition_name: { $regex: /cup/i }
        }).populate('teams.home teams.away');
        
        console.log(`\nFound ${todaysMatches.length} cup matches for today:`);
        todaysMatches.forEach(match => {
            console.log(`- ${match.teams.home.name || match.teams.home} vs ${match.teams.away.name || match.teams.away}`);
            console.log(`  Competition: ${match.competition_name}`);
            console.log(`  Date: ${match.date}`);
            console.log(`  Match ID: ${match._id}`);
            if (match.match_info?.stage) {
                console.log(`  Stage: ${match.match_info.stage.name}`);
            }
            console.log('');
        });
        
        // Check Southampton specifically
        console.log('🔍 Checking Southampton team record...');
        const southampton = await Team.findOne({ name: /southampton/i });
        
        if (southampton) {
            console.log(`Southampton found: ${southampton.name} (ID: ${southampton._id})`);
            console.log(`Next match: ${southampton.next_match}`);
            
            if (southampton.next_match) {
                const nextMatch = await Match.findById(southampton.next_match);
                if (nextMatch) {
                    console.log(`Next match details: ${nextMatch.teams.home.name || nextMatch.teams.home} vs ${nextMatch.teams.away.name || nextMatch.teams.away}`);
                    console.log(`Date: ${nextMatch.date}`);
                    console.log(`Competition: ${nextMatch.competition_name}`);
                }
            }
        } else {
            console.log('❌ Southampton team not found');
        }
        
        // Check if there are any matches involving Southampton today
        console.log('\n🔍 Searching for any Southampton matches today...');
        const southamptonMatches = await Match.find({
            date: {
                $gte: startOfDay,
                $lt: endOfDay
            },
            $or: [
                { 'teams.home.name': { $regex: /southampton/i } },
                { 'teams.away.name': { $regex: /southampton/i } },
                { 'teams.home': { $regex: /southampton/i } },
                { 'teams.away': { $regex: /southampton/i } }
            ]
        });
        
        console.log(`Found ${southamptonMatches.length} Southampton matches today:`);
        southamptonMatches.forEach(match => {
            console.log(`- ${match.teams.home.name || match.teams.home} vs ${match.teams.away.name || match.teams.away}`);
            console.log(`  Competition: ${match.competition_name}`);
            console.log(`  Date: ${match.date}`);
        });
        
    } catch (error) {
        console.error('Error checking fixtures:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

checkTodaysFACupFixtures();