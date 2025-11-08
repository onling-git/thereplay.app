// scripts/print_reports_19431868.js
// Reads backend/.env to extract DBURI, connects to MongoDB and prints report docs for match 19431868

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Report = require('../models/Report');

function readDbUri() {
  const envPath = path.join(__dirname, '..', '.env');
  const content = fs.readFileSync(envPath, 'utf8');
  const m = content.match(/^DBURI\s*=\s*['"]?(.*)['"]?\s*$/m);
  if (m) return m[1];
  // fallback names
  const m2 = content.match(/^MONGO_URI\s*=\s*['"]?(.*)['"]?\s*$/m);
  if (m2) return m2[1];
  throw new Error('DBURI not found in .env');
}

async function main() {
  const uri = readDbUri();
  console.log('Connecting to', uri);
  await mongoose.connect(uri);
  const docs = await Report.find({ match_id: 19431868 }).lean();
  console.log('Found', docs.length, 'reports:\n');
  console.log(JSON.stringify(docs, null, 2));
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
