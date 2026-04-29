# Match Report Generation Pipeline v2.0

## Overview

This is a **2-step pipeline** for generating high-quality, narrative-driven match reports with reduced hallucinations and improved structure.

### Architecture

```
RAW MATCH DATA → STEP 1: Interpretation → STEP 2: Writing → FINAL REPORT
                 (fast, cheap)           (quality, detailed)
```

**STEP 1: Match Interpretation** (`services/matchInterpretation.js`)
- Analyzes raw match data (events, stats, ratings, tweets)
- Extracts narrative structure (first half, second half, key moments, momentum)
- Uses cheaper/faster model (e.g., `gpt-4o-mini`)
- Output: Structured JSON with match story

**STEP 2: Match Report Writing** (`services/matchReportWriter.js`)
- Takes interpretation + raw data
- Generates full match report following narrative structure
- Uses same or better model with detailed writing prompt
- Output: Complete report JSON (headline, paragraphs, commentary, etc.)

---

## Files Created

1. **`services/matchInterpretation.js`** - Step 1: Narrative extraction
2. **`services/matchReportWriter.js`** - Step 2: Report writing
3. **`services/reportPipeline.js`** - Orchestrator combining both steps
4. **`controllers/reportControllerV2.js`** - Updated controller with new pipeline
5. **`webhooks/matchStatusWebhook.js`** - Webhook handler for automatic generation

---

## Quick Start

### 1. Environment Variables

Add to your `.env`:

```bash
# Step 1: Interpretation (fast model)
INTERPRETATION_MODEL=gpt-4o-mini

# Step 2: Writing (quality model)
REPORT_MODEL=gpt-4o-mini

# OpenAI API key (already exists)
OPENAI_API_KEY=your_key
```

### 2. Basic Usage

```javascript
const { generateReportPipeline } = require('./services/reportPipeline');

// Generate a report
const result = await generateReportPipeline({
  matchId: 123456,
  teamSlug: 'arsenal',
  options: {
    saveInterpretation: true // Optional: save Step 1 output for debugging
  }
});

console.log(result.report); // Final report
console.log(result.interpretation); // Step 1 output
console.log(result.metadata); // Match/team info
```

### 3. Integration with Existing Routes

Add to your `routes/reports.js`:

```javascript
const { generateReportV2, batchGenerateReports } = require('../controllers/reportControllerV2');

// Single report generation
router.post('/generate/:matchId/:teamSlug', generateReportV2);

// Batch generation (for webhooks/cron)
router.post('/batch-generate', batchGenerateReports);
```

---

## Webhook Setup (Recommended)

For **automatic post-match report generation**, set up a webhook:

### Option A: External Webhook

If your data provider supports webhooks, configure:

```javascript
const express = require('express');
const { handleMatchStatusWebhook } = require('./webhooks/matchStatusWebhook');

const app = express();

// Webhook endpoint
app.post('/api/webhooks/match-status', handleMatchStatusWebhook);
```

**Webhook Payload:**
```json
{
  "match_id": 123456,
  "status": "Finished",
  "timestamp": "2024-01-15T20:00:00Z"
}
```

The webhook will:
1. Respond immediately (200 OK)
2. Queue report generation in background
3. Generate reports for both teams
4. Save to database

### Option B: Cron Job

If webhooks aren't available, use a cron job:

```javascript
const cron = require('node-cron');
const { checkRecentlyFinishedMatches } = require('./webhooks/matchStatusWebhook');

// Run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('[Cron] Checking for finished matches...');
  await checkRecentlyFinishedMatches();
});
```

This scans for matches finished in the last 2 hours that don't have reports.

---

## API Reference

### Generate Single Report

**Endpoint:** `POST /api/reports/generate/:matchId/:teamSlug`

**Query Params:**
- `debug=true` - Return Step 1 interpretation in response

**Response:**
```json
{
  "ok": true,
  "report": {
    "headline": "...",
    "summary_paragraphs": ["...", "..."],
    "key_moments": ["5' - Goal", "34' - Card"],
    "commentary": ["...", "..."],
    "player_of_the_match": {
      "player": "Player Name",
      "reason": "Justification"
    },
    "embedded_tweets": [...],
    "meta": {
      "generated_by": "gpt-4o-mini",
      "pipeline": {
        "version": "2.0",
        "interpretation_time_ms": 850,
        "writing_time_ms": 1200,
        "total_time_ms": 2050
      }
    }
  },
  "debug": {
    "interpretation": {...} // Only if debug=true
  }
}
```

### Batch Generate Reports

**Endpoint:** `POST /api/reports/batch-generate`

**Body:**
```json
{
  "matchIds": [123456, 123457, 123458]
}
```

**Response:**
```json
{
  "ok": true,
  "results": [
    {
      "matchId": 123456,
      "home": "arsenal",
      "away": "chelsea",
      "success": true
    }
  ],
  "errors": [],
  "summary": {
    "total": 3,
    "successful": 3,
    "failed": 0
  }
}
```

---

## Key Features

### 1. Competition Context

The pipeline automatically detects **cup vs league** competitions:

**Cup Competitions:**
- Never mentions "three points", "league table", "standings"
- Uses "progress", "advance", "knockout victory"
- Mentions stage (quarter-final, semi-final, etc.)

