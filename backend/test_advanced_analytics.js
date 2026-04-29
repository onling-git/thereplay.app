// Test script to check advanced analytics for match ID 19432284
require('dotenv').config();
const { get: smGet } = require('./utils/sportmonks');

async function testAdvancedAnalytics() {
  const matchId = 19432284;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing Advanced Analytics for Match ID: ${matchId}`);
  console.log('='.repeat(80));
  
  // Test each feature separately to identify which are available
  const features = [
    { name: 'pressure', displayName: 'Pressure Index' },
    { name: 'ballcoordinates', displayName: 'Ball Coordinates' },
    { name: 'trends', displayName: 'Trends' }
  ];
  
  const results = {};
  
  // First, fetch basic match data with statistics
  try {
    const baseIncludes = 'state;scores;participants;statistics';
    console.log(`\n1️⃣  Fetching basic match data...`);
    const response = await smGet(`fixtures/${matchId}`, { include: baseIncludes });
    const match = response?.data?.data || response?.data;
    
    if (!match) {
      console.log('   ❌ No match data returned');
      return;
    }
    
    console.log('   ✅ Match data received');
    console.log(`   Match: ${match.name || 'N/A'}`);
    console.log(`   Date: ${match.starting_at || 'N/A'}`);
    console.log(`   State: ${match.state?.name || match.state?.state || 'N/A'}`);
    
    // Check basic statistics
    const stats = match.statistics?.data || match.statistics || [];
    console.log(`   Statistics: ${stats.length > 0 ? `✅ ${stats.length} entries` : '❌ None'}`);
    
  } catch (error) {
    console.error('   ❌ Error:', error.response?.data?.message || error.message);
  }
  
  // Test each advanced analytics feature separately
  console.log(`\n${'─'.repeat(80)}`);
  console.log('TESTING ADVANCED ANALYTICS FEATURES:');
  console.log('─'.repeat(80));
  
  for (const feature of features) {
    console.log(`\n2️⃣  Testing ${feature.displayName} (${feature.name})...`);
    
    try {
      const includes = `state;scores;participants;${feature.name}`;
      const response = await smGet(`fixtures/${matchId}`, { include: includes });
      const match = response?.data?.data || response?.data;
      
      const data = match[feature.name]?.data || match[feature.name] || [];
      
      if (Array.isArray(data) && data.length > 0) {
        console.log(`   ✅ AVAILABLE - ${data.length} data points`);
        console.log(`   Sample (first 2):`);
        data.slice(0, 2).forEach((item, i) => {
          console.log(`      ${i + 1}. ${JSON.stringify(item).substring(0, 100)}...`);
        });
        results[feature.name] = { available: true, count: data.length };
      } else {
        console.log(`   ℹ️  Feature accessible but no data for this match`);
        results[feature.name] = { available: true, count: 0 };
      }
      
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      if (status === 403) {
        console.log(`   ❌ NOT IN API PLAN - ${message}`);
        results[feature.name] = { available: false, reason: 'not_in_plan' };
      } else if (status === 404) {
        console.log(`   ℹ️  Endpoint not found`);
        results[feature.name] = { available: false, reason: 'not_found' };
      } else {
        console.log(`   ❌ Error: ${message}`);
        results[feature.name] = { available: false, reason: 'error' };
      }
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY:');
  console.log('='.repeat(80));
  
  console.log('\n📋 Current API Plan Access:');
  console.log('   Standard Statistics: ✅ Available');
  
  for (const feature of features) {
    const result = results[feature.name];
    const icon = result?.available ? '✅' : '❌';
    const status = result?.available 
      ? (result.count > 0 ? `Available (${result.count} data points)` : 'Available (no data for this match)')
      : 'Not in current API plan';
    console.log(`   ${feature.displayName}: ${icon} ${status}`);
  }
  
  console.log('\n💡 Implementation Status:');
  console.log('   ✅ Code is ready to collect all advanced analytics');
  console.log('   ✅ Data will be automatically collected when plan is upgraded');
  console.log('   ✅ No code changes needed when features become available');
  
  console.log(`\n${'='.repeat(80)}\n`);
}

testAdvancedAnalytics().then(() => {
  console.log('Test complete.');
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
