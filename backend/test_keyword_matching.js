// Test keyword generation and team matching directly
const { generateTeamKeywords, matchesTeam, matchesFilters } = require('./utils/rssAggregator');

// Mock article from BBC about Southampton
const mockArticle = {
  title: "Southampton secure Cup progress with late pressure",
  summary: "Southampton managed to progress in the cup competition with a late push. The Saints dominated the second half and eventually broke through.",
  source: "BBC Sport",
  url: "https://www.bbc.co.uk/sport/football/articles/cgk8d80jvgro"
};

console.log('Testing team keyword matching...\n');

// Test 1: Generate keywords for "Southampton"
console.log('1. Generating keywords for "Southampton":');
const keywords = generateTeamKeywords("Southampton");
console.log(`   Keywords: [${keywords.join(', ')}]`);

// Test 2: Check if article title contains these keywords
console.log('\n2. Checking if article contains keywords:');
const searchText = (mockArticle.title + ' ' + mockArticle.summary).toLowerCase();
console.log(`   Search text: "${searchText}"\n`);
keywords.forEach(kw => {
  const contained = searchText.includes(kw.toLowerCase());
  console.log(`   "${kw}" in text: ${contained}`);
});

// Test 3: Test matchesTeam directly
console.log('\n3. Testing matchesTeam function:');
const match1 = matchesTeam(mockArticle, 'Southampton', 'southampton');
console.log(`   matchesTeam(article, 'Southampton', 'southampton'): ${match1}`);

// Test 4: Test matchesFilters
console.log('\n4. Testing matchesFilters:');
const filters = { teamId: 'Southampton', teamSlug: 'southampton' };
const match2 = matchesFilters(mockArticle, filters);
console.log(`   matchesFilters(article, {teamId: 'Southampton', teamSlug: 'southampton'}): ${match2}`);

// Test 5: Generate keywords for "Reading"
console.log('\n5. Generating keywords for "Reading":');
const readingKeywords = generateTeamKeywords("Reading");
console.log(`   Keywords: [${readingKeywords.join(', ')}]`);

// Mock Reading article
const readingArticle = {
  title: "Reading FC boss confident ahead of promotion push",
  summary: "Reading Football Club's manager spoke about ambitions to push for promotion this season",
  source: "BBC Sport",
  url: "https://www.bbc.co.uk/sport/football/articles/test"
};

console.log('\n6. Testing Reading article match:');
const readingMatch = matchesTeam(readingArticle, 'Reading', 'reading');
console.log(`   matchesTeam result: ${readingMatch}`);
