// LINEUP_CONSOLIDATION_PLAN.md
// Safe strategy to consolidate lineup fields without breaking the app

## Current State Analysis:
✅ `lineup` field: { home: [...], away: [...] } - WRONG DATA but RIGHT STRUCTURE  
✅ `lineups` field: [...] - BETTER DATA but FLAT STRUCTURE
✅ Both fields needed by different parts of the system

## Proposed Solution: Hybrid Approach

### Phase 1: Fix Data Population (IMMEDIATE)
1. **Update sync controller** to populate `lineup.home`/`away` from the better `lineups` data
2. **Keep both fields** but make `lineup` the "derived" field from `lineups`
3. **Maintain backward compatibility** - no breaking changes

### Phase 2: Enhanced Normalization (SAFE)
1. **Improve `lineups` population** with complete player data
2. **Auto-generate `lineup.home`/`away`** from `lineups` using team_id separation  
3. **Add data validation** to ensure consistency

### Phase 3: Gradual Migration (FUTURE)
1. **Update report controller** to use enhanced `lineups` with team filtering
2. **Maintain `lineup` for cron compatibility** until fully tested
3. **Eventually consolidate** once all systems verified

## Implementation Steps:

### Step 1: Fix Immediate Data Issues
```javascript
// In matchSyncController.js - after setting lineups array
if (setPayload.lineups && setPayload.lineups.length > 0) {
  // Auto-generate lineup.home/away from lineups data
  const homeId = match?.home_team_id || match?.localteam_id;
  const awayId = match?.away_team_id || match?.visitorteam_id;
  
  const home = setPayload.lineups.filter(p => p.team_id === homeId);
  const away = setPayload.lineups.filter(p => p.team_id === awayId);
  
  setPayload.lineup = { home, away };
}
```

### Step 2: Update Report Controller
```javascript
// Enhanced team separation logic
function getTeamLineup(match, teamName, side) {
  // Try structured lineup first
  if (match.lineup && match.lineup[side]?.length > 0) {
    return match.lineup[side];
  }
  
  // Fallback to lineups array with team filtering
  if (match.lineups?.length > 0) {
    const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
    return match.lineups.filter(p => p.team_id === teamId);
  }
  
  return [];
}
```

## Benefits:
✅ **Zero Breaking Changes** - All existing code continues to work
✅ **Better Data Quality** - `lineup` gets populated from better `lineups` source  
✅ **Maintains Structure** - Report controller keeps using `lineup.home`/`away`
✅ **Future Flexibility** - Can gradually optimize without disruption

## Risk Assessment: 
🟢 **LOW RISK** - Only improves data quality, doesn't change interfaces
🟢 **BACKWARD COMPATIBLE** - All existing code paths preserved
🟢 **TESTABLE** - Can validate with existing matches before rollout