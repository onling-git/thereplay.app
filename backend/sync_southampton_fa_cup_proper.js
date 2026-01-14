const mongoose = require('mongoose');
const { get } = require('./utils/sportmonks');
const Match = require('./models/Match');
const Team = require('./models/Team');

// Cup-specific fixture normalization function
function normalizeCupFixture(fixture) {
    if (!fixture) return null;

    const match_id = Number(fixture.id);
    const date = fixture.starting_at ? new Date(fixture.starting_at + 'Z') : new Date();
    
    // Extract participants
    const participants = fixture.participants || [];
    const home = participants.find(p => p.meta?.location === 'home');
    const away = participants.find(p => p.meta?.location === 'away');
    
    return {
        match_id: match_id,
        date: date,
        time: date.toISOString().substr(11, 5), // Extract HH:MM
        status: 'NS', // Not Started
        league_id: fixture.league_id || 24,
        season_id: fixture.season_id,
        teams: {
            home: {
                team_name: home?.name || 'Unknown',
                team_id: home?.id || null,
                team_slug: home?.name ? home.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : ''
            },
            away: {
                team_name: away?.name || 'Unknown',
                team_id: away?.id || null,
                team_slug: away?.name ? away.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : ''
            }
        },
        match_info: {
            league: {
                id: fixture.league_id || 24,
                name: 'FA Cup',
                short_code: 'FAC',
                image_path: 'https://cdn.sportmonks.com/images/soccer/leagues/24.png'
            },
            stage: {
                id: fixture.stage_id,
                name: 'Round 3', // From the API data you provided
                type: 'cup'
            }
        },
        venue: {
            id: fixture.venue_id || null,
            name: 'TBD',
            city: 'TBD'
        },
        events: [],
        scores: {
            home: null,
            away: null
        },
        participants: participants.map(p => ({
            id: p.id,
            name: p.name,
            meta: p.meta
        }))
    };
}

async function syncSouthamptonFACupProper() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay');
        console.log('✅ Connected to MongoDB');

        // Fetch the specific Southampton FA Cup fixture
        console.log('⚽ Fetching Southampton FA Cup fixture (ID: 19615714)...');
        
        const fixtureData = await get('/fixtures/19615714', {
            include: 'participants'
        });
        
        const fixture = fixtureData?.data?.data;
        if (!fixture) {
            console.log('❌ Fixture not found');
            return;
        }
        
        console.log(`📊 Found fixture: ${fixture.name}`);
        console.log(`🏆 Competition: FA Cup (League ID: ${fixture.league_id})`);
        console.log(`📅 Date: ${fixture.starting_at}`);
        
        // Normalize using cup-specific function
        console.log('💾 Normalizing cup fixture...');
        const normalized = normalizeCupFixture(fixture);
        
        console.log(`✅ Normalized: ${normalized.teams.home.team_name} vs ${normalized.teams.away.team_name}`);
        console.log(`   Date: ${normalized.date}`);
        console.log(`   Time: ${normalized.time}`);
        
        // Save the match
        const savedMatch = await Match.findOneAndUpdate(
            { match_id: normalized.match_id },
            normalized,
            { upsert: true, new: true }
        );
        
        console.log(`✅ Saved match with ID: ${savedMatch._id}`);
        
        // Find Southampton team using the correct field (id: 65)
        console.log('\n🔍 Finding Southampton team...');
        const southampton = await Team.findOne({ id: 65 });
        
        if (southampton) {
            console.log(`✅ Found Southampton: ${southampton.name}`);
            console.log(`   Current next_match: ${southampton.next_match}`);
            
            // Check if this FA Cup match is today
            const matchDate = new Date(savedMatch.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            if (matchDate >= today && matchDate < tomorrow) {
                console.log('🎯 This is today\'s match - updating next_match reference');
                
                // Update next_match to the FA Cup fixture
                southampton.next_match = savedMatch.match_id; // Use match_id (number) not ObjectId
                await southampton.save();
                
                console.log(`✅ Updated Southampton's next_match to: ${savedMatch.match_id}`);
                console.log(`   Match: ${normalized.teams.home.team_name} vs ${normalized.teams.away.team_name}`);
                
                // Verify the update
                const updatedSouthampton = await Team.findOne({ id: 65 });
                console.log(`🔍 Verification - Southampton's next_match is now: ${updatedSouthampton.next_match}`);
                
            } else {
                console.log(`📅 Match is on ${matchDate.toDateString()}, not today - keeping current next_match`);
            }
            
        } else {
            console.log('❌ Southampton team not found (id: 65)');
        }
        
        // Final verification - check Southampton matches for today
        console.log('\n🔍 Final check - Southampton matches today:');
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        
        const todayMatches = await Match.find({
            date: { 
                $gte: todayStart,
                $lt: todayEnd
            },
            $or: [
                { 'teams.home.team_name': /southampton/i },
                { 'teams.away.team_name': /southampton/i }
            ]
        });
        
        console.log(`📋 Found ${todayMatches.length} Southampton matches for today:`);
        todayMatches.forEach(match => {
            console.log(`- ${match.teams.home.team_name} vs ${match.teams.away.team_name}`);
            console.log(`  Competition: ${match.match_info?.league?.name || 'Unknown'}`);
            console.log(`  Match ID: ${match.match_id} (DB ID: ${match._id})`);
            console.log(`  Date: ${match.date}`);
        });
        
        console.log('\n🎉 Success! Southampton\'s FA Cup fixture is ready for frontend testing.');
        
    } catch (error) {
        console.error('❌ Error during sync:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
        process.exit();
    }
}

syncSouthamptonFACupProper();