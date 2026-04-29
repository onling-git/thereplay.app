// Check ALL fields in old report
const mongoose = require('mongoose');
require('dotenv').config();

const Report = require('./models/Report');

async function checkOldReportFields() {
  try {
    await mongoose.connect(process.env.DBURI);
    console.log('Connected to MongoDB');
    
    const oldReport = await Report.findOne({ match_id: 19432238, team_slug: 'southampton' }).lean();
    
    if (!oldReport) {
      console.log('No old report found');
      return;
    }
    
    console.log('\n=== OLD REPORT FIELDS ===\n');
    console.log('Top-level fields:');
    Object.keys(oldReport).forEach(key => {
      if (!['_id', '__v', 'createdAt', 'updatedAt'].includes(key)) {
        const value = oldReport[key];
        if (Array.isArray(value)) {
          console.log(`  ${key}: Array(${value.length})`);
        } else if (typeof value === 'object' && value !== null) {
          console.log(`  ${key}: Object with keys: ${Object.keys(value).join(', ')}`);
        } else {
          console.log(`  ${key}: ${typeof value}`);
        }
      }
    });
    
    // Check generated object
    if (oldReport.generated) {
      console.log('\n=== generated.* fields ===');
      Object.keys(oldReport.generated).forEach(key => {
        const value = oldReport.generated[key];
        if (Array.isArray(value)) {
          console.log(`  generated.${key}: Array(${value.length})`);
          if (key === 'summary_paragraphs' && value.length > 0) {
            console.log(`    First paragraph length: ${value[0]?.length} chars`);
          }
        } else if (typeof value === 'object' && value !== null) {
          console.log(`  generated.${key}: Object`);
        } else {
          console.log(`  generated.${key}: ${typeof value}`);
        }
      });
      
      // Show actual content
      if (oldReport.generated.summary_paragraphs?.length > 0) {
        console.log('\n=== generated.summary_paragraphs content ===');
        oldReport.generated.summary_paragraphs.forEach((p, i) => {
          console.log(`\nParagraph ${i + 1} (${p.length} chars):`);
          console.log(p.substring(0, 200) + '...\n');
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkOldReportFields();
