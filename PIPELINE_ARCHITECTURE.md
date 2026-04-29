# 2-Step Match Report Pipeline - Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRIGGER MECHANISMS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Webhook (recommended)                                       │
│     ├─ External provider → POST /api/webhooks/match-status     │
│     └─ Payload: { match_id, status: "Finished" }               │
│                                                                  │
│  2. Cron Job (fallback)                                         │
│     ├─ Runs every 15 minutes                                    │
│     └─ Scans for matches with status="Finished" without reports│
│                                                                  │
│  3. Manual API Call                                             │
│     └─ POST /api/reports/v2/generate/:matchId/:teamSlug        │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR PIPELINE                         │
│                 (services/reportPipeline.js)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase 0: DATA PREPARATION                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Fetch match from MongoDB                                │  │
│  │ • Resolve team focus (home/away)                          │  │
│  │ • Fetch relevant tweets (reporter priority)              │  │
│  │ • Extract competition context (cup vs league)            │  │
│  │ • Determine POTM candidate from ratings                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Phase 1: MATCH INTERPRETATION (Step 1)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Service: services/matchInterpretation.js                  │  │
│  │ Model: INTERPRETATION_MODEL (gpt-4o-mini)                 │  │
│  │ Duration: ~800-1200ms                                     │  │
│  │ Cost: ~$0.0005                                            │  │
│  │                                                            │  │
│  │ INPUT:                                                     │  │
│  │  • Match events (goals, cards, subs)                      │  │
│  │  • Statistics (possession, shots, etc.)                   │  │
│  │  • Player ratings (top performers)                        │  │
│  │  • Tweets (up to 10)                                      │  │
│  │                                                            │  │
│  │ PROCESSING:                                                │  │
│  │  • Analyze timeline of events                             │  │
│  │  • Identify first/second half flow                        │  │
│  │  • Detect momentum shifts                                 │  │
│  │  • Find decisive moment                                   │  │
│  │  • Select 0-2 most relevant tweets                        │  │
│  │                                                            │  │
│  │ OUTPUT (JSON):                                             │  │
│  │  {                                                         │  │
│  │    first_half: { summary, key_moments, momentum },        │  │
│  │    second_half: { summary, key_moments, momentum },       │  │
│  │    decisive_moment: { minute, description, why },         │  │
│  │    overall_story: "string",                               │  │
│  │    momentum_shifts: [...],                                │  │
│  │    selected_tweets: [...]                                 │  │
│  │  }                                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Phase 2: REPORT WRITING (Step 2)                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Service: services/matchReportWriter.js                    │  │
│  │ Model: REPORT_MODEL (gpt-4o-mini or gpt-4o)              │  │
│  │ Duration: ~1200-1800ms                                    │  │
│  │ Cost: ~$0.001 (mini) or ~$0.01 (gpt-4o)                  │  │
│  │                                                            │  │
│  │ INPUT:                                                     │  │
│  │  • Step 1 interpretation (narrative structure)            │  │
│  │  • All match data (events, stats, ratings, lineup)        │  │
│  │  • POTM candidate                                         │  │
│  │  • Competition context (cup vs league)                    │  │
│  │                                                            │  │
│  │ PROCESSING:                                                │  │
│  │  • Follow narrative structure from Step 1                 │  │
│  │  • Write 3-5 summary paragraphs (70-120 words each)       │  │
│  │  • Create chronological key moments list                  │  │
│  │  • Write analytical commentary (3-5 paragraphs)           │  │
│  │  • Justify POTM selection                                 │  │
│  │  • Embed selected tweets verbatim                         │  │
│  │  • Apply competition-specific language rules              │  │
│  │                                                            │  │
│  │ OUTPUT (JSON):                                             │  │
│  │  {                                                         │  │
│  │    headline: "string",                                    │  │
│  │    summary_paragraphs: ["...", "...", "..."],            │  │
│  │    key_moments: ["5' - ...", "34' - ..."],               │  │
│  │    commentary: ["...", "...", "..."],                    │  │
│  │    player_of_the_match: { player, reason },              │  │
│  │    sources: ["..."],                                     │  │
│  │    meta: { generated_by, pipeline: {...} }               │  │
│  │  }                                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Phase 3: ENRICHMENT                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Add embedded tweets (full objects)                      │  │
│  │ • Add match_id, team_slug, team_name                      │  │
│  │ • Add competition metadata                                │  │
│  │ • Add performance metrics                                 │  │
│  │ • Generate JSON-LD schema                                 │  │
│  │ • Generate SEO keywords                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE PERSISTENCE                        │
│                (controllers/reportControllerV2.js)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Check for existing report (idempotency)                     │
│  2. Create or update Report document                            │
│  3. Update Match document with report reference                 │
│  4. Return saved report                                         │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API RESPONSE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  {                                                               │
│    ok: true,                                                     │
│    report: { ... },                                             │
│    debug: { interpretation: {...} }  // Optional                │
│  }                                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Principles

