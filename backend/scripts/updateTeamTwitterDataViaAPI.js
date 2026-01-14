// scripts/updateTeamTwitterDataViaAPI.js
// Alternative approach using API endpoints instead of direct database access

const axios = require('axios');
const clubReporters = require('../data/clubReporters');

const BASE_URL = process.env.SELF_BASE || 'http://localhost:8000';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

if (!ADMIN_API_KEY) {
  console.error('❌ ADMIN_API_KEY environment variable is required');
  process.exit(1);
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'x-api-key': ADMIN_API_KEY
  },
  timeout: 10000
});

// Team name variations for matching
const teamNameMappings = {
  'Arsenal': ['Arsenal', 'Arsenal FC'],
  'Aston Villa': ['Aston Villa', 'Aston Villa FC'],
  'Bournemouth': ['Bournemouth', 'AFC Bournemouth', 'A.F.C. Bournemouth'],
  'Brentford': ['Brentford', 'Brentford FC'],
  'Brighton & Hove Albion': ['Brighton & Hove Albion', 'Brighton and Hove Albion', 'Brighton', 'Brighton FC'],
  'Chelsea': ['Chelsea', 'Chelsea FC'],
  'Crystal Palace': ['Crystal Palace', 'Crystal Palace FC'],
  'Everton': ['Everton', 'Everton FC'],
  'Fulham': ['Fulham', 'Fulham FC'],
  'Liverpool': ['Liverpool', 'Liverpool FC'],
  'Luton Town': ['Luton Town', 'Luton Town FC'],
  'Manchester City': ['Manchester City', 'Manchester City FC', 'Man City'],
  'Manchester United': ['Manchester United', 'Manchester United FC', 'Man United', 'Man Utd'],
  'Newcastle United': ['Newcastle United', 'Newcastle United FC', 'Newcastle'],
  'Nottingham Forest': ['Nottingham Forest', 'Nottingham Forest FC', 'Nott\'m Forest'],
  'Sheffield United': ['Sheffield United', 'Sheffield United FC', 'Sheff United', 'Sheffield Utd'],
  'Tottenham Hotspur': ['Tottenham Hotspur', 'Tottenham', 'Spurs', 'Tottenham Hotspur FC'],
  'West Ham United': ['West Ham United', 'West Ham', 'West Ham United FC'],
  'Wolverhampton Wanderers': ['Wolverhampton Wanderers', 'Wolves', 'Wolverhampton', 'Wolverhampton Wanderers FC'],
  
  // Championship variations
  'Birmingham City': ['Birmingham City', 'Birmingham City FC', 'Birmingham'],
  'Blackburn Rovers': ['Blackburn Rovers', 'Blackburn Rovers FC', 'Blackburn'],
  'Bristol City': ['Bristol City', 'Bristol City FC'],
  'Charlton Athletic': ['Charlton Athletic', 'Charlton Athletic FC', 'Charlton'],
  'Coventry City': ['Coventry City', 'Coventry City FC', 'Coventry'],
  'Derby County': ['Derby County', 'Derby County FC', 'Derby'],
  'Hull City': ['Hull City', 'Hull City FC', 'Hull'],
  'Ipswich Town': ['Ipswich Town', 'Ipswich Town FC', 'Ipswich'],
  'Leicester City': ['Leicester City', 'Leicester City FC', 'Leicester'],
  'Middlesbrough': ['Middlesbrough', 'Middlesbrough FC', 'Boro'],
  'Millwall': ['Millwall', 'Millwall FC'],
  'Norwich City': ['Norwich City', 'Norwich City FC', 'Norwich'],
  'Oxford United': ['Oxford United', 'Oxford United FC', 'Oxford'],
  'Portsmouth': ['Portsmouth', 'Portsmouth FC', 'Pompey'],
  'Queens Park Rangers': ['Queens Park Rangers', 'QPR', 'Q.P.R.', 'Queens Park Rangers FC'],
  'Reading': ['Reading', 'Reading FC'],
  'Sheffield Wednesday': ['Sheffield Wednesday', 'Sheffield Wednesday FC', 'Sheff Wed'],
  'Southampton': ['Southampton', 'Southampton FC', 'Saints'],
  'Stoke City': ['Stoke City', 'Stoke City FC', 'Stoke'],
  'Sunderland': ['Sunderland', 'Sunderland AFC', 'Sunderland FC'],
  'Watford': ['Watford', 'Watford FC'],
  'West Bromwich Albion': ['West Bromwich Albion', 'West Brom', 'WBA', 'West Bromwich Albion FC'],
  'Wrexham': ['Wrexham', 'Wrexham FC', 'Wrexham AFC']
};

