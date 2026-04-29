require('dotenv').config();
const mongoose = require('mongoose');
const { syncCupByLeague } = require('./services/cupService');

// Cup competitions to sync
const CUP_COMPETITIONS = [
  { id: 24, name: 'FA Cup (England)' },
  { id: 27, name: 'Carabao Cup (England)' },
  { id: 390, name: 'Coppa Italia (Italy)' },
  { id: 570, name: 'Copa Del Rey (Spain)' }
];

async function syncAllCups() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('🏆 Syncing Cup Competitions...\n');
    console.log('================================================================================\n');
    
    const results = {
      success: [],
      failed: []
    };
    
    for (let i = 0; i < CUP_COMPETITIONS.length; i++) {
      const cup = CUP_COMPETITIONS[i];
      console.log(`[${i + 1}/${CUP_COMPETITIONS.length}] Syncing ${cup.name} (ID: ${cup.id})...\n`);
      
      try {
        const result = await syncCupByLeague(cup.id);
        
        if (result) {
          console.log(`   ✅ Success: ${result.stages?.length || 0} stages synced\n`);
          results.success.push({
            ...cup,
            stages: result.stages?.length || 0
          });
        } else {
          console.log(`   ⚠️  No data available\n`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
        results.failed.push({
          ...cup,
          error: error.message
        });
      }
    }
    
    // Print summary
    console.log('\n================================================================================');
    console.log('📊 SYNC SUMMARY');
    console.log('================================================================================\n');
    
    if (results.success.length > 0) {
      console.log(`✅ Successfully synced (${results.success.length} cups):\n`);
      results.success.forEach(cup => {
        console.log(`   🏆 ${cup.name} - ${cup.stages} stages`);
      });
      console.log('');
    }
    
    if (results.failed.length > 0) {
      console.log(`❌ Failed (${results.failed.length} cups):\n`);
      results.failed.forEach(cup => {
        console.log(`   - ${cup.name}: ${cup.error}`);
      });
      console.log('');
    }
    
    console.log('================================================================================');
    console.log(`Total: ${CUP_COMPETITIONS.length}`);
    console.log(`Success: ${results.success.length}`);
    console.log(`Failed: ${results.failed.length}`);
    console.log('================================================================================\n');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

syncAllCups();