### 1. Separation of Concerns
- **Step 1** = Narrative extraction (what happened)
- **Step 2** = Creative writing (how to tell it)

### 2. Evidence-First Approach
- All LLM calls receive structured evidence
- No free-form "write a report" prompts
- Interpretation constrains writing

### 3. Progressive Enhancement
- Step 1 provides structure → prevents hallucinations
- Step 2 focuses on quality → better prose
- Each step is independently testable

### 4. Cost Optimization
- Use cheaper model for Step 1 (extraction)
- Optional upgrade for Step 2 (quality)
- Typical cost: $0.0015-$0.015 per report

### 5. Asynchronous Processing
- Webhook responds immediately
- Report generation happens in background
- No blocking on external API calls

## Data Flow

```
Match API/Database
        │
        ├─→ Match Data (events, stats, lineup)
        ├─→ Tweet Collection (reporter priority)
        └─→ Competition Context
                │
                ▼
        ┌───────────────┐
        │  STEP 1: LLM  │  ← Structured evidence
        │  (Interpret)  │  → Narrative JSON
        └───────────────┘
                │
                ├─→ first_half summary
                ├─→ second_half summary
                ├─→ decisive_moment
                ├─→ momentum_shifts
                └─→ selected_tweets
                        │
                        ▼
                ┌───────────────┐
                │  STEP 2: LLM  │  ← Interpretation + raw data
                │   (Write)     │  → Report JSON
                └───────────────┘
                        │
                        ├─→ headline
                        ├─→ summary_paragraphs
                        ├─→ key_moments
                        ├─→ commentary
                        └─→ player_of_the_match
                                │
                                ▼
                        Database (Report + Match)
```

## Competition Context Logic

```
Input: match.match_info.league

Detection:
├─ Is cup? → "cup", "carabao", "fa cup" in name OR league.id === 27
├─ Is league? → "premier league", "championship", etc. in name
└─ Default: Unknown (treat as league)

Impact on Writing:
├─ Cup:
│   ├─ NEVER: "three points", "league table", "standings"
│   └─ USE: "progress", "advance", "cup run", mention stage
│
└─ League:
    └─ MAY USE: "three points", "league position", "table"
```

## Tweet Selection Logic

```
Input: All tweets during match time

Step 1 (Filtering):
├─ Priority 1: Reporter tweets during match (highest value)
├─ Priority 2: Fan/hashtag tweets during match (backup)
└─ Limit: Top 10 by engagement

Step 2 (LLM Selection):
├─ Analyze tweets for context value
├─ Select max 2 that add real insight
└─ Return: { text, author, why_selected }

Output:
└─ Embedded tweets (full objects) in final report
```

## Error Handling

```
Trigger → Orchestrator → Step 1 → Step 2 → Database

Error at Step 1:
├─ Log error
├─ Retry once (optional)
└─ Fail gracefully (no report saved)

Error at Step 2:
├─ Log error + Step 1 output
├─ Retry once with same interpretation
└─ Fail gracefully

Error at Database:
├─ Report generated but not saved
├─ Log complete output
└─ Manual recovery possible
```

## Performance Characteristics

| Metric | Target | Typical |
|--------|--------|---------|
| Total latency | < 3s | 2-2.5s |
| Step 1 time | < 1.5s | 0.8-1.2s |
| Step 2 time | < 2s | 1.2-1.8s |
| Cost (mini/mini) | < $0.002 | $0.0015 |
| Cost (mini/4o) | < $0.015 | $0.01 |
| Reports/hour | 1800+ | Unlimited |

## Scalability Considerations

1. **Rate Limiting**: OpenAI has tier-based limits
   - Tier 1: 500 RPM, 30K TPM
   - Implement queue for batch processing

2. **Parallel Processing**: Process multiple matches concurrently
   - Recommended: 5-10 concurrent reports
   - Monitor OpenAI token usage

3. **Caching**: Cache interpretations for re-generation
   - Store Step 1 output separately
   - Re-run Step 2 only if needed