**League Competitions:**
- Can mention points, table position
- Standard league language

### 2. Tweet Integration

- Max 2 tweets embedded
- Selected intelligently in Step 1
- Always verbatim (no paraphrasing)
- Optional - won't mention social media if no tweets

### 3. Player of the Match

- Based on highest player rating
- Justified using match events
- Never invented

### 4. Hallucination Prevention

**Forbidden:**
- Shot quality ("rifled", "curled", "stunning")
- Visual details not in data
- Invented events or players
- Crowd/weather/emotions

**Allowed:**
- Timing ("early goal", "late winner")
- Game state ("levelled the match")
- Inferred momentum from event sequences

---

## Performance

Typical generation times:

| Step | Model | Time | Cost |
|------|-------|------|------|
| Step 1: Interpretation | gpt-4o-mini | 800-1200ms | ~$0.0005 |
| Step 2: Writing | gpt-4o-mini | 1200-1800ms | ~$0.001 |
| **Total** | | **~2s** | **~$0.0015** |

For higher quality, use `gpt-4o` for Step 2:
- Step 2 time: 2000-3000ms
- Cost: ~$0.01 per report

---

## Migration from V1

If you have existing report generation code:

### Before (Single Step):
```javascript
const report = await generateReportFor(matchId, teamSlug);
```

### After (2-Step Pipeline):
```javascript
const { report } = await generateReportPipeline({
  matchId,
  teamSlug,
  options: {}
});
```

The output format is **compatible** with your existing `Report` model.

---

## Debugging

### Enable Step 1 Output

```javascript
const result = await generateReportPipeline({
  matchId,
  teamSlug,
  options: { saveInterpretation: true }
});

console.log(result.interpretation);
// {
//   first_half: { summary: "...", key_moments: [...], momentum: "home" },
//   second_half: { summary: "...", key_moments: [...], momentum: "away" },
//   decisive_moment: { minute: 78, description: "...", why_decisive: "..." },
//   overall_story: "...",
//   momentum_shifts: [...],
//   selected_tweets: [...]
// }
```

### Check Timing

The `meta.pipeline` object includes:
- `interpretation_time_ms` - Step 1 duration
- `writing_time_ms` - Step 2 duration
- `total_time_ms` - End-to-end

### Logs

All services log to console:
- `[ReportPipeline]` - Main orchestrator
- `[MatchStatusWebhook]` - Webhook processing
- `[processFinishedMatch]` - Automatic generation

---

## Production Checklist

- [ ] Add `.env` variables (`INTERPRETATION_MODEL`, `REPORT_MODEL`)
- [ ] Add routes to Express app
- [ ] Set up webhook endpoint OR cron job
- [ ] Test with a finished match
- [ ] Monitor OpenAI usage/costs
- [ ] Set up error alerting (webhook failures, API errors)
- [ ] Consider rate limiting for batch operations

---

## Examples

### Example 1: Manual Report Generation

```javascript
// In a script or admin panel
const { generateReportPipeline } = require('./services/reportPipeline');

async function generateManualReport() {
  const result = await generateReportPipeline({
    matchId: 19631550,
    teamSlug: 'southampton'
  });
  
  console.log('Report generated:', result.report.headline);
}

generateManualReport();
```

### Example 2: Webhook Integration

```javascript
// In your main Express app
const { handleMatchStatusWebhook } = require('./webhooks/matchStatusWebhook');

app.post('/api/webhooks/match-status', handleMatchStatusWebhook);

// Webhook provider sends:
// POST /api/webhooks/match-status
// {
//   "match_id": 19631550,
//   "status": "Finished",
//   "timestamp": "2024-01-15T20:00:00Z"
// }
```

### Example 3: Cron Job Integration

```javascript
// In cron/cronOptimized.js or similar
const { checkRecentlyFinishedMatches } = require('../webhooks/matchStatusWebhook');

async function autoGenerateReports() {
  await checkRecentlyFinishedMatches();
}

// Or use with node-cron:
const cron = require('node-cron');
cron.schedule('*/15 * * * *', autoGenerateReports);
```

---

## Extending the Pipeline

### Custom Interpretation Logic

Edit `services/matchInterpretation.js` to customize narrative extraction:

```javascript
function buildInterpretationPrompt(evidence, teamFocus) {
  return `
    YOUR CUSTOM PROMPT
    - Add domain-specific instructions
    - Customize output structure
    - Add new analysis dimensions
  `;
}
```

### Custom Report Sections

Edit `services/matchReportWriter.js` to add new sections:

```javascript
const completion = await client.chat.completions.create({
  // ... existing config
  messages: [
    {
      role: 'user',
      content: `
        ${existingPrompt}
        
        ADDITIONAL SECTION:
        Add a "tactical_analysis" field with 2-3 paragraphs
      `
    }
  ]
});
```

---

## Support

For questions or issues:
1. Check logs (`[ReportPipeline]`, `[MatchStatusWebhook]`)
2. Review `result.interpretation` for Step 1 issues
3. Check OpenAI API status
4. Verify match data completeness (events, ratings, lineup)

---

## License

Internal use only.
