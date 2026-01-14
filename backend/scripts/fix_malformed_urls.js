#!/usr/bin/env node

/**
 * Script to identify and fix malformed URLs in RSS feed data
 * 
 * This script helps identify:
 * 1. Malformed BBC URLs with category names in article IDs
 * 2. Category page URLs being used as article URLs
 * 3. Invalid or broken URLs
 * 
 * Usage:
 *   node scripts/fix_malformed_urls.js [--fix] [--verbose]
 * 
 *   --fix      Apply fixes automatically
 *   --verbose  Show detailed output
 */

const axios = require('axios');
const xml2js = require('xml2js');
const { isValidArticleUrl, cleanAndValidateUrl, isCategoryPageUrl } = require('../utils/rssAggregator');

// Mock articles data (for testing the fix)
const mockArticles = [
  {
    title: "Championship Promotion Race Intensifies",
    url: "https://www.bbc.com/sport/football/articles/c123456789championship1",
    source: "BBC Sport"
  },
  {
    title: "Leicester City's Championship Dominance", 
    url: "https://www.bbc.com/sport/football/articles/c123456789championship2",
    source: "BBC Sport"
  },
  {
    title: "Valid Championship Article",
    url: "https://www.bbc.co.uk/sport/football/articles/cx2nk2y28pko",
    source: "BBC Sport"
  },
  {
    title: "Category Page Link",
    url: "https://www.bbc.com/sport/football/championship",
    source: "BBC Sport"
  }
];

/**
 * Analyze a URL and provide detailed information
 */
function analyzeUrl(url, title) {
  const analysis = {
    url,
    title,
    isValid: false,
    isCategoryPage: false,
    isMalformed: false,
    issues: [],
    suggestions: []
  };

  // Basic validation
  if (!url || url === '#') {
    analysis.issues.push('Missing or placeholder URL');
    return analysis;
  }

  // Check if it's a category page
  if (isCategoryPageUrl(url)) {
    analysis.isCategoryPage = true;
    analysis.issues.push('URL points to category/overview page, not specific article');
  }

  // Check if it's a valid article URL
  analysis.isValid = isValidArticleUrl(url);

  // BBC-specific checks
  if (url.includes('bbc.co') || url.includes('bbc.com')) {
    if (url.includes('/articles/')) {
      const articleIdMatch = url.match(/\/articles\/([^?&#]+)/);
      if (articleIdMatch) {
        const articleId = articleIdMatch[1];
        
        // Check for malformed article ID
        const invalidPatterns = ['championship', 'premiere-league', 'premier-league', 'football', 'soccer'];
        const foundInvalidPattern = invalidPatterns.find(pattern => 
          articleId.toLowerCase().includes(pattern)
        );
        
        if (foundInvalidPattern) {
          analysis.isMalformed = true;
          analysis.issues.push(`Article ID contains category name: "${foundInvalidPattern}"`);
          analysis.suggestions.push('Use proper BBC article ID format (e.g., cx2nk2y28pko)');
        }
        
        // Check ID format
        if (!articleId.match(/^[a-zA-Z0-9_-]+$/)) {
          analysis.issues.push('Article ID contains invalid characters');
        }
      }
    } else {
      analysis.issues.push('BBC URL missing /articles/ path');
      analysis.suggestions.push('BBC article URLs should follow format: https://www.bbc.co.uk/sport/football/articles/[article-id]');
    }
  }

  return analysis;
}

/**
 * Fetch sample BBC RSS data to get real article URLs
 */
async function fetchSampleBBCUrls() {
  try {
    console.log('Fetching sample BBC RSS data...');
    
    const response = await axios.get('http://feeds.bbci.co.uk/sport/football/rss.xml', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FootballNewsAggregator/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    });
    
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      trim: true
    });
    
    const result = await parser.parseStringPromise(response.data);
    const items = result?.rss?.channel?.item || [];
    const normalizedItems = Array.isArray(items) ? items : [items];
    
    // Extract valid article URLs
    const sampleUrls = normalizedItems
      .slice(0, 10)
      .map(item => ({
        title: item.title,
        url: item.link,
        articleId: item.link?.match(/\/articles\/([^?&#]+)/)?.[1]
      }))
      .filter(item => item.articleId);
    
    return sampleUrls;
    
  } catch (error) {
    console.error('Error fetching BBC RSS:', error.message);
    return [];
  }
}

/**
 * Main analysis function
 */
async function analyzeUrls(options = {}) {
  const { fix = false, verbose = false } = options;
  
  console.log('🔍 Analyzing URLs for malformed patterns...\n');
  
  // Analyze mock articles
  const analyses = mockArticles.map(article => 
    analyzeUrl(article.url, article.title)
  );
  
  // Show results
  let problemCount = 0;
  
  analyses.forEach((analysis, index) => {
    const hasIssues = analysis.issues.length > 0;
    if (hasIssues) problemCount++;
    
    if (verbose || hasIssues) {
      console.log(`📄 Article ${index + 1}: "${analysis.title}"`);
      console.log(`   URL: ${analysis.url}`);
      console.log(`   Status: ${analysis.isValid ? '✅ Valid' : '❌ Invalid'}`);
      
      if (analysis.isCategoryPage) {
        console.log('   ⚠️  Category page detected');
      }
      
      if (analysis.isMalformed) {
        console.log('   🚨 Malformed URL detected');
      }
      
      if (analysis.issues.length > 0) {
        console.log('   Issues:');
        analysis.issues.forEach(issue => console.log(`     • ${issue}`));
      }
      
      if (analysis.suggestions.length > 0) {
        console.log('   Suggestions:');
        analysis.suggestions.forEach(suggestion => console.log(`     💡 ${suggestion}`));
      }
      
      console.log('');
    }
  });
  
  // Fetch sample valid URLs
  console.log('📥 Fetching sample valid BBC article URLs...\n');
  const sampleUrls = await fetchSampleBBCUrls();
  
  if (sampleUrls.length > 0) {
    console.log('✅ Sample valid BBC article URLs:');
    sampleUrls.slice(0, 5).forEach(sample => {
      console.log(`   • ${sample.title}`);
      console.log(`     URL: ${sample.url}`);
      console.log(`     Article ID: ${sample.articleId}`);
      console.log('');
    });
  }
  
  // Summary
  console.log(`📊 Summary:`);
  console.log(`   Total articles analyzed: ${analyses.length}`);
  console.log(`   Articles with issues: ${problemCount}`);
  console.log(`   Valid articles: ${analyses.length - problemCount}`);
  
  if (problemCount > 0) {
    console.log('\n🔧 To fix malformed URLs:');
    console.log('   1. Update newsController.js mock data with valid BBC article URLs');
    console.log('   2. Check RSS aggregator URL extraction logic');
    console.log('   3. Clear RSS cache to fetch fresh data');
    
    if (fix) {
      console.log('\n🚀 Apply fixes automatically? This script would:');
      console.log('   - Replace malformed URLs in mock data');
      console.log('   - Update RSS aggregator validation');
      console.log('   - Clear caches');
      console.log('   (Note: Actual fix implementation would go here)');
    }
  } else {
    console.log('\n✅ All URLs look good!');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  fix: args.includes('--fix'),
  verbose: args.includes('--verbose')
};

// Run the analysis
analyzeUrls(options).catch(console.error);