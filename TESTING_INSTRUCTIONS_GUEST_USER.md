# 👤 Testing Instructions - Guest User (Alex)

## Your Role
You are **Alex**, a football fan who just discovered The Final Play website. You haven't created an account yet and are exploring what the site offers. You want to check live scores, read match reports, and browse news.

---

## 🎯 Testing Objectives

As a guest user, you should test:
- Public pages accessibility
- Match information browsing
- News and content viewing
- Registration prompts
- Mobile responsiveness

---

## 📋 Step-by-Step Testing Guide

### **Test 1: First Visit & Homepage** (10 minutes)

1. **Open the website** in your browser
   - Clear cookies/cache first (to simulate first-time visit)
   - Note: You should see a **Cookie Consent Banner** appear
   
2. **Cookie Consent Testing**:
   - [ ] Verify the cookie banner appears at bottom/top
   - [ ] Try clicking "Accept All" ✓
   - [ ] Refresh page - banner should NOT reappear
   - [ ] Clear cookies and try "Reject All" instead
   - [ ] Try "Customize" and toggle individual cookie types
   - [ ] Verify your choice persists after refresh
   
3. **Homepage Exploration**:
   - [ ] Check if you see **Live Matches** section
   - [ ] Verify match scores are displayed (if any matches are live)
   - [ ] Check **Today's Matches** section
   - [ ] Scroll through **Top Stories** news cards (should see 3-4)
   - [ ] Browse **Latest News** grid at bottom
   - [ ] Verify all images load correctly
   - [ ] Check for any broken links or missing content
   
4. **Date Selector Testing**:
   - [ ] Click "Today" button - verify it shows today's matches
   - [ ] Click "Tomorrow" button - verify date changes
   - [ ] Click "Yesterday" button - verify past matches appear
   - [ ] Try the **custom date picker** - select a random date
   - [ ] Verify matches update accordingly
   
5. **League Filter Testing**:
   - [ ] Find the **League Filter** dropdown
   - [ ] Try selecting "Premier League"
   - [ ] Verify only Premier League matches show
   - [ ] Try "La Liga", "Bundesliga", etc.
   - [ ] Switch back to "All Leagues"
   - [ ] Verify all matches return

6. **Ad Visibility** (Important for Guest Users):
   - [ ] You should see **ADVERTISEMENTS** on the page
   - [ ] Look for banner ads at top, middle, and bottom
   - [ ] Ads should load without breaking layout
   - [ ] Footer should not be covered by ads
   - [ ] Note if any ads look broken or oversized

---

### **Test 2: Navigation & Menu** (5 minutes)

1. **Top Navigation Bar**:
   - [ ] Click the **Logo** (should return to homepage)
   - [ ] Click **"Fixtures"** link
   - [ ] Click **"News"** link
   - [ ] Click **"Followed Fixtures"** link (you should be redirected or see a login prompt)
   - [ ] Verify **"Login"** and **"Register"** buttons are visible
   
2. **Footer Navigation**:
   - [ ] Scroll to bottom of any page
   - [ ] Verify footer links work:
     - Home
     - Fixtures
     - News
   - [ ] Click **"Privacy Policy"** - should open policy page
   - [ ] Click **"Terms of Service"** - should open terms page
   - [ ] Verify none of these require authentication

3. **Mobile Menu** (if on mobile or resize browser):
   - [ ] Resize browser to < 768px width (or use mobile device)
   - [ ] Verify **hamburger menu icon** appears
   - [ ] Click hamburger menu
   - [ ] Verify menu slides out or drops down
   - [ ] Test all links in mobile menu
   - [ ] Close menu and verify it closes properly

---

### **Test 3: Fixtures Page** (15 minutes)

1. **Navigate to Fixtures Page**:
   - Click "Fixtures" in main navigation
   
2. **Filter Testing**:
   - [ ] Try the **Date** filter:
     - Today
     - Tomorrow
     - Yesterday
     - Custom date via date picker
   - [ ] Try the **Country** filter:
     - Select "England"
     - Verify only English leagues show
     - Try "Spain", "Germany", etc.
   - [ ] Try the **League** filter:
     - Select a country first
     - Then select a specific league
     - Verify matches update
   - [ ] Toggle **"Show Live Only"** checkbox:
     - When checked, only live matches should appear
     - When unchecked, all matches return
   - [ ] Click **"Clear Filters"** button
     - All filters should reset
     - Full fixture list should show

3. **Fixtures Display**:
   - [ ] Verify fixtures are organized by **Country**
   - [ ] Within each country, organized by **League**
   - [ ] Click a **Country header** to expand/collapse
   - [ ] Click a **League header** to expand/collapse
   - [ ] Verify match counts are accurate in headers
   
4. **Match Cards**:
   - [ ] Find a match card
   - [ ] Verify it shows:
     - [ ] Team names
     - [ ] Match time (for upcoming) or score (for live/finished)
     - [ ] League badge/name
     - [ ] Venue name
     - [ ] Match status (NS, LIVE, FT, etc.)
   - [ ] For **LIVE matches**:
     - [ ] Check for pulsing "LIVE" indicator
     - [ ] Red/highlighted border
     - [ ] Live score display
   - [ ] Try clicking a **team name** - should go to team page
   - [ ] Try clicking **match card** - should go to match live/report page

5. **Favorite Button** (Should be disabled/prompt login):
   - [ ] Find the **heart icon** on a match card
   - [ ] Click it as a guest user
   - [ ] Verify you get a **login prompt** or tooltip saying "Login to favorite"
   - [ ] Confirm you CANNOT favorite matches without account

---

### **Test 4: Match Detail Pages** (15 minutes)

1. **Match Live Page**:
   - [ ] Click on any match from fixtures/home
   - [ ] You should land on **`/:teamSlug/match/:matchId/live`**
   
2. **Match Header**:
   - [ ] Verify you see team names and badges
   - [ ] Check score display (if match started)
   - [ ] Verify match status badge (LIVE, FT, NS, etc.)
   - [ ] Check for venue and competition info
   - [ ] Look for favorite button (should prompt login if clicked)

3. **Tabs Testing**:
   - [ ] **Commentary Tab**:
     - [ ] Verify text commentary appears
     - [ ] Check for minute markers (45', 67', etc.)
     - [ ] For live matches: wait ~10 seconds, check if new comments auto-appear
     - [ ] Verify auto-scroll to latest comment
   - [ ] **Key Events Tab**:
     - [ ] Click "Key Events" tab
     - [ ] Verify events display (goals, cards, subs)
     - [ ] Check event icons (⚽ for goals, 🟨 for yellow cards, etc.)
     - [ ] Verify player names appear
   - [ ] **Lineups Tab**:
     - [ ] Click "Lineups" tab
     - [ ] Toggle between "Home" and "Away" teams
     - [ ] Verify starting XI players display
     - [ ] Check for formation diagram (if available)
     - [ ] Verify substitutes section
   - [ ] **Statistics Tab**:
     - [ ] Click "Statistics" tab
     - [ ] Verify possession percentage bar
     - [ ] Check comparative stats (shots, corners, fouls, etc.)
     - [ ] Ensure all stats display correctly with proper labels

4. **Real-time Updates** (For LIVE matches):
   - [ ] Find a currently live match
   - [ ] Stay on the Match Live page for 60 seconds
   - [ ] Verify the page auto-updates without manual refresh
   - [ ] Check if connection status indicator is present
   - [ ] If score changes, verify it updates automatically

5. **Match Report Page**:
   - [ ] Click "Match Report" link (if visible for finished matches)
   - [ ] Or navigate to **`/:teamSlug/match/:matchId/report`**
   - [ ] Verify you can read the full AI-generated report
   - [ ] Check for:
     - [ ] Match summary
     - [ ] Key moments description
     - [ ] Embedded tweets (if any)
     - [ ] Player ratings (if available)
     - [ ] Formation display (if available)
   - [ ] Click "Back to match" link - returns to live page
   - [ ] Click "Back to team overview" - returns to team page

---

### **Test 5: Team Overview Page** (10 minutes)

1. **Navigate to Team Page**:
   - Click any team name from fixtures or match pages
   - URL should be **`/:teamSlug`** (e.g., `/arsenal`, `/manchester-united`)
   
2. **Team Information**:
   - [ ] Verify team name displays correctly
   - [ ] Check team logo/badge (if available)
   
3. **Last Match Summary**:
   - [ ] Verify the last match result shows:
     - [ ] Opponent name (clickable)
     - [ ] Final score
     - [ ] Win/Loss/Draw badge
     - [ ] Date and venue
     - [ ] Home or Away indicator
   - [ ] Click opponent name - should go to opponent's team page
   - [ ] Click match card - should go to that match's page
   
4. **Team Match Summary Component**:
   - [ ] Check for performance stats (if displayed)
   - [ ] Verify historical data (recent form, etc.)
   
5. **Team News Section**:
   - [ ] Scroll to news section
   - [ ] Verify team-specific news articles appear
   - [ ] Click a news article - should open in new tab
   
6. **Upcoming Fixtures**:
   - [ ] Check for upcoming match schedule
   - [ ] Verify dates and opponents are correct

---

### **Test 6: News Page** (10 minutes)

1. **Navigate to News Page**:
   - Click "News" in main navigation
   
2. **News Display**:
   - [ ] Verify news articles load
   - [ ] Check article cards show:
     - [ ] Headline image
     - [ ] Article title
     - [ ] Source name
     - [ ] Publication date ("2 hours ago", etc.)
   
3. **League Filter**:
   - [ ] Find "Filter by League" dropdown
   - [ ] Try selecting "Premier League"
   - [ ] Verify only Premier League news shows
   - [ ] Try different leagues (La Liga, Bundesliga, etc.)
   - [ ] Select "All Leagues" - all news should return
   
4. **Article Interaction**:
   - [ ] Click on a news article card
   - [ ] Verify it opens the full article (likely in new tab/external site)
   
5. **Empty State**:
   - [ ] Select a league with no news
   - [ ] Verify friendly "No news found" message appears

---

### **Test 7: Authentication Prompts** (10 minutes)

Test what happens when you try to access features requiring login:

1. **Followed Fixtures Page**:
   - [ ] Navigate to `/followed-fixtures`
   - [ ] As a guest, you should see:
     - [ ] Login prompt message
     - [ ] "Login" or "Register" buttons
     - [ ] Explanation of what this page offers
   - [ ] Click "Login" button
   - [ ] Verify **Auth Modal** opens

2. **Account Page**:
   - [ ] Try navigating to `/account`
   - [ ] Verify you're redirected to login or see auth modal

3. **Favorite Buttons**:
   - [ ] Click a heart icon on any match
   - [ ] Verify you get a message like "Login to favorite matches"
   - [ ] Verify nothing breaks

4. **Team Preferences**:
   - [ ] Try accessing team preferences (if there's a menu item)
   - [ ] Verify login required message

---

### **Test 8: Registration Flow** (10 minutes)

Let's test creating an account (do this last):

1. **Open Auth Modal**:
   - [ ] Click "Register" button in header
   - [ ] Or click "Register" from any login prompt
   - [ ] Verify modal opens

2. **Registration Form**:
   - [ ] Verify all fields are present:
     - [ ] Email
     - [ ] Password
     - [ ] Confirm Password
     - [ ] First Name
     - [ ] Surname
     - [ ] Terms & Conditions checkbox
   
3. **Form Validation Testing**:
   - [ ] Try submitting empty form - should see error messages
   - [ ] Enter invalid email (e.g., "notanemail") - should show error
   - [ ] Enter password < 8 characters - should show error
   - [ ] Enter mismatched passwords - should show error
   - [ ] Don't check Terms box - should show error
   - [ ] Enter valid data in all fields
   - [ ] Check Terms & Conditions box
   - [ ] Click "Register"
   
4. **Post-Registration**:
   - [ ] Verify success message appears
   - [ ] Verify you're auto-logged in
   - [ ] Check if **Team Onboarding Modal** appears
   - [ ] For now, click "Skip" (we'll test onboarding separately)
   
5. **Login/Logout**:
   - [ ] After registering, verify you see your name/email in header
   - [ ] Click user menu dropdown
   - [ ] Click "Logout"
   - [ ] Verify you're logged out
   - [ ] Click "Login" button
   - [ ] Enter your new credentials
   - [ ] Verify successful login

---

### **Test 9: Legal Pages** (5 minutes)

1. **Privacy Policy**:
   - [ ] Navigate to `/privacy-policy`
   - [ ] Verify page loads without login
   - [ ] Scroll through content
   - [ ] Check for:
     - [ ] Data collection info
     - [ ] Cookie usage
     - [ ] User rights (GDPR)
     - [ ] Contact information
   
2. **Terms of Service**:
   - [ ] Navigate to `/terms-of-service`
   - [ ] Verify page loads without login
   - [ ] Scroll through content
   - [ ] Check for:
     - [ ] User agreement
     - [ ] Subscription terms
     - [ ] Refund policy
     - [ ] Disclaimers

---

### **Test 10: Mobile Responsiveness** (15 minutes)

1. **Mobile Device or Browser Resize**:
   - Use a real mobile device, OR
   - Open Chrome DevTools (F12) → Toggle Device Toolbar
   - Test various screen sizes:
     - [ ] iPhone SE (375px)
     - [ ] iPhone 12/13 (390px)
     - [ ] iPhone 14 Pro Max (430px)
     - [ ] iPad (768px)
     - [ ] iPad Pro (1024px)

2. **Mobile Homepage**:
   - [ ] Verify layout doesn't break
   - [ ] Check hamburger menu works
   - [ ] Match cards stack vertically
   - [ ] Images scale properly
   - [ ] Text is readable (not too small)
   - [ ] Buttons are tappable (not too small)

3. **Mobile Fixtures Page**:
   - [ ] Filters stack vertically
   - [ ] Date selector is usable
   - [ ] Country/League dropdowns work
   - [ ] Match cards are readable
   - [ ] Expand/collapse country/league works

4. **Mobile Match Live Page**:
   - [ ] Tabs are accessible and switchable
   - [ ] Commentary is readable
   - [ ] Statistics tables fit in viewport
   - [ ] Lineups display properly
   - [ ] No horizontal scrolling on pages

5. **Mobile Forms**:
   - [ ] Login/Register modal is usable
   - [ ] Input fields are large enough
   - [ ] Buttons are tappable
   - [ ] Keyboard doesn't hide important content

6. **Landscape Orientation**:
   - [ ] Rotate device to landscape
   - [ ] Verify layout still works
   - [ ] No content gets cut off

---

### **Test 11: Cross-Browser Testing** (20 minutes)

Test the same homepage flow on multiple browsers:

1. **Google Chrome**:
   - [ ] Open site in Chrome
   - [ ] Browse homepage, fixtures, news
   - [ ] Verify everything works
   
2. **Mozilla Firefox**:
   - [ ] Open site in Firefox
   - [ ] Test same pages
   - [ ] Note any visual differences
   
3. **Safari** (if on Mac):
   - [ ] Open site in Safari
   - [ ] Test same pages
   - [ ] Check for any Safari-specific issues
   
4. **Microsoft Edge**:
   - [ ] Open site in Edge
   - [ ] Test same pages
   - [ ] Verify no major differences

**What to look for**:
- [ ] Layout consistency across browsers
- [ ] Fonts rendering correctly
- [ ] Colors appearing the same
- [ ] Interactive elements working
- [ ] No console errors (F12 → Console tab)

---

### **Test 12: Performance & Loading** (10 minutes)

1. **Page Load Speed**:
   - [ ] Open Chrome DevTools → Network tab
   - [ ] Refresh homepage
   - [ ] Check total page load time (aim for < 3 seconds)
   - [ ] Verify images load progressively
   
2. **Large Fixture Lists**:
   - [ ] Go to Fixtures page
   - [ ] Select a very busy date (e.g., Saturday afternoon)
   - [ ] Expand all countries
   - [ ] Scroll through hundreds of matches
   - [ ] Verify no lag or freezing
   
3. **Live Match SSE Connection**:
   - [ ] Go to a live match page
   - [ ] Open DevTools → Network tab
   - [ ] Look for "EventSource" or SSE connection
   - [ ] Verify it stays connected
   - [ ] Check for updates every 6 seconds
   
4. **Ad Loading**:
   - [ ] Verify ads don't block page rendering
   - [ ] Page should be usable even if ads load slowly

---

## 🐛 Bug Reporting

If you find any issues, please report them using this format:

```
**Bug Title**: [Short description]

**User Type**: Guest User (Alex)

**Page**: [Homepage / Fixtures / Match Live / etc.]

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected**: 
[What should happen]

**Actual**: 
[What actually happened]

**Browser**: [Chrome 120 / Firefox 121 / Safari 17 / etc.]
**Device**: [Desktop / iPhone 14 / Samsung Galaxy / etc.]
**Screenshot**: [Attach if possible]

**Severity**: 
[ ] Critical (site broken)
[ ] High (feature broken)
[ ] Medium (visual issue)
[ ] Low (minor annoyance)
```

---

## ✅ Testing Checklist Summary

- [ ] Cookie consent works properly
- [ ] Homepage displays correctly with all sections
- [ ] Date selectors and league filters work
- [ ] Advertisements display for guest users
- [ ] Navigation menu works on all pages
- [ ] Fixtures page filters work correctly
- [ ] Match live pages display with all tabs
- [ ] Match reports are readable
- [ ] Team overview pages load correctly
- [ ] News page and league filter work
- [ ] Authentication prompts appear when accessing restricted features
- [ ] Registration flow works (form validation, account creation)
- [ ] Legal pages (Privacy, Terms) are accessible
- [ ] Mobile responsiveness on various screen sizes
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Performance is acceptable (no major lag)

---

## 📝 Additional Notes

### Things Guest Users CANNOT Do:
- ❌ Follow or favorite teams
- ❌ Save favorite matches
- ❌ Access "Followed Fixtures" page
- ❌ Manage account settings
- ❌ Subscribe to premium
- ❌ Remove advertisements

### Things Guest Users CAN Do:
- ✅ View live scores and match details
- ✅ Read match reports
- ✅ Browse fixtures with filters
- ✅ Read news articles
- ✅ View team overview pages
- ✅ Access all public content
- ✅ Register for an account

---

## ⏱️ Estimated Testing Time

**Total Time**: ~2.5 hours

- Test 1-3: 30 minutes (Homepage, Navigation, Fixtures)
- Test 4-5: 25 minutes (Match pages, Team pages)
- Test 6-8: 25 minutes (News, Auth, Registration)
- Test 9: 5 minutes (Legal pages)
- Test 10: 15 minutes (Mobile testing)
- Test 11: 20 minutes (Cross-browser)
- Test 12: 10 minutes (Performance)

---

## 🎉 Thank You!

Your testing as a guest user is invaluable. You're helping ensure that new visitors have a great first experience with The Final Play!

**After completing this testing, you can proceed to test as a registered user (Free or Premium) using the other testing guides.**

---

*Happy Testing!* ⚽
