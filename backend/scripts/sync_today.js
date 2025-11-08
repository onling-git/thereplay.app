// sync_today.js
// Fetch fixtures for today's UTC date from SportMonks and upsert into Match collection.

const { connectDB, closeDB } = require('../db/connect');
const { get } = require('../utils/sportmonks');
const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');
const Match = require('../models/Match');

// Default include used across sync endpoints
const INCLUDE = 'events;participants;scores;periods;state;lineups;statistics.type;comments';

function ymd(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

async function main() {
  const mongoUrl = process.env.DBURI || process.env.MONGO_URI || process.env.MONGOURL;
  if (!mongoUrl) {
    console.error('Please set DBURI (or MONGO_URI) in the environment to point to MongoDB');
    process.exit(2);
  }

  console.log('[sync_today] connecting to DB...');
  await connectDB(mongoUrl);

  const today = new Date();
  const dateStr = ymd(today);
  console.log('[sync_today] fetching fixtures for date:', dateStr);

  try {
    let page = 1;
    const per_page = 100; // request a large page to reduce number of requests
    let totalFetched = 0;
    let upserted = 0;

    while (true) {
      console.log('[sync_today] fetching page', page, 'per_page', per_page);
      const { data } = await get(`/fixtures/date/${dateStr}`, { include: INCLUDE, page, per_page });
      const fixtures = Array.isArray(data?.data) ? data.data : [];
      if (!fixtures.length) {
        console.log('[sync_today] no more fixtures on page', page);
        break;
      }
      console.log('[sync_today] page', page, 'fetched fixtures count:', fixtures.length);
      totalFetched += fixtures.length;

      for (const fx of fixtures) {
        try {
          const doc = normaliseFixtureToMatchDoc(fx);
          if (!doc) continue;

          const existing = await Match.findOne({ match_id: doc.match_id }).lean();
          const setObj = { ...doc };
          if (Array.isArray(doc.comments) && doc.comments.length) {
            setObj.comments = doc.comments;
          } else if (existing && Array.isArray(existing.comments) && existing.comments.length) {
            delete setObj.comments;
          } else {
            setObj.comments = Array.isArray(doc.comments) ? doc.comments : [];
          }

          await Match.findOneAndUpdate({ match_id: doc.match_id }, { $set: setObj }, { upsert: true, new: true });
          upserted++;
        } catch (e) {
          console.warn('[sync_today] upsert failed for fixture', fx?.id || fx?.fixture_id, e?.message || e);
        }
      }

      // If fewer rows than per_page it's likely the last page, but continue until an empty page to be safe
      page += 1;
    }

    console.log(`[sync_today] done. totalFetched=${totalFetched} upserted=${upserted}`);
  } catch (e) {
    console.error('[sync_today] fetch failed', e?.response?.status, e?.response?.data || e.message || e);
    process.exit(2);
  } finally {
    await closeDB();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[sync_today] unexpected error', e?.message || e);
    process.exit(2);
  });
}
