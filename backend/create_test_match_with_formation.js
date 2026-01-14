// create_test_match_with_formation.js
// Create a test match with proper formation data for testing the frontend

const mongoose = require('mongoose');
const Match = require('./models/Match');

async function createTestMatch() {
  require('dotenv').config();
  const uri = process.env.DBURI || process.env.MONGODB_URI || "mongodb://localhost:27017/thefinalplay";
  await mongoose.connect(uri);
  console.log('📊 Connected to database:', uri.substring(0, 50) + '...');

  try {
    const testMatchDoc = {
      match_id: 19432044,
      teams: {
        home: {
          team_id: 496,
          team_name: "Manchester United",
          team_slug: "manchester-united"
        },
        away: {
          team_id: 505,
          team_name: "Arsenal",
          team_slug: "arsenal"
        }
      },
      score: { home: 2, away: 1 },
      match_status: "FT",
      match_info: {
        starting_at: "2025-01-02T15:00:00Z"
      },
      events: [
        {
          type: "GOAL",
          minute: 23,
          player_name: "Marcus Rashford",
          participant_id: 496,
          team: "home"
        },
        {
          type: "YELLOWCARD", 
          minute: 35,
          player_name: "Declan Rice",
          participant_id: 505,
          team: "away"
        }
      ],
      comments: [
        {
          comment: "Marcus Rashford scores a brilliant goal!",
          minute: 23,
          is_goal: true,
          order: 1
        }
      ],
      // Proper formation data based on SportMonks structure
      lineup: {
        home: [
          // Goalkeeper (formation line 1)
          {
            player_id: 1001,
            player_name: "Andre Onana",
            jersey_number: 24,
            position_id: 1,
            formation_position: 1,
            formation_field: "1:1",
            image_path: null,
            position_name: "Goalkeeper",
            rating: 7.2
          },
          // Defense (formation line 2)
          {
            player_id: 1002,
            player_name: "Diogo Dalot",
            jersey_number: 20,
            position_id: 2,
            formation_position: 2,
            formation_field: "2:1",
            image_path: null,
            position_name: "Right Back",
            rating: 7.1
          },
          {
            player_id: 1003,
            player_name: "Harry Maguire",
            jersey_number: 5,
            position_id: 3,
            formation_position: 3,
            formation_field: "2:2",
            image_path: null,
            position_name: "Centre Back",
            rating: 6.8
          },
          {
            player_id: 1004,
            player_name: "Lisandro Martinez",
            jersey_number: 6,
            position_id: 3,
            formation_position: 4,
            formation_field: "2:3",
            image_path: null,
            position_name: "Centre Back",
            rating: 7.3
          },
          {
            player_id: 1005,
            player_name: "Luke Shaw",
            jersey_number: 23,
            position_id: 2,
            formation_position: 5,
            formation_field: "2:4",
            image_path: null,
            position_name: "Left Back",
            rating: 6.9
          },
          // Midfield (formation line 3)
          {
            player_id: 1006,
            player_name: "Casemiro",
            jersey_number: 18,
            position_id: 6,
            formation_position: 6,
            formation_field: "3:1",
            image_path: null,
            position_name: "Defensive Midfielder",
            rating: 7.0
          },
          {
            player_id: 1007,
            player_name: "Bruno Fernandes",
            jersey_number: 8,
            position_id: 7,
            formation_position: 7,
            formation_field: "3:2",
            image_path: null,
            position_name: "Central Midfielder",
            rating: 8.1
          },
          {
            player_id: 1008,
            player_name: "Mason Mount",
            jersey_number: 7,
            position_id: 7,
            formation_position: 8,
            formation_field: "3:3",
            image_path: null,
            position_name: "Central Midfielder",
            rating: 6.7
          },
          // Attack (formation line 4)
          {
            player_id: 1009,
            player_name: "Antony",
            jersey_number: 21,
            position_id: 9,
            formation_position: 9,
            formation_field: "4:1",
            image_path: null,
            position_name: "Right Winger",
            rating: 6.5
          },
          {
            player_id: 1010,
            player_name: "Marcus Rashford",
            jersey_number: 10,
            position_id: 10,
            formation_position: 10,
            formation_field: "4:2",
            image_path: null,
            position_name: "Striker",
            rating: 8.5
          },
          {
            player_id: 1011,
            player_name: "Alejandro Garnacho",
            jersey_number: 17,
            position_id: 9,
            formation_position: 11,
            formation_field: "4:3",
            image_path: null,
            position_name: "Left Winger",
            rating: 7.4
          }
        ],
        away: [
          // Arsenal lineup with formation data
          {
            player_id: 2001,
            player_name: "David Raya",
            jersey_number: 22,
            position_id: 1,
            formation_position: 1,
            formation_field: "1:1",
            image_path: null,
            position_name: "Goalkeeper",
            rating: 6.8
          },
          {
            player_id: 2002,
            player_name: "Ben White",
            jersey_number: 4,
            position_id: 2,
            formation_position: 2,
            formation_field: "2:1",
            image_path: null,
            position_name: "Right Back",
            rating: 7.0
          },
          {
            player_id: 2003,
            player_name: "William Saliba",
            jersey_number: 2,
            position_id: 3,
            formation_position: 3,
            formation_field: "2:2",
            image_path: null,
            position_name: "Centre Back",
            rating: 7.2
          },
          {
            player_id: 2004,
            player_name: "Gabriel",
            jersey_number: 6,
            position_id: 3,
            formation_position: 4,
            formation_field: "2:3",
            image_path: null,
            position_name: "Centre Back",
            rating: 6.9
          },
          {
            player_id: 2005,
            player_name: "Oleksandr Zinchenko",
            jersey_number: 35,
            position_id: 2,
            formation_position: 5,
            formation_field: "2:4",
            image_path: null,
            position_name: "Left Back",
            rating: 6.6
          },
          {
            player_id: 2006,
            player_name: "Declan Rice",
            jersey_number: 41,
            position_id: 6,
            formation_position: 6,
            formation_field: "3:1",
            image_path: null,
            position_name: "Defensive Midfielder",
            rating: 6.8
          },
          {
            player_id: 2007,
            player_name: "Martin Odegaard",
            jersey_number: 8,
            position_id: 7,
            formation_position: 7,
            formation_field: "3:2",
            image_path: null,
            position_name: "Attacking Midfielder",
            rating: 7.5
          },
          {
            player_id: 2008,
            player_name: "Bukayo Saka",
            jersey_number: 7,
            position_id: 9,
            formation_position: 8,
            formation_field: "4:1",
            image_path: null,
            position_name: "Right Winger",
            rating: 7.3
          },
          {
            player_id: 2009,
            player_name: "Kai Havertz",
            jersey_number: 29,
            position_id: 10,
            formation_position: 9,
            formation_field: "4:2",
            image_path: null,
            position_name: "Striker",
            rating: 6.4
          },
          {
            player_id: 2010,
            player_name: "Gabriel Martinelli",
            jersey_number: 11,
            position_id: 9,
            formation_position: 10,
            formation_field: "4:3",
            image_path: null,
            position_name: "Left Winger",
            rating: 7.1
          },
          {
            player_id: 2011,
            player_name: "Thomas Partey",
            jersey_number: 5,
            position_id: 6,
            formation_position: 11,
            formation_field: "3:3",
            image_path: null,
            position_name: "Central Midfielder",
            rating: 6.7
          }
        ]
      },
      // Also populate player_ratings for compatibility
      player_ratings: [
        { player_id: 1010, player_name: "Marcus Rashford", rating: 8.5 },
        { player_id: 1007, player_name: "Bruno Fernandes", rating: 8.1 },
        { player_id: 2007, player_name: "Martin Odegaard", rating: 7.5 },
        // ... more ratings
      ]
    };

    console.log('📝 Creating test match with formation data...');
    
    const savedMatch = await Match.findOneAndUpdate(
      { match_id: 19432044 },
      testMatchDoc,
      { upsert: true, new: true }
    );

    console.log('✅ Test match created successfully!');
    console.log(`   Match ID: ${savedMatch.match_id}`);
    console.log(`   Teams: ${savedMatch.teams.home.team_name} vs ${savedMatch.teams.away.team_name}`);
    console.log(`   Home lineup: ${savedMatch.lineup.home.length} players`);
    console.log(`   Away lineup: ${savedMatch.lineup.away.length} players`);
    
    // Verify formation data
    const homeWithFormation = savedMatch.lineup.home.filter(p => p.formation_field != null);
    const awayWithFormation = savedMatch.lineup.away.filter(p => p.formation_field != null);
    console.log(`   Formation data: Home(${homeWithFormation.length}/${savedMatch.lineup.home.length}) Away(${awayWithFormation.length}/${savedMatch.lineup.away.length})`);
    
    console.log('\n🎯 You can now test the formation display with:');
    console.log('   - Match ID: 19432044');
    console.log('   - URL: /manchester-united/match/19432044/live');
    console.log('   - Or: /arsenal/match/19432044/live');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

createTestMatch().catch(console.error);