function findMatchingTeam(clubName, teams) {
  // Try exact name match first
  let match = teams.find(team => 
    team.name.toLowerCase() === clubName.toLowerCase()
  );
  
  if (match) return match;
  
  // Try variations
  const variations = teamNameMappings[clubName] || [];
  for (const variation of variations) {
    match = teams.find(team => 
      team.name.toLowerCase() === variation.toLowerCase()
    );
    if (match) return match;
  }
  
  // Try partial matching
  match = teams.find(team => {
    const teamName = team.name.toLowerCase();
    const clubNameLower = clubName.toLowerCase();
    
    return teamName.includes(clubNameLower) || clubNameLower.includes(teamName);
  });
  
  return match;
}

async function updateTeamTwitterData() {
  try {
    console.log('🔄 Fetching teams from API...');
    
    // Get all teams from the API
    const teamsResponse = await api.get('/api/teams');
    const teams = teamsResponse.data;
    
    console.log(`📊 Found ${teams.length} teams via API`);
    
    let updated = 0;
    let notFound = [];
    let errors = [];
    
    // Process each club reporter entry
    for (const clubData of clubReporters) {
      const clubName = clubData.club;
      
      try {
        // Find matching team
        const matchedTeam = findMatchingTeam(clubName, teams);
        
        if (matchedTeam) {
          console.log(`✅ Matched "${clubName}" -> "${matchedTeam.name}" (${matchedTeam.slug})`);
          
          // Since we can't directly update via API (would need a PATCH endpoint),
          // we'll create a script that outputs the update commands or JSON
          
          const updateData = {
            team_id: matchedTeam.id,
            team_slug: matchedTeam.slug,
            team_name: matchedTeam.name,
            twitter_data: {
              reporters: clubData.reporters.map(reporter => ({
                name: reporter.name,
                handle: reporter.handle,
                verified: false,
                last_checked: null
              })),
              hashtag: clubData.hashtag,
              alternative_hashtags: [],
              tweet_fetch_enabled: true
            }
          };
          
          console.log(`📝 Update data for ${matchedTeam.name}:`, JSON.stringify(updateData, null, 2));
          updated++;
          
        } else {
          console.log(`❌ No match found for "${clubName}"`);
          notFound.push(clubName);
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${clubName}:`, error.message);
        errors.push({ club: clubName, error: error.message });
      }
    }
    
    console.log('\n📈 Update Summary:');
    console.log(`✅ Successfully matched: ${updated} teams`);
    console.log(`❌ Not found: ${notFound.length} clubs`);
    console.log(`🔥 Errors: ${errors.length} clubs`);
    
    if (notFound.length > 0) {
      console.log('\n🔍 Clubs not matched:');
      notFound.forEach(club => console.log(`   - ${club}`));
    }
    
    if (errors.length > 0) {
      console.log('\n🔥 Errors encountered:');
      errors.forEach(err => console.log(`   - ${err.club}: ${err.error}`));
    }
    
    console.log('\n💡 Next Steps:');
    console.log('1. Set up TwitterAPI.io account and get API key');
    console.log('2. Add TWITTERAPI_KEY to your environment variables');
    console.log('3. Test tweet collection with: POST /api/tweets/collect/team/:teamSlug');
    console.log('4. Monitor cron job logs for automatic tweet collection');
    
  } catch (error) {
    console.error('❌ Error updating team twitter data:', error?.response?.data || error.message);
    
    if (error?.response?.status === 401) {
      console.error('🔑 Check your ADMIN_API_KEY environment variable');
    }
    
    if (error?.response?.status === 404) {
      console.error('🌐 Check your BASE_URL and ensure the server is running');
    }
  }
}

// Export for potential use as module
module.exports = { updateTeamTwitterData, findMatchingTeam, teamNameMappings };

// Run if called directly
if (require.main === module) {
  updateTeamTwitterData();
}