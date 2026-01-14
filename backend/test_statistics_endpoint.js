// Test script to verify statistics endpoint functionality
require('dotenv').config();
const axios = require('axios');
const { fetchMatchStats } = require('./controllers/matchSyncController');

async function testStatisticsEndpoint() {
  console.log('🧪 Testing Statistics Endpoint Functionality');
  console.log('=' .repeat(50));

  // Test with a known match ID (Southampton vs Millwall from previous examples)
  const testMatchId = 19432044;
  
  try {
    console.log(`\n1. Testing SportMonks API statistics fetch for match ${testMatchId}...`);
    
    const sportMonksData = await fetchMatchStats(testMatchId, { includeStatistics: true });
    
    if (sportMonksData) {
      console.log('✅ Successfully fetched data from SportMonks API');
      console.log(`   - Fetched with include: ${sportMonksData._fetched_with_include}`);
      console.log(`   - Has participants: ${sportMonksData.participants ? 'Yes' : 'No'}`);
      console.log(`   - Has statistics: ${sportMonksData.statistics ? 'Yes (' + sportMonksData.statistics.length + ')' : 'No'}`);
      
      if (sportMonksData.statistics && sportMonksData.statistics.length > 0) {
        console.log('   - Sample statistics:');
        sportMonksData.statistics.slice(0, 3).forEach((stat, i) => {
          console.log(`     ${i + 1}. ${stat.type?.name || 'Unknown'}: ${stat.value} (Participant: ${stat.participant_id})`);
        });
      }
      
      if (sportMonksData.participants) {
        console.log('   - Participants:');
        sportMonksData.participants.forEach(p => {
          console.log(`     - ${p.name} (ID: ${p.id}, Location: ${p.meta?.location})`);
        });
      }
    } else {
      console.log('❌ Failed to fetch data from SportMonks API');
      return;
    }

    console.log('\n2. Testing local API endpoint...');
    
    // Try to find a team slug that would work with this match
    // For match 19432044, we know it's Southampton vs Millwall based on previous examples
    const teamSlug = 'southampton';  // We'll use Southampton as we know this should exist
    console.log(`   Testing with team slug: ${teamSlug}`);
    
    // Test the local API endpoint
    const apiUrl = `http://localhost:3001/api/${teamSlug}/match/${testMatchId}?include_statistics=true`;
    console.log(`   Making request to: ${apiUrl}`);
    
    try {
      const response = await axios.get(apiUrl);
      
      if (response.data && response.data.statistics) {
        console.log('✅ Successfully fetched statistics from local API');
        console.log(`   - Home stats count: ${response.data.statistics.home?.length || 0}`);
        console.log(`   - Away stats count: ${response.data.statistics.away?.length || 0}`);
        
        if (response.data.statistics.home?.length > 0) {
          console.log('   - Sample home statistics:');
          response.data.statistics.home.slice(0, 3).forEach((stat, i) => {
            console.log(`     ${i + 1}. ${stat.type}: ${stat.value}`);
          });
        }
      } else {
        console.log('⚠️  API response received but no statistics found');
        console.log('   Response keys:', Object.keys(response.data || {}));
      }
      
    } catch (apiError) {
      if (apiError.response?.status === 404) {
        console.log('⚠️  Match or team not found in local database');
        console.log('   This is expected if the match hasn\'t been imported yet');
      } else {
        console.log('❌ Local API request failed:', apiError.message);
        if (apiError.response?.data) {
          console.log('   Error details:', apiError.response.data);
        }
      }
    }

    console.log('\n3. Testing statistics data transformation...');
    
    if (sportMonksData.statistics && sportMonksData.participants) {
      // Import the transform function utilities
      const { getStatisticTypeName } = require('./utils/statisticTypes');
      
      const testTransformStatistics = (statistics, participants) => {
        if (!statistics || !Array.isArray(statistics)) {
          return { home: [], away: [] };
        }
      
        const homeParticipant = participants?.find(p => p.meta?.location === 'home');
        const awayParticipant = participants?.find(p => p.meta?.location === 'away');
      
        const result = { home: [], away: [] };
      
        statistics.forEach(stat => {
          const transformedStat = {
            type_id: stat.type_id,
            type: getStatisticTypeName(stat.type_id),
            value: stat.data?.value || stat.value || 0,
            participant_id: stat.participant_id
          };
      
          if (stat.participant_id === homeParticipant?.id) {
            result.home.push(transformedStat);
          } else if (stat.participant_id === awayParticipant?.id) {
            result.away.push(transformedStat);
          }
        });
      
        return result;
      };
      
      const transformed = testTransformStatistics(sportMonksData.statistics, sportMonksData.participants);
      
      console.log('✅ Statistics transformation completed');
      console.log(`   - Transformed home stats: ${transformed.home.length}`);
      console.log(`   - Transformed away stats: ${transformed.away.length}`);
      
      if (transformed.home.length > 0) {
        console.log('   - Sample transformed home stats:');
        transformed.home.slice(0, 3).forEach((stat, i) => {
          console.log(`     ${i + 1}. ${stat.type}: ${stat.value}`);
        });
      }
      
      if (transformed.away.length > 0) {
        console.log('   - Sample transformed away stats:');
        transformed.away.slice(0, 3).forEach((stat, i) => {
          console.log(`     ${i + 1}. ${stat.type}: ${stat.value}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🏁 Statistics endpoint test completed');
}

// Run the test
if (require.main === module) {
  testStatisticsEndpoint().catch(console.error);
}

module.exports = { testStatisticsEndpoint };