const { aggregateFeeds } = require('./utils/rssAggregator');
const Team = require('./models/Team');

async function debugSouthamptonNews() {
  try {
    console.log('=== Southampton News Debug ===\n');
    
    // 1. Check if Southampton exists in the database
    console.log('1. Checking Southampton in database...');
    const team = await Team.findOne({ slug: 'southampton' }).lean();
    if (team) {
      console.log(`✓ Found Southampton: ${team.name} (slug: ${team.slug})`);
    } else {
      console.log('✗ Southampton not found in database');
      console.log('Available teams:');
      const teams = await Team.find({}).lean();
      teams.slice(0, 10).forEach(t => console.log(`  - ${t.name} (${t.slug})`));
      return;
    }
    
    // 2. Test keyword generation
    console.log('\n2. Testing keyword generation...');
    const { generateTeamKeywords } = require('./utils/rssAggregator');
    
    // Test with team name
    console.log(`Team name: "${team.name}"`);
    console.log(`Generated keywords: [${generateTeamKeywords(team.name).join(', ')}]`);
    
    // Test with slug
    console.log(`Team slug: "${team.slug}"`);
    console.log(`Generated keywords: [${generateTeamKeywords(team.slug).join(', ')}]`);
    
    // 3. Test RSS aggregation
    console.log('\n3. Testing RSS aggregation...');
    
    console.log('Testing with team name...');
    const articles1 = await aggregateFeeds({ teamId: team.name, limit: 3 });
    console.log(`Found ${articles1.length} articles using team name "${team.name}"`);
    
    console.log('Testing with slug...');
    const articles2 = await aggregateFeeds({ teamId: team.slug, limit: 3 });
    console.log(`Found ${articles2.length} articles using slug "${team.slug}"`);
    
    console.log('Testing with "southampton"...');
    const articles3 = await aggregateFeeds({ teamId: 'southampton', limit: 3 });
    console.log(`Found ${articles3.length} articles using "southampton"`);
    
    // 4. Show sample articles if any found
    const allArticles = [...articles1, ...articles2, ...articles3];
    if (allArticles.length > 0) {
      console.log('\n4. Sample articles found:');
      allArticles.slice(0, 3).forEach((article, i) => {
        console.log(`${i + 1}. "${article.title}" (${article.source})`);
      });
    } else {
      console.log('\n4. No articles found for Southampton');
    }
    
  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  debugSouthamptonNews();
}