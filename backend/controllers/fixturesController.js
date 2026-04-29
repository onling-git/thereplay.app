// controllers/fixturesController.js
const Match = require('../models/Match');
const Country = require('../models/Country');
const League = require('../models/League');

/**
 * GET /api/fixtures
 * Returns all fixtures organized by country and league with filtering capabilities
 */
exports.getAllFixtures = async (req, res) => {
  try {
    const { date, country, league, live, limit = 50, offset = 0 } = req.query;

    // Build match filter
    let matchFilter = {};

    // Live games filtering
    if (live === 'true') {
      matchFilter.$or = [
        { 'match_status.short_name': { $in: ['LIVE', '1H', '2H', 'HT', 'ET'] } },
        { minute: { $ne: null, $gt: 0 } }
      ];
    } else {
      // Date filtering (only apply if not filtering for live games)
      if (date) {
        const targetDate = new Date(date);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        matchFilter['match_info.starting_at'] = {
          $gte: targetDate,
          $lt: nextDay
        };
      } else {
        // Default to today's matches if no date specified
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        matchFilter['match_info.starting_at'] = {
          $gte: today,
          $lt: tomorrow
        };
      }
    }

    // Country filtering
    if (country) {
      matchFilter['match_info.league.country_id'] = parseInt(country);
    }

    // League filtering
    if (league) {
      matchFilter['match_info.league.id'] = parseInt(league);
    }

    // Get fixtures with aggregation to organize by country and league
    const fixtures = await Match.aggregate([
      { $match: matchFilter },
      {
        $lookup: {
          from: 'teams',
          localField: 'teams.home.team_id',
          foreignField: 'id',
          as: 'home_team_info'
        }
      },
      {
        $lookup: {
          from: 'teams',
          localField: 'teams.away.team_id',
          foreignField: 'id',
          as: 'away_team_info'
        }
      },
      {
        $addFields: {
          home_team_country: { $arrayElemAt: ['$home_team_info.country_id', 0] },
          away_team_country: { $arrayElemAt: ['$away_team_info.country_id', 0] },
          home_team_country_name: { $arrayElemAt: ['$home_team_info.country_name', 0] },
          away_team_country_name: { $arrayElemAt: ['$away_team_info.country_name', 0] }
        }
      },
      {
        $project: {
          match_id: 1,
          teams: 1,
          score: 1,
          match_status: 1,
          match_info: 1,
          minute: 1,
          home_team_country: 1,
          away_team_country: 1,
          home_team_country_name: 1,
          away_team_country_name: 1
        }
      },
      { $sort: { 'match_info.starting_at': 1 } },
      { $skip: parseInt(offset) },
      { $limit: parseInt(limit) }
    ]);

    // Get all countries from database for name mapping
    const countries = await Country.find({}, 'id name').lean();
    const countryMap = {};
    countries.forEach(country => {
      countryMap[country.id] = country.name;
    });

    // Organize fixtures by country and league
    const organizedFixtures = {};

    fixtures.forEach(fixture => {
      const league = fixture.match_info.league;
      const countryId = league.country_id;
      const countryName = countryMap[countryId] || `Country ${countryId}`;
      
      // Initialize country if not exists
      if (!organizedFixtures[countryId]) {
        organizedFixtures[countryId] = {
          id: countryId,
          name: countryName,
          leagues: {}
        };
      }

      // Initialize league if not exists
      if (!organizedFixtures[countryId].leagues[league.id]) {
        organizedFixtures[countryId].leagues[league.id] = {
          id: league.id,
          name: league.name,
          short_code: league.short_code,
          image_path: league.image_path,
          fixtures: []
        };
      }

      // Add fixture to league
      organizedFixtures[countryId].leagues[league.id].fixtures.push(fixture);
    });

    // Convert to array format for easier frontend handling
    const result = Object.values(organizedFixtures).map(country => ({
      ...country,
      leagues: Object.values(country.leagues)
    }));

    // Get total count for pagination
    const totalCount = await Match.countDocuments(matchFilter);

    res.json({
      fixtures: result,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
      }
    });
  } catch (e) {
    console.warn('[fixtures] getAllFixtures failed', e?.message || e);
    res.status(500).json({ error: 'Failed to get fixtures', detail: e?.message || e });
  }
};

/**
 * GET /api/fixtures/countries
 * Returns list of countries that have fixtures
 */
exports.getFixtureCountries = async (req, res) => {
  try {
    // Get countries that have fixtures, with their names from the Country collection
    const countriesWithFixtures = await Match.aggregate([
      { $match: { 'match_info.league.country_id': { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$match_info.league.country_id',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'countries',
          localField: '_id',
          foreignField: 'id',
          as: 'country'
        }
      },
      {
        $project: {
          id: '$_id',
          count: 1,
          name: {
            $cond: {
              if: { $gt: [{ $size: '$country' }, 0] },
              then: { $arrayElemAt: ['$country.name', 0] },
              else: { $concat: ['Country ', { $toString: '$_id' }] }
            }
          },
          iso2: { $arrayElemAt: ['$country.iso2', 0] },
          flag_path: { $arrayElemAt: ['$country.flag_path', 0] },
          _id: 0
        }
      },
      { $sort: { count: -1 } } // Sort by fixture count descending
    ]);

    const countriesWithNames = countriesWithFixtures;

    res.json(countriesWithNames);
  } catch (e) {
    console.warn('[fixtures] getFixtureCountries failed', e?.message || e);
    res.status(500).json({ error: 'Failed to get fixture countries', detail: e?.message || e });
  }
};

/**
 * GET /api/fixtures/leagues
 * Returns list of leagues that have fixtures, optionally filtered by country
 */
exports.getFixtureLeagues = async (req, res) => {
  try {
    const { country } = req.query;
    let matchFilter = { 'match_info.league.id': { $exists: true, $ne: null } };
    
    if (country) {
      matchFilter['match_info.league.country_id'] = parseInt(country);
    }

    const leagues = await Match.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$match_info.league.id',
          name: { $first: '$match_info.league.name' },
          short_code: { $first: '$match_info.league.short_code' },
          image_path: { $first: '$match_info.league.image_path' },
          country_id: { $first: '$match_info.league.country_id' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          id: '$_id',
          name: 1,
          short_code: 1,
          image_path: 1,
          country_id: 1,
          count: 1,
          _id: 0
        }
      },
      { $sort: { name: 1 } }
    ]);

    res.json(leagues);
  } catch (e) {
    console.warn('[fixtures] getFixtureLeagues failed', e?.message || e);
    res.status(500).json({ error: 'Failed to get fixture leagues', detail: e?.message || e });
  }
};