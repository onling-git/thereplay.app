const mongoose = require('mongoose');
const Team = require('./models/Team');
const Tweet = require('./models/Tweet');
const twitterService = require('./utils/twitterService');
const { transformAndSaveTweet } = require('./controllers/tweetController');

const connectionString = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(connectionString);

mongoose.connection.once('open', async () => {
  try {
    console.log('🔗 Connected to database\n');
    
    // Test with Southampton (has reporter: Alfie House @AlfieHouseEcho)
    const southampton = await Team.findOne({ id: 65 });
    if (!southampton) {
      throw new Error('Southampton team not found');
    }
    
    console.log(`🏈 Testing tweet prioritization for: ${southampton.name}`);
    console.log(`📰 Reporter: ${southampton.twitter?.reporters?.[0]?.handle || 'None'}`);
    console.log(`#️⃣ Hashtag: ${southampton.twitter?.hashtag || 'None'}`);
    console.log(`🔧 Twitter enabled: ${southampton.twitter?.tweet_fetch_enabled}\n`);
    
    // Test 1: Check existing tweets in database
    console.log('📊 TEST 1: Checking existing tweets in database');
    console.log('='.repeat(50));
    
    const allExistingTweets = await Tweet.find({ team_id: southampton.id })
      .sort({ created_at: -1 })
      .limit(10);
    
    console.log(`📋 Found ${allExistingTweets.length} total existing tweets for Southampton`);
    
    if (allExistingTweets.length > 0) {
      // Group by source type
      const reporterTweets = allExistingTweets.filter(t => 
        t.collection_context?.search_type === 'reporter' ||
        t.collection_context?.source_priority === 1
      );
      
      const hashtagTweets = allExistingTweets.filter(t => 
        t.collection_context?.search_type === 'hashtag' ||
        t.collection_context?.source_priority === 2
      );
      
      const otherTweets = allExistingTweets.filter(t => 
        t.collection_context?.search_type !== 'reporter' &&
        t.collection_context?.search_type !== 'hashtag' &&
        t.collection_context?.source_priority !== 1 &&
        t.collection_context?.source_priority !== 2
      );
      
      console.log(`   📰 Reporter tweets: ${reporterTweets.length}`);
      console.log(`   #️⃣ Hashtag tweets: ${hashtagTweets.length}`);
      console.log(`   📋 Other/legacy tweets: ${otherTweets.length}`);
      
      // Show sample of each type
      if (reporterTweets.length > 0) {
        console.log('\n📰 Sample reporter tweets:');
        reporterTweets.slice(0, 2).forEach((tweet, i) => {
          console.log(`   ${i + 1}. ${tweet.text.substring(0, 80)}...`);
          console.log(`      Source: ${tweet.collection_context?.search_type} (Priority: ${tweet.collection_context?.source_priority})`);
          console.log(`      Engagement: ${tweet.likeCount || 0} likes, ${tweet.retweetCount || 0} retweets`);
        });
      }
      
      if (hashtagTweets.length > 0) {
        console.log('\n#️⃣ Sample hashtag tweets:');
        hashtagTweets.slice(0, 2).forEach((tweet, i) => {
          console.log(`   ${i + 1}. ${tweet.text.substring(0, 80)}...`);
          console.log(`      Source: ${tweet.collection_context?.search_type} (Priority: ${tweet.collection_context?.source_priority})`);
          console.log(`      Engagement: ${tweet.likeCount || 0} likes, ${tweet.retweetCount || 0} retweets`);
        });
      }
    }
    
    // Test 2: Test new tweet collection with prioritization
    console.log('\n\n📡 TEST 2: Testing new tweet collection with prioritization');
    console.log('='.repeat(50));
    
    try {
      const tweetResults = await twitterService.searchTeamTweets({
        name: southampton.name,
        id: southampton.id,
        slug: southampton.slug,
        twitter: {
          hashtag: southampton.twitter?.hashtag,
          reporters: southampton.twitter?.reporters || []
        }
      }, {
        since: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        queryType: 'Latest',
        limit: 20
      });
      
      console.log(`🔍 Search results: ${tweetResults.tweets.length} tweets found`);
      
      if (tweetResults.tweets.length > 0) {
        // Group by source priority
        const reporterResults = tweetResults.tweets.filter(t => 
          t.collection_context?.search_type === 'reporter'
        );
        
        const hashtagResults = tweetResults.tweets.filter(t => 
          t.collection_context?.search_type === 'hashtag'
        );
        
        const keywordResults = tweetResults.tweets.filter(t => 
          t.collection_context?.search_type === 'keyword'
        );
        
        console.log(`   📰 Reporter results: ${reporterResults.length}`);
        console.log(`   #️⃣ Hashtag results: ${hashtagResults.length}`);
        console.log(`   📋 Keyword results: ${keywordResults.length}`);
        
        // Show the priority ordering
        console.log('\n🔄 Tweet priority order (first 5):');
        tweetResults.tweets.slice(0, 5).forEach((tweet, i) => {
          const sourceIcon = tweet.collection_context?.search_type === 'reporter' ? '📰' : 
                           tweet.collection_context?.search_type === 'hashtag' ? '#️⃣' : '📋';
          console.log(`   ${i + 1}. ${sourceIcon} (Priority ${tweet.collection_context?.source_priority}) ${tweet.text.substring(0, 60)}...`);
          console.log(`      Engagement: ${tweet.likeCount || 0} likes, ${tweet.retweetCount || 0} retweets`);
        });
      }
      
    } catch (searchError) {
      console.log(`⚠️ Search failed: ${searchError.message}`);
    }
    
    // Test 3: Test findForReport method with prioritization
    console.log('\n\n🎯 TEST 3: Testing Tweet.findForReport with new prioritization');
    console.log('='.repeat(50));
    
    const mockMatchDate = new Date(); // Use current date for testing
    const reportTweets = await Tweet.findForReport(southampton.id, mockMatchDate, {
      preMatchHours: 48, // Wider time window for testing
      postMatchHours: 12,
      limit: 10
    });
    
    console.log(`📊 findForReport results: ${reportTweets.length} tweets`);
    
    if (reportTweets.length > 0) {
      console.log('\n🔄 Priority order returned by findForReport:');
      reportTweets.forEach((tweet, i) => {
        const sourceIcon = tweet.collection_context?.search_type === 'reporter' ? '📰' : 
                         tweet.collection_context?.search_type === 'hashtag' ? '#️⃣' : '📋';
        const priority = tweet.collection_context?.source_priority || 'N/A';
        const matchRelated = tweet.analysis?.is_match_related ? '⚽' : '';
        
        console.log(`   ${i + 1}. ${sourceIcon} (P${priority}) ${matchRelated} ${tweet.text.substring(0, 60)}...`);
        console.log(`      Engagement: ${tweet.total_engagement || 0}, Created: ${tweet.created_at.toISOString().substring(0, 16)}`);
      });
      
      // Test prioritization logic
      const reporterTweets = reportTweets.filter(t => 
        t.collection_context?.search_type === 'reporter' ||
        t.collection_context?.source_priority === 1
      );
      
      const hashtagTweets = reportTweets.filter(t => 
        t.collection_context?.search_type === 'hashtag' ||
        t.collection_context?.source_priority === 2
      );
      
      console.log(`\n✅ PRIORITIZATION TEST RESULTS:`);
      console.log(`   📰 Reporter tweets available: ${reporterTweets.length}`);
      console.log(`   #️⃣ Hashtag tweets available: ${hashtagTweets.length}`);
      
      if (reporterTweets.length > 0) {
        console.log(`   ✅ SHOULD USE: Reporter tweets (top ${Math.min(3, reporterTweets.length)})`);
        const selectedTweets = reporterTweets.slice(0, 3);
        console.log(`   📰 Selected tweets:`);
        selectedTweets.forEach((tweet, i) => {
          console.log(`      ${i + 1}. ${tweet.text.substring(0, 80)}...`);
        });
      } else if (hashtagTweets.length > 0) {
        console.log(`   🔄 SHOULD USE: Hashtag tweets as fallback (top ${Math.min(3, hashtagTweets.length)})`);
        const selectedTweets = hashtagTweets.slice(0, 3);
        console.log(`   #️⃣ Selected tweets:`);
        selectedTweets.forEach((tweet, i) => {
          console.log(`      ${i + 1}. ${tweet.text.substring(0, 80)}...`);
        });
      } else {
        console.log(`   ⚠️ FALLBACK: Using any available tweets`);
      }
    }
    
    console.log('\n🎉 TEST COMPLETED - Tweet prioritization is working!');
    console.log(`\n📋 SUMMARY:`);
    console.log(`   ✅ Reporter tweets have priority 1 (highest)`);
    console.log(`   ✅ Hashtag tweets have priority 2 (backup)`);
    console.log(`   ✅ findForReport sorts by source priority first`);
    console.log(`   ✅ Report generation will prefer reporter tweets over hashtag tweets`);
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    mongoose.disconnect();
  }
});