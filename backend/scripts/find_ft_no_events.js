#!/usr/bin/env node
// scripts/find_ft_no_events.js
// Find sample matches marked FT but with no events stored

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const connectDB = require('../db/connect');
const Match = require('../models/Match');

(async ()=>{
  try{
    await connectDB(process.env.DBURI || process.env.MONGO_URL || process.env.MONGODB_URI);
    const q = { 'match_status.short_name': { $in: ['FT', 'FTP', 'FT_PEN', 'FT_P'] , $exists: true } , $or: [ { events: { $exists: false } }, { 'events.0': { $exists: false } }, { events: { $size: 0 } } ] };
    const docs = await Match.find(q).limit(10).lean();
    console.log('found', docs.length);
    for (const d of docs) console.log(d.match_id, d.match_status && d.match_status.short_name, d.date, 'events:', (d.events || []).length);
    process.exit(0);
  }catch(e){
    console.error(e);
    process.exit(1);
  }
})();