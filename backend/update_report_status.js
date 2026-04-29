// Update report status to 'final'
require('dotenv').config();
const mongoose = require('mongoose');
const Report = require('./models/Report');

async function updateReportStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB');

    const reportId = '69d62471a21f3cdbef028fbe';
    
    console.log(`\n🔄 Updating report ${reportId} to 'final' status...`);
    
    const result = await Report.updateOne(
      { _id: reportId },
      { $set: { status: 'final' } }
    );
    
    console.log('\nUpdate result:', result);
    
    if (result.modifiedCount > 0) {
      console.log('✅ Report status updated to "final"');
      
      // Verify
      const report = await Report.findById(reportId);
      console.log('\nVerification:');
      console.log('Status:', report.status);
      console.log('Headline:', report.headline);
      console.log('Team Slug:', report.team_slug);
    } else {
      console.log('⚠️ No changes made');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

updateReportStatus();
