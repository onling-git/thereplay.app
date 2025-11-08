require('dotenv').config();
const mongoose = require('mongoose');

async function checkMatchStates() {
  try {
    await mongoose.connect(process.env.DBURI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get unique match states
    const states = await db.collection('matches').aggregate([
      { $group: { _id: '$match_status.state', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log('Match states:');
    states.forEach(s => console.log(`  ${s._id}: ${s.count}`));
    
    // Get unique short names
    const shortNames = await db.collection('matches').aggregate([
      { $group: { _id: '$match_status.short_name', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log('\nShort names:');
    shortNames.forEach(s => console.log(`  ${s._id}: ${s.count}`));
    
    // Get example finished matches
    const finishedMatches = await db.collection('matches').find({
      'match_status.state': 'FT'
    }).limit(3).toArray();
    
    console.log('\nExample finished matches:');
    finishedMatches.forEach(m => {
      console.log(`  Match ${m.match_id}: ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name}`);
      console.log(`    Status: ${JSON.stringify(m.match_status)}`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkMatchStates();