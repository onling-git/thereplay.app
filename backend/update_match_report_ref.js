// Update match document to reference the new Wrexham report
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

async function updateMatchReportReference() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB');

    const matchId = 19432238;
    const newWrexhamReportId = '69d62471a21f3cdbef028fbe';
    
    console.log(`\n🔄 Updating match ${matchId} to reference new Wrexham report...`);
    console.log('New Wrexham report ID:', newWrexhamReportId);
    console.log('');
    
    const result = await Match.updateOne(
      { match_id: matchId },
      { 
        $set: { 
          'reports.home': new mongoose.Types.ObjectId(newWrexhamReportId),
          'reports.generated_at': new Date()
        } 
      }
    );
    
    console.log('Update result:', result);
    
    if (result.modifiedCount > 0) {
      console.log('✅ Match document updated successfully!');
      
      // Verify
      const match = await Match.findOne({ match_id: matchId });
      console.log('\n📊 Verification:');
      console.log('reports.home:', match.reports.home);
      console.log('reports.away:', match.reports.away);
      console.log('reports.generated_at:', match.reports.generated_at);
    } else {
      console.log('⚠️ No changes made');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

updateMatchReportReference();
