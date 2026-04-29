require('dotenv').config();
const mongoose = require('mongoose');
const Report = require('./models/Report');

mongoose.connect(process.env.DBURI).then(async () => {
  try {
    const report = await Report.findById('697e7eaa69845e3861a1bbf0');
    
    console.log('Report content:');
    console.log('='.repeat(80));
    console.log(report.content);
    console.log('='.repeat(80));
    console.log('');
    console.log('Tweets field:', report.tweets?.length || 0, 'tweets');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});
