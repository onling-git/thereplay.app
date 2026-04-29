// controllers/countriesController.js
const Country = require('../models/Country');
const League = require('../models/League');

/**
 * GET /api/countries
 * Returns all countries with optional filters
 */
exports.getAllCountries = async (req, res) => {
  try {
    const { continent, hasLeagues, search, limit = 100, offset = 0 } = req.query;

    // Build filter
    let filter = {};
    
    if (continent) {
      filter.continent_id = parseInt(continent);
    }
    
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    // Get countries
    let query = Country.find(filter)
      .select('id name iso2 iso3 continent_name flag_path')
      .sort({ name: 1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));

    const countries = await query.lean();

    // If filtering by hasLeagues, join with leagues
    if (hasLeagues === 'true') {
      const countryIds = countries.map(c => c.id);
      const leaguesCount = await League.aggregate([
        { $match: { country_id: { $in: countryIds } } },
        { $group: { _id: '$country_id', count: { $sum: 1 } } }
      ]);
      
      const leagueCountMap = {};
      leaguesCount.forEach(lc => {
        leagueCountMap[lc._id] = lc.count;
      });
      
      // Filter countries that have leagues
      const countriesWithLeagues = countries.filter(c => leagueCountMap[c.id] > 0);
      
      // Add league count to each country
      countriesWithLeagues.forEach(c => {
        c.league_count = leagueCountMap[c.id] || 0;
      });
      
      return res.json({
        countries: countriesWithLeagues,
        total: countriesWithLeagues.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    }

    // Get total count for pagination
    const total = await Country.countDocuments(filter);

    res.json({
      countries,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: (parseInt(offset) + parseInt(limit)) < total
    });

  } catch (e) {
    console.warn('[countries] getAllCountries failed', e?.message || e);
    res.status(500).json({ error: 'Failed to get countries', detail: e?.message || e });
  }
};

/**
 * GET /api/countries/:id
 * Returns specific country with its leagues
 */
exports.getCountryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get country
    const country = await Country.findOne({ id: parseInt(id) }).lean();
    
    if (!country) {
      return res.status(404).json({ error: 'Country not found' });
    }
    
    // Get leagues for this country
    const leagues = await League.find({ country_id: parseInt(id) })
      .select('id name short_code image_path type')
      .sort({ name: 1 })
      .lean();
    
    country.leagues = leagues;
    country.league_count = leagues.length;
    
    res.json(country);
    
  } catch (e) {
    console.warn('[countries] getCountryById failed', e?.message || e);
    res.status(500).json({ error: 'Failed to get country', detail: e?.message || e });
  }
};

/**
 * GET /api/countries/continents
 * Returns list of continents
 */
exports.getContinents = async (req, res) => {
  try {
    const continents = await Country.aggregate([
      { $match: { continent_id: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$continent_id',
          name: { $first: '$continent_name' },
          country_count: { $sum: 1 }
        }
      },
      {
        $project: {
          id: '$_id',
          name: 1,
          country_count: 1,
          _id: 0
        }
      },
      { $sort: { name: 1 } }
    ]);

    res.json(continents);
  } catch (e) {
    console.warn('[countries] getContinents failed', e?.message || e);
    res.status(500).json({ error: 'Failed to get continents', detail: e?.message || e });
  }
};