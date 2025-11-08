# Fixture Seeding Script

This script seeds Premier League and Championship fixtures from today to the end of June 2025, while respecting SportMonks API rate limits.

## Features

- ✅ **Rate Limit Compliance**: Stays well under SportMonks' 3000 calls/hour limit (uses 80% safety margin)
- ✅ **Smart Batching**: Processes fixtures in batches with appropriate delays
- ✅ **Team Management**: Automatically creates teams if they don't exist
- ✅ **Duplicate Handling**: Updates existing fixtures instead of creating duplicates
- ✅ **Comprehensive Logging**: Detailed progress tracking and statistics
- ✅ **Error Handling**: Graceful error handling with retry logic for rate limits
- ✅ **Graceful Shutdown**: Handles SIGINT/SIGTERM for clean exits

## Usage

### Prerequisites

1. Ensure you have `SPORTMONKS_API_KEY` set in your `.env` file
2. Ensure you have `DBURI` set in your `.env` file for database connection

### Validation

Before running the seeding script, validate your setup:

```bash
npm run seed:fixtures:validate
```

This will check environment variables, dependencies, and Node.js version.

### Running the Script

```bash
# DRY RUN: See what would be done without making changes
npm run seed:fixtures:dry-run

# ACTUAL SEEDING: Create/update fixtures in database
npm run seed:fixtures

# Or directly with node
node seed_fixtures_dry_run.js  # Dry run
node seed_fixtures.js          # Actual seeding
```

**⚠️ Important**: Always run the dry run first to see what will be changed!

### What it does

1. **Fetches fixtures** for Premier League (ID: 8) and Championship (ID: 9)
2. **Date range**: From today to June 30, 2025
3. **Creates/updates teams** as needed based on fixture participants
4. **Saves fixtures** to the Match collection with proper structure
5. **Provides detailed progress** with statistics and timing information

### Rate Limiting Strategy

- **Target**: 2400 calls/hour (80% of 3000 limit for safety)
- **Delay between calls**: 1.5 seconds
- **Batch processing**: 50 fixtures per batch
- **Delay between batches**: 5 seconds
- **Automatic rate limit detection**: Waits if approaching limits

### Output Example

```
🚀 Starting fixture seeding process...
📅 Date range: 2025-11-06 to 2025-06-30
⚡ Rate limit: 2400 calls/hour (80% of 3000)
✅ Connected to database

🔍 Fetching Premier League fixtures from 2025-11-06 to 2025-06-30...
📄 Page 1: Found 45 fixtures
✅ Total Premier League fixtures found: 45

💾 Processing 45 Premier League fixtures...
📦 Processing batch 1/1 (45 fixtures)
➕ Created: Arsenal vs Manchester City
➕ Created: Liverpool vs Chelsea
...

📊 Premier League Processing Summary:
   • Processed: 45
   • Created: 45
   • Updated: 0
   • Errors: 0

🎉 Fixture seeding completed!
⏱️  Total time: 2m 34s
📊 Overall Summary:
   • Total API calls: 12
   • Fixtures processed: 90
   • Fixtures created: 90
   • Fixtures updated: 0
   • Errors: 0
```

### League IDs

The script currently handles:
- **Premier League**: SportMonks ID 8
- **Championship**: SportMonks ID 9

To add more leagues, modify the `LEAGUE_IDS` object in `seed_fixtures.js`.

### Configuration

Key configuration options in the script:

```javascript
const RATE_LIMIT = {
  MAX_CALLS_PER_HOUR: 3000,
  SAFETY_MARGIN: 0.8, // Use only 80% of rate limit
  BATCH_SIZE: 50,
  DELAY_BETWEEN_CALLS: 1500, // 1.5 seconds
  DELAY_BETWEEN_BATCHES: 5000 // 5 seconds
};
```

### Error Handling

- **Rate limits**: Automatically waits and retries
- **Missing data**: Logs warnings and continues
- **Network errors**: Proper error reporting with context
- **Database errors**: Continues processing other fixtures

### Data Structure

Fixtures are saved to the `Match` collection with the following key fields:
- `match_id`: SportMonks fixture ID
- `date`: Match date/time
- `teams.home/away`: Team information
- `match_info`: Detailed match metadata (venue, season, league)
- `match_status`: Current match status
- `score`: Home/away scores (initialized to 0/0)

The script ensures compatibility with your existing Match model structure.