# Quick Start Guide: Match Report Pipeline V2

## 5-Minute Setup

### Step 1: Add Environment Variables

Copy to your `.env`:

```bash
INTERPRETATION_MODEL=gpt-4o-mini
REPORT_MODEL=gpt-4o-mini
# Your existing OPENAI_API_KEY should already be set
```

### Step 2: Test the Pipeline

Run the test script:

```bash
node backend/scripts/testReportPipeline.js
```

This will:
- Connect to your database
- Generate a report for a default match
- Show Step 1 interpretation output
- Show Step 2 final report
- Display performance metrics

### Step 3: Add Routes

In `backend/server.js` or `backend/app.js`, add:

```javascript
const reportsV2Routes = require('./routes/reportsV2');
app.use('/api/reports/v2', reportsV2Routes);
```

### Step 4: Generate Your First Report

Manual generation via API:

```bash
curl -X POST http://localhost:3000/api/reports/v2/generate/19631550/southampton
```

Or in your code:

```javascript
const { generateReportPipeline } = require('./services/reportPipeline');

const { report } = await generateReportPipeline({
  matchId: 19631550,
  teamSlug: 'southampton'
});

console.log(report);
```

## Choose Your Automation Method

### Option A: Webhook (Recommended)

If your match data provider supports webhooks:

```javascript
// Already set up in routes/reportsV2.js
// Endpoint: POST /api/reports/v2/webhook/match-status

// Configure your provider to send:
{
  "match_id": 123456,
  "status": "Finished",
  "timestamp": "2024-01-15T20:00:00Z"
}
```

### Option B: Cron Job

Add to `backend/cron/cronOptimized.js`:

```javascript
const { checkRecentlyFinishedMatches } = require('../webhooks/matchStatusWebhook');

// Run every 15 minutes
async function autoGenerateReports() {
  await checkRecentlyFinishedMatches();
}

// Or use with node-cron:
const cron = require('node-cron');
cron.schedule('*/15 * * * *', autoGenerateReports);
```

## Output Structure

```json
{
  "headline": "Southampton secure FA Cup progress...",
  "summary_paragraphs": [
    "Paragraph 1 text...",
    "Paragraph 2 text...",
    "Paragraph 3 text..."
  ],
  "key_moments": [
    "5' - John Doe opens the scoring",
    "34' - Yellow card for Jane Smith"
  ],
  "commentary": [
    "Analytical paragraph 1...",
    "Analytical paragraph 2..."
  ],
  "player_of_the_match": {
    "player": "John Doe",
    "reason": "Highest rating (8.5) with goal and assist"
  },
  "embedded_tweets": [
    {
      "tweet_id": "123456",
      "text": "What a performance from Doe...",
      "author": {...},
      "engagement": {...}
    }
  ],
  "meta": {
    "generated_by": "gpt-4o-mini",
    "pipeline": {
      "version": "2.0",
      "interpretation_time_ms": 850,
      "writing_time_ms": 1200,
      "total_time_ms": 2050
    }
  }
}
```

## Key Features

✅ **2-step process**: Interpretation → Writing  
✅ **Competition-aware**: Automatically detects cup vs league  
✅ **Tweet integration**: Max 2, selected intelligently, always verbatim  
✅ **Hallucination prevention**: Evidence-first approach  
✅ **Fast**: ~2 seconds end-to-end  
✅ **Cost-effective**: ~$0.0015 per report with gpt-4o-mini  
✅ **Production-ready**: Webhook + cron job support  

## Common Issues

**Problem**: "OpenAI API key not found"  
**Solution**: Add `OPENAI_API_KEY=sk-...` to `.env`

**Problem**: "Match not found"  
**Solution**: Verify match exists in database with that match_id

**Problem**: "No tweets available"  
**Solution**: Normal - not all matches will have tweets. Report will generate without them.

**Problem**: Reports mention "three points" in cup matches  
**Solution**: Check that match_info.league is correctly set with cup competition name

## Upgrading Report Quality

For better writing quality, upgrade Step 2 to GPT-4o:

```bash
# In .env
INTERPRETATION_MODEL=gpt-4o-mini  # Keep this cheap
REPORT_MODEL=gpt-4o               # Upgrade this
```

Cost impact:
- Before: ~$0.0015 per report
- After: ~$0.01 per report
- Quality: Noticeably better prose

## Next Steps

1. ✅ Test with your matches
2. ✅ Set up webhook OR cron job
3. ✅ Monitor costs in OpenAI dashboard
4. ✅ Adjust models based on quality/cost needs
5. ✅ Add custom logic if needed (see `MATCH_REPORT_PIPELINE_V2.md`)

## Support Files

- `MATCH_REPORT_PIPELINE_V2.md` - Full documentation
- `PIPELINE_ARCHITECTURE.md` - System architecture and flow diagrams
- `.env.pipeline.example` - Environment variable reference

## That's It!

You now have a production-ready 2-step match report generation pipeline.

Generate reports with:
```javascript
const { report } = await generateReportPipeline({
  matchId: yourMatchId,
  teamSlug: yourTeamSlug
});
```

Or let webhooks/cron handle it automatically after matches finish.
