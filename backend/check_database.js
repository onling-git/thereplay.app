// check_database.js
// Quick script to check database connection and collections

require('dotenv').config();
const mongoose = require('mongoose');

async function checkDatabase() {
  try {
    console.log('🔍 Checking database connection and collections...\n');
    
    // Check connection
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    console.log('Database URI:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
    
    await mongoose.connect(uri);
    console.log('✅ Database connected successfully');
    
    // Wait for connection to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📊 Available collections:', collections.map(c => c.name));
    
    // Check if matches collection exists and has data
    if (collections.find(c => c.name === 'matches')) {
      const Match = require('./models/Match');
      const matchCount = await Match.countDocuments();
      console.log(`📊 Total matches in database: ${matchCount}`);
      
      if (matchCount > 0) {
        // Get a sample match to see the structure
        const sampleMatch = await Match.findOne().lean();
        console.log('\n📋 Sample match structure:');
        console.log('Match ID:', sampleMatch.match_id);
        console.log('Teams:', sampleMatch.teams || { home: sampleMatch.home_team, away: sampleMatch.away_team });
        console.log('Date fields:', {
          'match_info.starting_at': sampleMatch.match_info?.starting_at,
          'date': sampleMatch.date
        });
        console.log('League:', sampleMatch.league_info?.name || sampleMatch.league);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkDatabase();