const mongoose = require('mongoose');
const Team = require('./models/Team');
const { aggregateFeeds, generateTeamKeywords } = require('./utils/rssAggregator');

async function debugSouthamptonNews() {
  try {
    await mongoose.connect(process.env.DBURI);
    console.log('Connected to database');

    // 1. Find Southampton team in database
    const team = await Team.findOne({ slug: 'southampton' }).lean();
    console.log('\n=== SOUTHAMPTON TEAM DATA ===');
    console.log('Team found:', team ? 'Yes' : 'No');
    if (team) {
      console.log('Team name:', team.name);
      console.log('Team slug:', team.slug);
    }

    // 2. Generate keywords for Southampton
    const teamName = team ? team.name : 'Southampton';
    const keywords = generateTeamKeywords(teamName);
    console.log('\n=== GENERATED KEYWORDS ===');
    console.log('Team name used:', teamName);
    console.log('Generated keywords:', keywords);

    // 3. Fetch all RSS articles (without filtering)
    console.log('\n=== FETCHING ALL RSS ARTICLES ===');
    const allArticles = await aggregateFeeds();
    console.log('Total articles fetched:', allArticles.length);

    // 4. Show first few article titles and content to see what we're working with
    console.log('\n=== SAMPLE ARTICLES (first 5) ===');
    allArticles.slice(0, 5).forEach((article, index) => {
      console.log(`${index + 1}. "${article.title}"`);
      console.log(`   Description: ${article.description?.substring(0, 100)}...`);
      console.log('');
    });

    // 5. Filter articles manually to see what matches
    console.log('\n=== MANUAL KEYWORD MATCHING ===');
    const matchingArticles = allArticles.filter(article => {
      const title = (article.title || '').toLowerCase();
      const description = (article.description || '').toLowerCase();
      const content = `${title} ${description}`;
      
      const matches = keywords.some(keyword => {
        const keywordLower = keyword.toLowerCase();
        return content.includes(keywordLower);
      });
      
      if (matches) {
        console.log(`MATCH: "${article.title}"`);
        console.log(`  Matched content: ${content.substring(0, 150)}...`);
      }
      
      return matches;
    });

    console.log(`\nTotal matching articles: ${matchingArticles.length}`);

    // 6. Search for any articles that mention "southampton" manually
    console.log('\n=== MANUAL SEARCH FOR "SOUTHAMPTON" ===');
    const southamptonMentions = allArticles.filter(article => {
      const title = (article.title || '').toLowerCase();
      const description = (article.description || '').toLowerCase();
      const content = `${title} ${description}`;
      return content.includes('southampton');
    });

    console.log(`Articles mentioning "southampton": ${southamptonMentions.length}`);
    southamptonMentions.slice(0, 3).forEach((article, index) => {
      console.log(`${index + 1}. "${article.title}"`);
    });

    // 7. Search for "saints" mentions
    console.log('\n=== MANUAL SEARCH FOR "SAINTS" ===');
    const saintsMentions = allArticles.filter(article => {
      const title = (article.title || '').toLowerCase();
      const description = (article.description || '').toLowerCase();
      const content = `${title} ${description}`;
      return content.includes('saints');
    });

    console.log(`Articles mentioning "saints": ${saintsMentions.length}`);
    saintsMentions.slice(0, 3).forEach((article, index) => {
      console.log(`${index + 1}. "${article.title}"`);
    });

  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Load environment variables
require('dotenv').config();

debugSouthamptonNews();