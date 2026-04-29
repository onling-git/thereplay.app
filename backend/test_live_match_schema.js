// Test script to verify live match schema generation
const { generateLiveMatchJsonLd, isMatchLive, isMatchCompleted } = require('./utils/jsonLdSchema');

// Mock match data representing different states
const mockLiveMatch = {
  match_id: 19631550,
  teams: {
    home: {
      team_name: "Southampton FC",
      team_slug: "southampton-fc",
      team_id: 496
    },
    away: {
      team_name: "Arsenal",
      team_slug: "arsenal", 
      team_id: 18
    }
  },
  score: {
    home: 1,
    away: 2
  },
  match_info: {
    starting_at: new Date('2026-01-15T15:30:00Z'),
    venue: {
      name: "St. Mary's Stadium",
      city_name: "Southampton"
    },
    league: {
      id: 39,
      name: "Premier League"
    },
    referee: {
      name: "Michael Oliver"
    }
  },
  match_status: {
    id: 2,
    state: "inplay_2nd_half",
    name: "2nd Half", 
    short_name: "2H"
  },
  minute: 67,
  events: [
    {
      type: "GOAL",
      minute: 23,
      player_name: "Adam Armstrong",
      participant_id: 496,
      team: "home"
    },
    {
      type: "GOAL", 
      minute: 45,
      player_name: "Gabriel Jesus",
      participant_id: 18,
      team: "away"
    },
    {
      type: "GOAL",
      minute: 78,
      player_name: "Martin Odegaard", 
      participant_id: 18,
      team: "away"
    },
    {
      type: "YELLOWCARD",
      minute: 34,
      player_name: "James Ward-Prowse",
      participant_id: 496,
      team: "home"
    }
  ]
};

const mockCompletedMatch = {
  ...mockLiveMatch,
  match_status: {
    id: 5,
    state: "finished",
    name: "Finished",
    short_name: "FT"
  },
  minute: null
};

const mockUpcomingMatch = {
  ...mockLiveMatch,
  match_info: {
    ...mockLiveMatch.match_info,
    starting_at: new Date('2026-01-20T15:00:00Z')
  },
  match_status: {
    id: 1,
    state: "not_started", 
    name: "Not Started",
    short_name: "NS"
  },
  score: null,
  minute: null,
  events: []
};

function testSchemaGeneration() {
  console.log('🧪 Testing Live Match Schema Generation\n');

  // Test live match
  console.log('📺 LIVE MATCH TEST:');
  console.log('Is Live:', isMatchLive(mockLiveMatch));
  console.log('Is Completed:', isMatchCompleted(mockLiveMatch));
  
  const liveSchema = generateLiveMatchJsonLd(
    mockLiveMatch,
    'https://thefinalplay.com/southampton-fc/match/19631550/live',
    'southampton-fc'
  );
  
  console.log('\nGenerated Live Schema:');
  console.log(liveSchema);
  console.log('\n' + '='.repeat(80) + '\n');

  // Test completed match
  console.log('✅ COMPLETED MATCH TEST:');
  console.log('Is Live:', isMatchLive(mockCompletedMatch));
  console.log('Is Completed:', isMatchCompleted(mockCompletedMatch));
  
  const completedSchema = generateLiveMatchJsonLd(
    mockCompletedMatch,
    'https://thefinalplay.com/southampton-fc/match/19631550/live', 
    'southampton-fc'
  );
  
  console.log('\nGenerated Completed Schema:');
  console.log(completedSchema);
  console.log('\n' + '='.repeat(80) + '\n');

  // Test upcoming match
  console.log('⏰ UPCOMING MATCH TEST:');
  console.log('Is Live:', isMatchLive(mockUpcomingMatch));
  console.log('Is Completed:', isMatchCompleted(mockUpcomingMatch));
  
  const upcomingSchema = generateLiveMatchJsonLd(
    mockUpcomingMatch,
    'https://thefinalplay.com/southampton-fc/match/19631550/live',
    'southampton-fc'  
  );
  
  console.log('\nGenerated Upcoming Schema:');
  console.log(upcomingSchema);

  console.log('\n🎉 Schema generation tests completed!');
}

// Run tests
if (require.main === module) {
  testSchemaGeneration();
}

module.exports = { testSchemaGeneration };