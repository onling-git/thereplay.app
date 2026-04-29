// Test script to verify countries endpoint
const mongoose = require('mongoose');
require('dotenv').config();

const Team = require('./models/Team');
const Country = require('./models/Country');

async function testCountries() {
  try {
    await mongoose.connect(process.env.DBURI || 'mongodb://localhost:27017/test');
    console.log('✅ Connected to database\n');

    // First get country IDs and team counts from Teams collection
    console.log('📊 Getting team counts by country...');
    const teamCountsByCountry = await Team.aggregate([
      { $match: { country_id: { $exists: true, $ne: null } } },
      { $group: { 
        _id: '$country_id',
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);
    
    console.log(`Found ${teamCountsByCountry.length} countries with teams\n`);
    
    const countryIds = teamCountsByCountry.map(c => c._id);
    console.log(`Country IDs: ${countryIds.slice(0, 10).join(', ')}...\n`);
    
    // Fetch country names from Country collection
    console.log('🌍 Fetching country names from Country collection...');
    const countryDocuments = await Country.find(
      { id: { $in: countryIds } },
      'id name'
    ).lean();
    
    console.log(`Found ${countryDocuments.length} country documents\n`);
    console.log('Sample countries:');
    countryDocuments.slice(0, 10).forEach(c => {
      console.log(`  - ${c.id}: ${c.name}`);
    });
    
    // Create a mapping of country_id to name
    const countryNameMap = {};
    countryDocuments.forEach(country => {
      countryNameMap[country.id] = country.name;
    });
    
    // Combine team counts with country names
    const countries = teamCountsByCountry.map(item => ({
      id: item._id,
      name: countryNameMap[item._id] || `Country ${item._id}`,
      team_count: item.count
    }));
    
    // Sort by country name
    countries.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log('\n📋 Final result (first 15):');
    countries.slice(0, 15).forEach(c => {
      console.log(`  ${c.name} (ID: ${c.id}) - ${c.team_count} teams`);
    });
    
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

testCountries();
