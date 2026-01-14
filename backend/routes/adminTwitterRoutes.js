// routes/adminTwitterRoutes.js
const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const apiKey = require('../middleware/apiKey');
const clubReporters = require('../data/clubReporters');

// Dynamic function to find matching team using fuzzy matching
function findMatchingTeam(teams, clubName) {
  const normalizeString = (str) => {
    return str.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  };
  
  const normalizedClubName = normalizeString(clubName);
  
  // Try exact match first
  let match = teams.find(team => 
    normalizeString(team.name) === normalizedClubName ||
    normalizeString(team.slug.replace(/-/g, ' ')) === normalizedClubName
  );
  
  if (match) return match;
  
  // Try partial matches for common variations
  const clubWords = normalizedClubName.split(' ');
  const mainClubName = clubWords[0]; // First word is usually the main identifier
  
  // Look for teams that contain the main club name
  match = teams.find(team => {
    const teamName = normalizeString(team.name);
    const teamSlug = normalizeString(team.slug.replace(/-/g, ' '));
    
    // Check if main club name appears in team name or slug
    return teamName.includes(mainClubName) || teamSlug.includes(mainClubName) ||
           // Check if team name appears in club name (for cases like "AFC Bournemouth" vs "Bournemouth")
           normalizedClubName.includes(teamName.split(' ')[0]);
  });
  
  if (match) return match;
  
  // Final attempt: check if any word from club name matches any word from team name
  for (const team of teams) {
    const teamWords = normalizeString(team.name).split(' ');
    const hasCommonWord = clubWords.some(clubWord => 
      clubWord.length > 3 && teamWords.some(teamWord => teamWord.includes(clubWord) || clubWord.includes(teamWord))
    );
    
    if (hasCommonWord) {
      return team;
    }
  }
  
  return null;
}

// Admin endpoint to populate team Twitter data (temporarily unprotected for testing)
router.post('/populate-team-data', async (req, res) => {
  try {
    console.log('🔄 Starting Twitter data population for teams...');
    
    // Get all teams from database
    const teams = await Team.find({}).lean();
    console.log(`📊 Found ${teams.length} teams in database`);
    
    let updated = 0;
    let notFound = [];
    let errors = [];
    const updateResults = [];
    
    // Process each club reporter entry
    for (const clubData of clubReporters) {
      const clubName = clubData.club;
      
      try {
        // Find matching team
        const team = findMatchingTeam(teams, clubName);
        
        if (!team) {
          console.log(`❌ No team found for: ${clubName}`);
          notFound.push(clubName);
          continue;
        }
        
        // Update team with Twitter data
        const twitterData = {
          hashtag: clubData.hashtag,
          reporters: clubData.reporters || []
        };
        
        const result = await Team.findByIdAndUpdate(
          team._id,
          { 
            $set: { 
              twitter: twitterData 
            }
          },
          { 
            new: true,
            lean: true
          }
        );
        
        if (result) {
          console.log(`✅ Updated ${team.name} with Twitter data: ${clubData.hashtag}, ${clubData.reporters?.length || 0} reporters`);
          updated++;
          updateResults.push({
            teamName: team.name,
            teamId: team._id,
            hashtag: clubData.hashtag,
            reporterCount: clubData.reporters?.length || 0
          });
        } else {
          console.log(`❌ Failed to update ${team.name}`);
          errors.push(`Failed to update ${team.name}`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${clubName}:`, error.message);
        errors.push(`${clubName}: ${error.message}`);
      }
    }
    
    console.log(`🎉 Twitter data population complete!`);
    console.log(`✅ Updated: ${updated} teams`);
    console.log(`❌ Not found: ${notFound.length} teams`);
    console.log(`💥 Errors: ${errors.length} errors`);
    
    res.json({
      success: true,
      summary: {
        total_clubs: clubReporters.length,
        updated: updated,
        not_found: notFound.length,
        errors: errors.length
      },
      details: {
        updated_teams: updateResults,
        not_found_clubs: notFound,
        errors: errors
      }
    });
    
  } catch (error) {
    console.error('❌ Error in Twitter data population:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to populate Twitter data',
      message: error.message
    });
  }
});

// Admin endpoint to check team Twitter data status (temporarily unprotected for testing)
router.get('/team-status', async (req, res) => {
  try {
    console.log('📊 Checking Twitter data status for teams...');
    
    // Get all teams
    const teams = await Team.find({}, 'name slug twitter').lean();
    
    const withTwitter = teams.filter(team => team.twitter?.hashtag);
    const withoutTwitter = teams.filter(team => !team.twitter?.hashtag);
    
    const twitterTeams = withTwitter.map(team => ({
      id: team._id,
      name: team.name,
      slug: team.slug,
      hashtag: team.twitter?.hashtag,
      reporterCount: team.twitter?.reporters?.length || 0
    }));
    
    const noTwitterTeams = withoutTwitter.map(team => ({
      id: team._id,
      name: team.name,
      slug: team.slug
    }));
    
    console.log(`✅ ${withTwitter.length} teams have Twitter data`);
    console.log(`❌ ${withoutTwitter.length} teams missing Twitter data`);
    
    res.json({
      success: true,
      summary: {
        total_teams: teams.length,
        with_twitter: withTwitter.length,
        without_twitter: withoutTwitter.length
      },
      teams_with_twitter: twitterTeams,
      teams_without_twitter: noTwitterTeams
    });
    
  } catch (error) {
    console.error('❌ Error checking Twitter status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check Twitter status',
      message: error.message
    });
  }
});

module.exports = router;