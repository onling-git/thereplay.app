// Check standings in the database
require('dotenv').config();
const mongoose = require('mongoose');

async function checkStandings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    // Check if we have a Standings collection
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📋 Available collections:');
    collections.forEach(c => console.log(`  - ${c.name}`));
    
    // Try to find standings model
    const standingsCollections = collections.filter(c => 
      c.name.toLowerCase().includes('standing')
    );
    
    console.log('\n🔍 Standings-related collections:', standingsCollections.map(c => c.name));
    
    // Check each standings collection
    for (const coll of standingsCollections) {
      const count = await mongoose.connection.db.collection(coll.name).countDocuments();
      console.log(`\n📊 ${coll.name}: ${count} documents`);
      
      if (count > 0) {
        const sample = await mongoose.connection.db.collection(coll.name).findOne();
        console.log('Sample document:');
        console.log(JSON.stringify(sample, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

checkStandings().catch(console.error);
