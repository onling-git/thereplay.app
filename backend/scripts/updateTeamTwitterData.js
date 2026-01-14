// scripts/updateTeamTwitterData.js
require('dotenv').config();
const mongoose = require('mongoose');
const Team = require('../models/Team');
const clubReporters = require('../data/clubReporters');

// Team name variations and mappings to handle different naming conventions
const teamNameMappings = {
  // Premier League variations
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

// Create a reverse lookup map for efficient searching
const createNameLookup = () => {
  const lookup = new Map();
  
  for (const [standardName, variations] of Object.entries(teamNameMappings)) {
    for (const variation of variations) {
      lookup.set(variation.toLowerCase(), standardName);
    }
  }
  
  return lookup;
};

async function updateTeamTwitterData() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.DBURI);
    console.log('✅ Connected to database');

    // Get all teams from database
    const teams = await Team.find({}).lean();
    console.log(`📊 Found ${teams.length} teams in database`);

    const nameLookup = createNameLookup();
    let updated = 0;
    let notFound = [];

    // Process each club reporter entry
    for (const clubData of clubReporters) {
      const clubName = clubData.club;
      
      // Find matching team in database
      let matchedTeam = null;
      
      // Try exact name match first
      matchedTeam = teams.find(team => 
        team.name.toLowerCase() === clubName.toLowerCase()
      );
      
      // If no exact match, try variations
      if (!matchedTeam) {
        const standardName = nameLookup.get(clubName.toLowerCase());
        if (standardName) {
          const variations = teamNameMappings[standardName];
          for (const variation of variations) {
            matchedTeam = teams.find(team => 
              team.name.toLowerCase() === variation.toLowerCase()
            );
            if (matchedTeam) break;
          }
        }
      }
      
      // If still no match, try partial matching
      if (!matchedTeam) {
        matchedTeam = teams.find(team => {
          const teamName = team.name.toLowerCase();
          const clubNameLower = clubName.toLowerCase();
          
          // Check if club name is contained in team name or vice versa
          return teamName.includes(clubNameLower) || clubNameLower.includes(teamName);
        });
      }

      if (matchedTeam) {
        console.log(`✅ Matched "${clubName}" -> "${matchedTeam.name}" (${matchedTeam.slug})`);
        
        // Update team with twitter data
        const updateData = {
          'twitter.reporters': clubData.reporters.map(reporter => ({
            name: reporter.name,
            handle: reporter.handle,
            verified: false, // Will be updated when we fetch user data
            last_checked: null
          })),
          'twitter.hashtag': clubData.hashtag,
          'twitter.alternative_hashtags': [],
          'twitter.tweet_fetch_enabled': true
        };

        await Team.findByIdAndUpdate(matchedTeam._id, { $set: updateData });
        updated++;
      } else {
        console.log(`❌ No match found for "${clubName}"`);
        notFound.push(clubName);
      }
    }

    console.log('\n📈 Update Summary:');
    console.log(`✅ Successfully updated: ${updated} teams`);
    console.log(`❌ Not found: ${notFound.length} clubs`);
    
    if (notFound.length > 0) {
      console.log('\n🔍 Clubs not matched:');
      notFound.forEach(club => console.log(`   - ${club}`));
      
      console.log('\n💡 Available teams in database:');
      const sortedTeams = teams
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 20); // Show first 20 teams
      
      sortedTeams.forEach(team => console.log(`   - ${team.name} (${team.slug})`));
      
      if (teams.length > 20) {
        console.log(`   ... and ${teams.length - 20} more teams`);
      }
    }

  } catch (error) {
    console.error('❌ Error updating team twitter data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the script
if (require.main === module) {
  updateTeamTwitterData();
}

module.exports = { updateTeamTwitterData, teamNameMappings };