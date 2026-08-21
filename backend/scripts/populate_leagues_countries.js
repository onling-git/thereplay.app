// scripts/populate_leagues_countries.js
// Populates the leagues & countries collections from SportMonks so the
// League Management admin tab has data to display.
//
// Usage:
//   node scripts/populate_leagues_countries.js                      # populate, all disabled
//   node scripts/populate_leagues_countries.js --enable-available   # also enable the leagues
//                                                                     currently hardcoded in cron
require('dotenv').config();
const mongoose = require('mongoose');
const League = require('../models/League');
const Country = require('../models/Country');
const { get } = require('../utils/sportmonks');

// Leagues currently hardcoded in cron (AVAILABLE_LEAGUES) — used by --enable-available
const DEFAULT_AVAILABLE_IDS = [
  181, 208, 244, 271, 8, 24, 9, 27, 1371, 301, 82, 387, 384, 390, 72,
  444, 453, 462, 486, 501, 570, 567, 564, 573, 591, 600, 609
];

async function fetchAll(path) {
  let results = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 100) {
    const response = await get(`${path}${path.includes('?') ? '&' : '?'}page=${page}&per_page=100`);
    const data = response.data?.data || [];
    const pagination = response.data?.pagination;

    results = results.concat(data);
    hasMore = pagination?.has_more === true || (pagination?.next_page && data.length > 0);
    page++;
  }
  return results;
}

async function main() {
  const enableAvailable = process.argv.includes('--enable-available');

  const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
  await mongoose.connect(uri);
  console.log('[populate] Connected to database');

  // --- Countries ---
  console.log('[populate] Fetching countries from SportMonks...');
  const countries = await fetchAll('/countries');
  let countryCount = 0;

  for (const c of countries) {
    await Country.updateOne(
      { id: c.id },
      {
        $set: {
          name: c.name,
          iso2: c.iso2 || undefined,
          iso3: c.iso3 || undefined,
          official_name: c.official_name || undefined,
          fifa_name: c.fifa_name || undefined
        },
        $setOnInsert: { enabled: false }
      },
      { upsert: true }
    );
    countryCount++;
  }
  console.log(`[populate] Upserted ${countryCount} countries`);

  // --- Leagues ---
  console.log('[populate] Fetching leagues from SportMonks...');
  const leagues = await fetchAll('/leagues');
  let leagueCount = 0;
  let enabledCount = 0;

  for (const l of leagues) {
    const shouldEnable = enableAvailable && DEFAULT_AVAILABLE_IDS.includes(l.id);

    await League.updateOne(
      { id: l.id },
      {
        $set: {
          name: l.name,
          short_code: l.short_code || undefined,
          image_path: l.image_path || undefined,
          country_id: l.country_id,
          type: l.type || undefined,
          sub_type: l.sub_type || undefined,
          last_played_at: l.last_played_at ? new Date(l.last_played_at) : undefined,
          category: l.category ?? undefined,
          has_jerseys: l.has_jerseys === true,
          is_cup: l.is_cup === true,
          ...(shouldEnable ? { enabled: true, priority: 50 } : {})
        },
        $setOnInsert: { enabled: false, priority: 0 }
      },
      { upsert: true }
    );
    leagueCount++;
    if (shouldEnable) enabledCount++;
  }
  console.log(`[populate] Upserted ${leagueCount} leagues`);
  if (enableAvailable) {
    console.log(`[populate] Enabled ${enabledCount} leagues matching the current cron list`);
  }

  console.log('[populate] Done.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('[populate] Failed:', err);
  process.exit(1);
});
