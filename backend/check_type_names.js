// Check standings with type names
require('dotenv').config();
const { get } = require('./utils/sportmonks');

const CHAMPIONSHIP_ID = 9;

(async () => {
  try {
    console.log('🔍 Fetching standings with type names\n');

    // Get current season
    const leagueResponse = await get(`/leagues/${CHAMPIONSHIP_ID}`, {
      include: 'currentseason'
    });
    const currentSeason = leagueResponse.data?.data?.currentseason;

    // Fetch standings with details.type to get names
    const standingsResponse = await get(`/standings/seasons/${currentSeason.id}`, {
      include: 'details.type'
    });
    
    const standings = standingsResponse.data?.data;
    const firstTeam = standings[0];

    console.log(`Team at Position ${firstTeam.position}:`);
    console.log(`Points: ${firstTeam.points}\n`);
    console.log('DETAILS WITH TYPE NAMES:');
    console.log('='.repeat(100));
    
    // Sort by type_id for easier reading
    const sortedDetails = [...firstTeam.details].sort((a, b) => a.type_id - b.type_id);
    
    sortedDetails.forEach(detail => {
      const typeName = detail.type?.name || detail.type?.code || 'unknown';
      const typeCode = detail.type?.code || '';
      console.log(`type_id ${String(detail.type_id).padEnd(4)} = ${String(detail.value).padEnd(4)} | ${typeName} ${typeCode ? `(${typeCode})` : ''}`);
    });

    // Also check a few more teams to see patterns
    console.log('\n\n=== TOP 3 TEAMS SUMMARY ===');
    standings.slice(0, 3).forEach(team => {
      const detailsMap = {};
      team.details.forEach(d => {
        const name = d.type?.name || d.type?.code || `type_${d.type_id}`;
        detailsMap[name] = d.value;
      });
      
      console.log(`\nPosition ${team.position} - ${team.points} points:`);
      console.log(`  Games Played: ${detailsMap['Games Played'] || detailsMap['PLAYED'] || '?'}`);
      console.log(`  Won: ${detailsMap['Won'] || detailsMap['WON'] || '?'}`);
      console.log(`  Drawn: ${detailsMap['Drawn'] || detailsMap['DRAWN'] || '?'}`);
      console.log(`  Lost: ${detailsMap['Lost'] || detailsMap['LOST'] || '?'}`);
      console.log(`  Goals For: ${detailsMap['Goals For'] || detailsMap['GF'] || '?'}`);
      console.log(`  Goals Against: ${detailsMap['Goals Against'] || detailsMap['GA'] || '?'}`);
    });

  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.response?.data) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
})();
