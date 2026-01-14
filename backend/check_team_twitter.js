const mongoose = require('mongoose');
const Team = require('./models/Team');

const connectionString = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(connectionString);

mongoose.connection.once('open', async () => {
  try {
    console.log('Connected to database');
    
    // Check teams with any Twitter data
    const teamsWithTwitterData = await Team.find({ 
      'twitter': { $exists: true, $ne: null } 
    }).limit(10);
    
    console.log(`\nTeams with Twitter data: ${teamsWithTwitterData.length}`);
    teamsWithTwitterData.forEach((team, index) => {
      console.log(`\nTeam ${index + 1}: ${team.name} (${team.slug})`);
      console.log(`  Twitter data:`, JSON.stringify(team.twitter, null, 2));
    });
    
    // Check Southampton specifically since we have tweets for them
    const southampton = await Team.findOne({ 
      $or: [
        { name: /southampton/i },
        { id: 65 }
      ]
    });
    
    if (southampton) {
      console.log('\n--- Southampton Team Data ---');
      console.log(`Name: ${southampton.name}`);
      console.log(`ID: ${southampton.id}`);
      console.log(`Slug: ${southampton.slug}`);
      console.log(`Twitter data:`, JSON.stringify(southampton.twitter, null, 2));
    } else {
      console.log('\nSouthampton team not found in database');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});