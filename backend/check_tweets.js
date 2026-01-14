const mongoose = require('mongoose');
const Report = require('./models/Report');

const connectionString = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(connectionString);

mongoose.connection.once('open', async () => {
  try {
    console.log('Connected to database');
    
    // Check for reports with embedded tweets
    const reportsWithTweets = await Report.find({ 
      'generated.embedded_tweets': { $exists: true, $ne: [] } 
    }).limit(5).sort({ createdAt: -1 });
    
    console.log(`\nFound ${reportsWithTweets.length} reports with embedded tweets`);
    
    reportsWithTweets.forEach((report, index) => {
      console.log(`\n--- Report ${index + 1} ---`);
      console.log(`ID: ${report._id}`);
      console.log(`Match: ${report.match_id}`);
      console.log(`Team: ${report.team_perspective}`);
      console.log(`Embedded Tweets: ${report.generated.embedded_tweets?.length || 0}`);
      
      if (report.generated.embedded_tweets?.length > 0) {
        console.log('\nFirst tweet structure:');
        const tweet = report.generated.embedded_tweets[0];
        console.log(JSON.stringify(tweet, null, 2));
      }
    });
    
    // Also check for any recent reports without embedded tweets
    const recentReports = await Report.find({}).limit(3).sort({ createdAt: -1 });
    console.log(`\n--- Recent reports (any) ---`);
    recentReports.forEach((report, index) => {
      console.log(`Report ${index + 1}: ${report._id} - Match: ${report.match_id} - Team: ${report.team_perspective}`);
      console.log(`Has embedded_tweets: ${!!report.generated?.embedded_tweets?.length}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});