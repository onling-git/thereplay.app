# Team Match Info Caching Strategy

## Current Problem
- Frontend shows correct data (uses dynamic queries)
- Database cached fields are stale
- Causes confusion about data accuracy

## Recommended Improvements

### 1. Add Cache Metadata
```javascript
// Add to Team schema
cached_at: Date,           // When was cache last updated
cache_version: Number,     // For cache invalidation
cache_is_stale: Boolean    // Computed field
```

### 2. Smart Cache Invalidation
- Invalidate team cache when matches are added/updated
- Add middleware to Match model to trigger team cache updates
- Use change streams for real-time invalidation

### 3. Hybrid API Approach
```javascript
// GET /api/teams/:slug
// Return cached data with freshness indicator
{
  ...teamData,
  cache_metadata: {
    cached_at: "2025-11-02T10:00:00Z",
    is_stale: false,
    auto_refresh_in: 3600000 // milliseconds
  }
}
```

### 4. Use Cases for Cached Data
- **Bulk operations**: Team listings, statistics
- **Database queries**: Finding teams by match dates
- **Performance**: Avoid N+1 queries
- **Fallback**: When dynamic queries fail

### 5. Use Cases for Dynamic Data
- **Real-time display**: Individual team pages
- **Live matches**: Current status updates
- **Critical accuracy**: Match results, scores

## Implementation Strategy

### Phase 1: Add Cache Metadata
1. Add timestamp fields to Team model
2. Update recompute functions to set timestamps
3. Add cache freshness indicators to APIs

### Phase 2: Smart Invalidation
1. Add Match model hooks to invalidate team cache
2. Implement selective cache refresh
3. Add cache health monitoring

### Phase 3: Optimize Usage
1. Use cached data for bulk operations
2. Use dynamic data for individual displays
3. Implement cache warming strategies

## Decision Matrix

| Use Case | Cached | Dynamic | Reason |
|----------|--------|---------|---------|
| Team listings page | ✅ | ❌ | Performance (100+ teams) |
| Individual team page | ❌ | ✅ | Accuracy needed |
| Search/filtering | ✅ | ❌ | Database queries needed |
| Live match updates | ❌ | ✅ | Real-time accuracy |
| Statistics/reports | ✅ | ❌ | Aggregation performance |
| Mobile app (offline) | ✅ | ❌ | Offline capability |