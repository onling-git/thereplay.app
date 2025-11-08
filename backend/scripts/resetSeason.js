// scripts/resetSeason.js
require('dotenv').config();
const mongoose = require('mongoose');

const Team = require('../models/Team');
const Match = require('../models/Match');

async function run() {
  const uri = process.env.DBURI;
  if (!uri) {
    console.error('DBURI missing');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected.');

  // 1) wipe matches
  const matchDel = await Match.deleteMany({});
  console.log(`Matches deleted: ${matchDel.deletedCount}`);

  // 2) clear team snapshots (keep team identities)
  const teamUpd = await Team.updateMany(
    {},
    {
      $unset: {
        last_match_info: 1,
        next_match_info: 1,
        last_played_at: 1,
        next_game_at: 1,
      },
    }
  );
  console.log(`Teams snapshots cleared: ${teamUpd.modifiedCount}`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
