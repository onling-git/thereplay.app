require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

async function checkCompetitionDetails() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    
    const match = await Match.findOne({ match_id: 19631550 });
    if (!match) {
      console.log('Match not found');
      return;
    }
    
    console.log('=== DETAILED COMPETITION INFO ===');
    const league = match.match_info.league;
    console.log('League ID:', league.id);
    console.log('League Name:', league.name);
    console.log('Short Code:', league.short_code);
    
    // Check for leg information in the match data structure
    const fullMatch = match.toJSON();
    console.log('\n=== SEARCHING FOR LEG/ROUND INFO ===');
    
    const searchForLeg = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (typeof value === 'string' && (value.includes('leg') || value.includes('semi') || value.includes('round'))) {
          console.log(`Found at ${currentPath}: ${value}`);
        } else if (key.includes('leg') || key.includes('round') || key.includes('stage')) {
          console.log(`Key ${currentPath}:`, JSON.stringify(value));
        } else if (value && typeof value === 'object' && !Array.isArray(value) && path.split('.').length < 4) {
          searchForLeg(value, currentPath);
        }
      }
    };
    
    searchForLeg(fullMatch);
    
    // Specific checks for common leg indicators
    console.log('\n=== SPECIFIC CHECKS ===');
    console.log('Round info:', JSON.stringify(match.match_info.round));
    
    // Check if this is typically a two-legged competition
    const isCup = league.name.toLowerCase().includes('cup') || league.name.toLowerCase().includes('carabao');
    console.log('Is Cup Competition:', isCup);
    
    // Based on the league ID and competition type, what should we tell the AI?
    const competitionContext = {
      isLeague: !isCup,
      isCup: isCup,
      competitionName: league.name,
      affectsLeaguePosition: !isCup,
      isTwoLegged: isCup && (league.name.includes('Carabao') || league.name.includes('League Cup')),
      stage: match.match_info.stage?.name || 'Unknown Stage'
    };
    
    console.log('\n=== COMPETITION CONTEXT FOR AI ===');
    console.log(JSON.stringify(competitionContext, null, 2));
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkCompetitionDetails();