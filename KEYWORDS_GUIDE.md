# Keywords in RSS Feeds - When & Why

## TL;DR
- **Keywords are optional** for team-specific feeds
- Use them to narrow down articles to specific topics
- Leave empty to include all articles from that feed

---

## Scenario Comparison

### Scenario 1: Generic Feed WITHOUT Keywords
**Feed**: "BBC Sport - All Football News"
**Scope**: Generic (all teams)
**Keywords**: (empty)

**Result**: Every article from BBC Sport goes to every team
- Man City gets updates about Liverpool injuries
- Arsenal gets updates about Chelsea transfers
- Not ideal, lots of noise

---

### Scenario 2: Generic Feed WITH Keywords
**Feed**: "BBC Sport - All Football News"
**Scope**: Generic (all teams)
**Keywords**: `premier league`, `transfer`

**Result**: Only Premier League and transfer articles go to teams
- Man City gets Premier League transfer news ✓
- Arsenal gets Premier League transfer news ✓
- Championship news filtered out ✗
- Better, but still generic

---

### Scenario 3: Team-Specific Feed WITHOUT Keywords
**Feed**: "Southampton Official News"
**Scope**: Team-Specific (Southampton only)
**Keywords**: (empty)

**Result**: Every article from Southampton's feed goes to Southampton
- Southampton gets ALL their official announcements
- Team news, training updates, commercial news, everything
- Perfect if you trust the team's own feed quality

---

### Scenario 4: Team-Specific Feed WITH Keywords (MOST USEFUL)
**Feed**: "Southampton Official News"
**Scope**: Team-Specific (Southampton only)
**Keywords**: `injury`, `lineup`, `team news`

**Result**: Only specific content from Southampton's feed goes to Southampton
- Southampton gets injury news ✓
- Southampton gets lineup announcements ✓
- Southampton gets commercial announcements ✗
- Perfect for focusing on what fans care about

---

## When to Use Keywords

### DO use keywords when:
1. **Feed has mixed content**
   - Official team page posts: merchandise, sponsorships, team news, injuries
   - You only want: injuries and team news

2. **Generic feed too broad**
   - BBC Sport covers all 92 league teams
   - You only want: Premier League news

3. **Want to filter noise**
   - ESPN publishes 500 articles/day
   - You only want: transfer rumors and match reports

### DON'T use keywords when:
1. **Feed is already narrow**
   - Official Southampton injuries blog = just injuries already
   - Add keywords = might filter out actual injury news

2. **You want everything**
   - "Give me all news about this team"
   - Leave keywords empty

---

## Real-World Examples

### Example A: Transfer Tracking
```
Feed: "Sky Sports Transfers" (Generic)
Keywords: "southampton", "transfer"
Result: Transfer rumors about Southampton only
```

### Example B: Injury Alerts
```
Feed: "Southampton Official Updates" (Team-Specific)
Keywords: "injury", "fitness", "ruled out"
Result: Only injury-related news from Southampton
```

### Example C: Match Day Hype
```
Feed: "Sky Sports Live" (Generic)
Keywords: "southampton", "kickoff", "lineup"
Result: Match lineups and kickoff times for Southampton games
```

### Example D: Complete Feed
```
Feed: "Southampton Press Releases" (Team-Specific)
Keywords: (empty)
Result: Everything Southampton officially publishes
```

---

## Decision Tree

```
Is this a team-specific feed?
├─ YES: Team's own blog/website
│  ├─ Want everything? → Leave keywords empty
│  ├─ Want only certain topics? → Add keywords (injuries, lineups, etc.)
│  └─ Example: Southampton.com + keywords "injury"
│
└─ NO: Generic feed (BBC, Sky, ESPN, etc.)
   ├─ Feed already filtered to my team? → Leave keywords empty
   ├─ Want to narrow it down? → Add keywords (transfer, goals, etc.)
   └─ Example: BBC Sport + keywords "southampton", "transfer"
```

---

## The Bottom Line

**For team-specific feeds**: Keywords are useful but optional
- Southampton's official site without keywords = everything
- Southampton's official site with "injury" keywords = just injury news
- Both are valid depending on what you want

**Recommendation**: Start without keywords. Add them only if the feed is too noisy for that team.
