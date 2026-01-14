require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Match = require('./models/Match');
const Team = require('./models/Team');
const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');

async function syncFACupFixturesToday() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.DBURI);
        console.log('Connected to MongoDB');

        // Format today's date as YYYY-MM-DD
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        console.log('Fetching FA Cup fixtures for:', dateStr);

        // Fetch all fixtures for today from SportMonks API, then filter for FA Cup
        const response = await axios.get(
            `${process.env.SPORTMONKS_BASE}/fixtures/date/${dateStr}`,
            {
                params: {
                    api_token: process.env.SPORTMONKS_API_KEY
                }
            }
        );

        const allFixtures = response.data.data;
        console.log(`Found ${allFixtures.length} total fixtures for today`);
        
        // Filter for FA Cup fixtures (league_id: 24)
        const fixtures = allFixtures.filter(fixture => fixture.league_id === 24);
        console.log(`Found ${fixtures.length} FA Cup fixtures after filtering`);

        if (fixtures.length === 0) {
            console.log('No FA Cup fixtures found for today');
            return;
        }

        // Process each fixture
        for (const fixture of fixtures) {
            console.log(`Processing fixture: ${fixture.name}`);
            
            // Normalize the fixture data
            const normalizedFixture = normaliseFixtureToMatchDoc(fixture);
            
            // Check if match already exists
            const existingMatch = await Match.findOne({ id: normalizedFixture.id });
            
            if (existingMatch) {
                console.log(`Match ${normalizedFixture.id} already exists, updating...`);
                await Match.updateOne({ id: normalizedFixture.id }, normalizedFixture);
            } else {
                console.log(`Creating new match ${normalizedFixture.id}...`);
                const newMatch = new Match(normalizedFixture);
                await newMatch.save();
            }

            // Update team next_match references for teams in this fixture
            for (const participant of normalizedFixture.participants) {
                const team = await Team.findOne({ id: participant.id });
                if (team) {
                    console.log(`Updating next_match for ${team.name} (ID: ${team.id}) to match ${normalizedFixture.id}`);
                    await Team.updateOne(
                        { id: participant.id },
                        { next_match: normalizedFixture.id }
                    );
                }
            }
        }

        console.log('FA Cup fixture sync completed successfully');
        
        // Let's specifically check Southampton's next match after sync
        const southampton = await Team.findOne({ id: 65 });
        if (southampton) {
            console.log(`Southampton's next_match is now: ${southampton.next_match}`);
        }
        
    } catch (error) {
        console.error('Error syncing FA Cup fixtures:', error.response?.data || error.message);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

syncFACupFixturesToday();