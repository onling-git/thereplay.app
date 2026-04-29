const mongoose = require('mongoose');
const { generateReportFor } = require('./controllers/reportController');

// Set OpenAI API key from environment
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your-api-key-here';

mongoose.connect('mongodb://localhost:27017/thefinalplay').then(async () => {
  try {
    const report = await generateReportFor('19631550', 'arsenal');
    console.log('\n=== CURRENT REPORT ===');
    console.log(report.report);
    
    // Check for critical issues
    const potmMatch = report.report.match(/Martín Zubimendi.*?(\d+\.\d+)/);
    console.log('\n=== POTM RATING CHECK ===');
    if (potmMatch) {
      console.log(`POTM Rating found: ${potmMatch[1]}`);
      if (potmMatch[1] === '7.6') {
        console.log('✅ POTM rating is CORRECT (7.6)');
      } else {
        console.log(`❌ POTM rating is WRONG (${potmMatch[1]} instead of 7.6)`);
      }
    } else {
      console.log('❌ POTM rating not found in report');
    }
    
    // Check for league language in cup match
    const forbiddenPhrases = ['three points', 'secure the points', 'all three points', 'league position'];
    console.log('\n=== FORBIDDEN LANGUAGE CHECK ===');
    let foundForbidden = false;
    forbiddenPhrases.forEach(phrase => {
      if (report.report.toLowerCase().includes(phrase.toLowerCase())) {
        console.log(`❌ Found forbidden phrase: '${phrase}'`);
        foundForbidden = true;
      }
    });
    if (!foundForbidden) {
      console.log('✅ No forbidden league language found');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
});