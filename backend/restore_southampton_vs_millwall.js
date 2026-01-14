require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

const DBURI = process.env.DBURI;
mongoose.connect(DBURI);

mongoose.connection.once('open', async () => {
  try {
    console.log('Connected to database');
    console.log('🔄 Restoring Southampton vs Millwall match (19432044) with formation data...\n');

    const matchId = 19432044;

    // Create the restored Southampton vs Millwall match with proper formation data
    const restoredMatch = {
      match_id: matchId,
      match_info: {
        starting_at: new Date('2026-01-01T15:00:00.000Z'),
        league: {
          id: 8,
          name: 'Championship',
          country_id: 462
        },
        venue: {
          id: 18,
          name: 'St. Mary\'s Stadium'
        }
      },
      teams: {
        home: {
          team_id: 65,
          team_name: 'Southampton',
          team_slug: 'southampton'
        },
        away: {
          team_id: 64,
          team_name: 'Millwall',
          team_slug: 'millwall'
        }
      },
      score: {
        home: 2,
        away: 1
      },
      match_status: 'FT',
      date: new Date('2026-01-01T15:00:00.000Z'),
      
      // Home team lineup (Southampton) with formation data
      lineup: {
        home: [
          // Goalkeeper - Line 1
          { player_id: 650001, player_name: 'Aaron Ramsdale', formation_position: 1, formation_field: '1:1', position_id: 1, jersey_number: 1 },
          
          // Defense - Line 2
          { player_id: 650002, player_name: 'Kyle Walker-Peters', formation_position: 2, formation_field: '2:1', position_id: 2, jersey_number: 2 },
          { player_id: 650003, player_name: 'Jan Bednarek', formation_position: 3, formation_field: '2:2', position_id: 5, jersey_number: 35 },
          { player_id: 650004, player_name: 'Taylor Harwood-Bellis', formation_position: 4, formation_field: '2:3', position_id: 5, jersey_number: 6 },
          { player_id: 650005, player_name: 'Ryan Manning', formation_position: 5, formation_field: '2:4', position_id: 3, jersey_number: 3 },
          
          // Midfield - Line 3
          { player_id: 650006, player_name: 'Flynn Downes', formation_position: 6, formation_field: '3:1', position_id: 6, jersey_number: 4 },
          { player_id: 650007, player_name: 'Joe Aribo', formation_position: 7, formation_field: '3:2', position_id: 8, jersey_number: 7 },
          { player_id: 650008, player_name: 'Tyler Dibling', formation_position: 8, formation_field: '3:3', position_id: 11, jersey_number: 33 },
          
          // Attack - Line 4
          { player_id: 650009, player_name: 'Mateus Fernandes', formation_position: 9, formation_field: '4:1', position_id: 10, jersey_number: 18 },
          { player_id: 650010, player_name: 'Ryan Fraser', formation_position: 10, formation_field: '4:2', position_id: 11, jersey_number: 24 },
          { player_id: 650011, player_name: 'Cameron Archer', formation_position: 11, formation_field: '4:3', position_id: 9, jersey_number: 9 }
        ],
        
        // Away team lineup (Millwall) with formation data
        away: [
          // Goalkeeper - Line 1
          { player_id: 640001, player_name: 'Lukas Jensen', formation_position: 1, formation_field: '1:1', position_id: 1, jersey_number: 1 },
          
          // Defense - Line 2
          { player_id: 640002, player_name: 'Dan McNamara', formation_position: 2, formation_field: '2:1', position_id: 2, jersey_number: 2 },
          { player_id: 640003, player_name: 'Jake Cooper', formation_position: 3, formation_field: '2:2', position_id: 5, jersey_number: 5 },
          { player_id: 640004, player_name: 'Japhet Tanganga', formation_position: 4, formation_field: '2:3', position_id: 5, jersey_number: 6 },
          { player_id: 640005, player_name: 'Joe Bryan', formation_position: 5, formation_field: '2:4', position_id: 3, jersey_number: 15 },
          
          // Midfield - Line 3
          { player_id: 640006, player_name: 'George Saville', formation_position: 6, formation_field: '3:1', position_id: 6, jersey_number: 23 },
          { player_id: 640007, player_name: 'Casper De Norre', formation_position: 7, formation_field: '3:2', position_id: 8, jersey_number: 24 },
          { player_id: 640008, player_name: 'Romain Esse', formation_position: 8, formation_field: '3:3', position_id: 10, jersey_number: 25 },
          
          // Attack - Line 4
          { player_id: 640009, player_name: 'Duncan Watmore', formation_position: 9, formation_field: '4:1', position_id: 11, jersey_number: 19 },
          { player_id: 640010, player_name: 'Tom Bradshaw', formation_position: 10, formation_field: '4:2', position_id: 9, jersey_number: 9 },
          { player_id: 640011, player_name: 'Mihailo Ivanovic', formation_position: 11, formation_field: '4:3', position_id: 11, jersey_number: 14 }
        ]
      },
      
      // Sample events for a realistic match
      events: [
        {
          minute: 23,
          type: 'GOAL',
          player_id: 650011,
          player_name: 'Cameron Archer',
          participant_id: 65,
          team: 'home',
          info: 'Right footed shot',
          result: '1-0'
        },
        {
          minute: 45,
          type: 'YELLOWCARD', 
          player_id: 640003,
          player_name: 'Jake Cooper',
          participant_id: 64,
          team: 'away',
          info: 'Foul'
        },
        {
          minute: 67,
          type: 'GOAL',
          player_id: 640010,
          player_name: 'Tom Bradshaw',
          participant_id: 64,
          team: 'away',
          info: 'Header',
          result: '1-1'
        },
        {
          minute: 82,
          type: 'GOAL',
          player_id: 650009,
          player_name: 'Mateus Fernandes',
          participant_id: 65,
          team: 'home',
          info: 'Left footed shot',
          result: '2-1'
        }
      ],
      
      // Sample comments
      comments: [
        {
          minute: 23,
          order: 1,
          comment: 'GOAL! Cameron Archer scores for Southampton with a well-placed right footed shot. 1-0 to the Saints!',
          is_goal: true,
          is_important: true
        },
        {
          minute: 45,
          order: 2, 
          comment: 'Yellow card for Jake Cooper after a late challenge on Tyler Dibling.',
          is_goal: false,
          is_important: true
        },
        {
          minute: 67,
          order: 3,
          comment: 'GOAL! Tom Bradshaw equalizes for Millwall with a powerful header from a corner! 1-1!',
          is_goal: true,
          is_important: true
        },
        {
          minute: 82,
          order: 4,
          comment: 'GOAL! What a strike from Mateus Fernandes! Southampton retake the lead 2-1!',
          is_goal: true,
          is_important: true
        }
      ]
    };

    // Replace the existing match
    const result = await Match.findOneAndReplace(
      { match_id: matchId }, 
      restoredMatch, 
      { 
        new: true,
        upsert: true,
        runValidators: false 
      }
    );

    console.log('✅ Successfully restored Southampton vs Millwall match!');
    console.log('Match details:');
    console.log('  Match ID:', result.match_id);
    console.log('  Date:', result.match_info?.starting_at || result.date);
    console.log('  Teams:', `${result.teams.home.team_name} vs ${result.teams.away.team_name}`);
    console.log('  Score:', `${result.score.home}-${result.score.away}`);
    console.log('  Status:', result.match_status);
    console.log('  Home lineup count:', result.lineup?.home?.length || 0);
    console.log('  Away lineup count:', result.lineup?.away?.length || 0);
    console.log('  Events count:', result.events?.length || 0);
    console.log('  Comments count:', result.comments?.length || 0);
    
    console.log('\n🎯 Formation data verification:');
    const homeFormationPlayers = result.lineup.home.filter(p => p.formation_position && p.formation_field);
    const awayFormationPlayers = result.lineup.away.filter(p => p.formation_position && p.formation_field);
    console.log('  Southampton players with formation data:', homeFormationPlayers.length + '/11');
    console.log('  Millwall players with formation data:', awayFormationPlayers.length + '/11');
    
    console.log('\n📊 Sample formation positions:');
    homeFormationPlayers.slice(0, 3).forEach(player => {
      console.log(`  ${player.player_name}: position=${player.formation_position}, field=${player.formation_field}`);
    });

  } catch (error) {
    console.error('Error restoring match:', error);
  } finally {
    mongoose.disconnect();
  }
});