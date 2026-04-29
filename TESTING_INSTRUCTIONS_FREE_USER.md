# 👤 Testing Instructions - Free Registered User (Bailey)

## Your Role
You are **Bailey**, a football fan who has created a free account on The Final Play. You can follow ONE favorite team, save individual matches, and enjoy a personalized experience. You still see advertisements but have access to more features than guest users.

---

## 🎯 Testing Objectives

As a free registered user, you should test:
- Account creation and login
- Team onboarding and preferences
- Following your favorite team
- Favoriting individual matches
- Personalized content (Followed Fixtures page)
- Account management
- Premium subscription prompts
- Cookie preferences management

---

## 📋 Step-by-Step Testing Guide

### **Test 1: Account Creation** (10 minutes)

*If you already have an account from guest testing, you can skip to Test 2. Otherwise:*

1. **Register a New Account**:
   - [ ] Go to the homepage
   - [ ] Click "Register" button in header
   - [ ] Fill in the registration form:
     - Email: `bailey_test@example.com` (or your email)
     - Password: `Test1234!` (or your secure password)
     - Confirm Password: (same as above)
     - First Name: `Bailey`
     - Surname: `Tester`
     - [ ] Check "I accept the Terms and Conditions" box
   - [ ] Click "Register" or "Create Account"
   
2. **Verify Registration**:
   - [ ] Success message appears
   - [ ] You're automatically logged in
   - [ ] Your name/email appears in header
   - [ ] **Team Onboarding Modal** should appear automatically

3. **Team Onboarding Modal**:
   - [ ] Modal opens with welcome message
   - [ ] Explanation of team following feature
   - [ ] Proceed to next step

---

### **Test 2: Team Onboarding - First Time** (15 minutes)

1. **Favorite Team Selection**:
   - [ ] You should see a team search/selector
   - [ ] Try searching for a team:
     - Type "Arsenal" in search box
     - Verify search results appear
     - Click on "Arsenal" (or your preferred team)
   - [ ] Selected team should be highlighted
   - [ ] Team logo and name should display
   - [ ] Click "Next" or "Continue"

2. **Followed Teams Selection**:
   - [ ] You should move to "Followed Teams" section
   - [ ] As a **FREE user**, you should see:
     - [ ] Message indicating you can follow additional teams (OR)
     - [ ] Upgrade to Premium prompt (OR)
     - [ ] Limited to 0-1 additional teams beyond favorite
   - [ ] Try searching for another team (e.g., "Liverpool")
   - [ ] If you can add it: Select it
   - [ ] If you're blocked: Note the "Upgrade to Premium" message
   - [ ] Try clicking "Skip" to skip adding more teams

3. **Complete Onboarding**:
   - [ ] Click "Complete" or "Finish"
   - [ ] Modal should close
   - [ ] You should be redirected to homepage or dashboard
   - [ ] Homepage should now show personalized content

4. **Verify Team Preferences Saved**:
   - [ ] Go to Account → Team Preferences
   - [ ] Verify favorite team appears
   - [ ] Verify followed teams appear (if you added any)

---

### **Test 3: Account Settings** (15 minutes)

1. **Navigate to Account Page**:
   - [ ] Click your name/avatar in header
   - [ ] Click "Account Settings" or "Account"
   - [ ] You should land on `/account`

2. **Profile Tab**:
   - [ ] Verify your profile information displays:
     - [ ] Email (should be non-editable)
     - [ ] First Name
     - [ ] Surname
     - [ ] Display Name (optional)
     - [ ] Phone (optional)
     - [ ] Country (optional)
     - [ ] Bio (optional)
   
3. **Edit Profile**:
   - [ ] Click "Edit" or "Edit Profile" button
   - [ ] Update your display name: "Bailey the Tester"
   - [ ] Add a phone number: "555-123-4567"
   - [ ] Select a country: "United Kingdom" (or your country)
   - [ ] Add a bio: "Passionate football fan testing The Final Play!"
   - [ ] Click "Save Changes"
   - [ ] Verify success message appears
   - [ ] Refresh page and verify changes persisted

4. **Team Preferences Tab**:
   - [ ] Click "Team Preferences" tab or sub-menu
   - [ ] You should see:
     - [ ] Favorite Team: Currently selected team
     - [ ] Followed Teams: List of teams (or empty if none)
   - [ ] Click "Change Favorite Team"
   - [ ] Search for a different team (e.g., "Manchester United")
   - [ ] Select it
   - [ ] Click "Save"
   - [ ] Verify your favorite team updated
   
5. **Try Adding Multiple Followed Teams** (Free Limit Test):
   - [ ] Try to add 2+ followed teams
   - [ ] You should see:
     - [ ] Limit warning message (e.g., "Free users can only follow 1 team")
     - [ ] "Upgrade to Premium" button/link
     - [ ] Unable to save more than the limit
   - [ ] Click "Upgrade to Premium" link
   - [ ] Verify it goes to subscription plans page

6. **Subscription Tab**:
   - [ ] Click "Subscription" tab or sub-menu
   - [ ] You should see:
     - [ ] Current Plan: "Free"
     - [ ] Features you have
     - [ ] Features you're missing (Premium)
     - [ ] "Upgrade to Premium" button
   - [ ] Note the subscription pricing displayed
   - [ ] Don't subscribe yet (we're testing free features) but note the flow

7. **Cookie Settings Section**:
   - [ ] Scroll to "Cookie Settings" section
   - [ ] You should see toggles for:
     - [ ] Essential Cookies (always on, cannot disable)
     - [ ] Analytics Cookies (toggle on/off)
     - [ ] Marketing Cookies (toggle on/off)
     - [ ] Functional Cookies (toggle on/off)
   - [ ] Try toggling Marketing cookies OFF
   - [ ] Click "Save Cookie Preferences"
   - [ ] Verify success message
   - [ ] Refresh page and verify ads might be reduced (depending on implementation)
   - [ ] Toggle Marketing cookies back ON for continued testing

---

### **Test 4: Followed Fixtures Page** (20 minutes)

This is a key feature for registered users!

1. **Navigate to Followed Fixtures**:
   - [ ] Click "Followed Fixtures" in navigation menu
   - [ ] You should land on `/followed-fixtures`
   - [ ] Page should load (no login redirect like guest users see)

2. **Verify Personalized Content**:
   - [ ] You should see matches for:
     - [ ] Your favorite team
     - [ ] Any followed teams you've added
   - [ ] Check the filter/tab options:
     - [ ] "All Matches"
     - [ ] "Favorite Team Only"
     - [ ] "Followed Teams"
     - [ ] "Favorited Matches" (individual favorites)

3. **Date Selector**:
   - [ ] Default should be today's date
   - [ ] Try changing to tomorrow
   - [ ] Verify matches update to tomorrow's fixtures
   - [ ] Try a past date
   - [ ] Verify historical matches appear (if available)
   - [ ] Try a future date (e.g., next week)
   - [ ] Verify upcoming fixtures show

4. **Filter Tabs Testing**:
   - [ ] Click **"All Matches"** tab
     - Should show all matches (favorite + followed + individual favorites)
   - [ ] Click **"Favorite Team Only"** tab
     - Should show only your primary favorite team's matches
   - [ ] Click **"Followed Teams"** tab
     - Should show matches for teams in your followed list
     - If you have no followed teams (beyond favorite), should be empty or show message
   - [ ] Click **"Favorited Matches"** tab
     - Should show individual matches you've marked with heart icon
     - Initially empty until you favorite some matches

5. **Match Cards**:
   - [ ] Verify match cards display for your favorite team
   - [ ] Check that you see:
     - [ ] Team names
     - [ ] Scores (if started/finished)
     - [ ] Kick-off times (if upcoming)
     - [ ] Competition/league name
     - [ ] Venue
   - [ ] Click on a match card
   - [ ] Verify it goes to Match Live page

6. **Empty States**:
   - [ ] Select a date with no matches for your team
   - [ ] Verify friendly message: "No matches found for this date"
   - [ ] If you have no followed teams, check the "Followed Teams" tab
   - [ ] Verify appropriate message appears

---

### **Test 5: Favoriting Individual Matches** (15 minutes)

1. **Find Heart Icon**:
   - [ ] Go to Fixtures page or Home page
   - [ ] Find any match card
   - [ ] Locate the **heart icon** (favorite button)
   - [ ] As a logged-in user, it should no longer prompt login

2. **Favorite a Match**:
   - [ ] Click the heart icon on a match
   - [ ] Heart should fill in or change color (e.g., red)
   - [ ] Verify success indicator (toast message or visual feedback)
   - [ ] Favorite 2-3 different matches

3. **View Favorited Matches**:
   - [ ] Go to "Followed Fixtures" page
   - [ ] Click the **"Favorited Matches"** tab
   - [ ] Verify your favorited matches appear here
   - [ ] Matches should show regardless of team

4. **Unfavorite a Match**:
   - [ ] Click the filled heart icon again
   - [ ] Heart should become empty/unfilled
   - [ ] Verify success indicator
   - [ ] Go back to "Favorited Matches" tab
   - [ ] Verify the unfavorited match is removed from list

5. **Favorite Persistence**:
   - [ ] Favorite a match
   - [ ] Refresh the page
   - [ ] Verify the heart icon is still filled (favorite persisted)
   - [ ] Logout
   - [ ] Login again
   - [ ] Go to Fixtures page
   - [ ] Verify the match is still favorited

---

### **Test 6: Personalized Homepage** (10 minutes)

1. **Visit Homepage**:
   - [ ] Go to homepage (`/`)
   - [ ] As a logged-in user, content should be personalized

2. **Check for Favorite Team Matches**:
   - [ ] Look for a section highlighting your favorite team's matches
   - [ ] May be labeled "Your Team" or similar
   - [ ] Verify matches for your favorite team are prominent

3. **News Personalization**:
   - [ ] Check if news articles are filtered by your team/leagues
   - [ ] May show more news about your favorite team
   - [ ] (Note: This depends on implementation)

4. **Live Matches**:
   - [ ] Verify live matches section still shows all live matches
   - [ ] Or may prioritize your team if playing live

---

### **Test 7: Team Overview Page** (10 minutes)

1. **Navigate to Your Favorite Team**:
   - [ ] Click on your favorite team name from any match card
   - [ ] Or go directly to `/:teamSlug` (e.g., `/arsenal`)

2. **Verify Team Page**:
   - [ ] Team name and logo displayed
   - [ ] Last match result with details
   - [ ] Upcoming fixtures
   - [ ] Team news articles

3. **Last Match Details**:
   - [ ] Click on the last match card
   - [ ] Verify it goes to Match Live or Match Report
   - [ ] Read the match report (if finished match)
   - [ ] Check for embedded tweets, stats, formations

4. **Upcoming Fixtures**:
   - [ ] Find next upcoming match
   - [ ] Click on it
   - [ ] Verify it shows preview/details (even if not started)

---

### **Test 8: Match Experience as Registered User** (20 minutes)

1. **Select a Live or Recent Match**:
   - [ ] Go to Fixtures or Followed Fixtures
   - [ ] Find a match (ideally live or recently finished)
   - [ ] Click to open Match Live page

2. **Match Live Page - All Tabs**:
   - [ ] **Commentary Tab**:
     - [ ] Read through commentary
     - [ ] For live matches: verify real-time updates
     - [ ] Check for smooth scrolling
   - [ ] **Key Events Tab**:
     - [ ] View all important events (goals, cards, subs)
     - [ ] Verify player names and times are accurate
     - [ ] Check team filtering (if available)
   - [ ] **Lineups Tab**:
     - [ ] View starting XI for both teams
     - [ ] Check formation diagram (if shown)
     - [ ] View substitutes bench
   - [ ] **Statistics Tab**:
     - [ ] As a FREE user, check what stats you can see
     - [ ] Look for any "Premium Stats" locks/banners
     - [ ] Note: Some advanced stats might be behind premium paywall
     - [ ] Verify basic stats are visible (possession, shots, corners)

3. **Favorite the Match**:
   - [ ] Click the heart icon on Match Live page
   - [ ] Verify match is added to favorites
   - [ ] Go to Followed Fixtures → Favorited Matches
   - [ ] Verify match appears there

4. **Match Report**:
   - [ ] Click "Match Report" link (for finished matches)
   - [ ] Read the AI-generated report
   - [ ] Check for:
     - [ ] Match summary narrative
     - [ ] Key moments
     - [ ] Player ratings (if available to free users)
     - [ ] Embedded tweets
   - [ ] Verify no premium paywall blocks core content

---

### **Test 9: News & Content** (10 minutes)

1. **News Page**:
   - [ ] Go to `/news`
   - [ ] Browse news articles
   - [ ] Use league filter to see team-specific news
   - [ ] Select your favorite team's league
   - [ ] Verify news updates

2. **Click News Articles**:
   - [ ] Click on a news card
   - [ ] Opens in new tab/window (external link)
   - [ ] Verify link works

3. **Team-Specific News**:
   - [ ] Go to your team's overview page
   - [ ] Scroll to news section
   - [ ] Verify team news is displayed
   - [ ] Click article to read more

---

### **Test 10: Advertisement Experience** (10 minutes)

As a free user, you should still see ads.

1. **Ad Visibility**:
   - [ ] Go to various pages (Home, Fixtures, News, Match Live)
   - [ ] Verify **advertisements are visible**
   - [ ] Ads should appear in:
     - [ ] Header banner
     - [ ] Sidebar (if desktop)
     - [ ] Inline within content
     - [ ] Footer area
   
2. **Ad Behavior**:
   - [ ] Scroll page up and down
   - [ ] Verify ads don't overlap content or footer
   - [ ] Ads should load without breaking layout
   - [ ] Check that ads are not intrusive (blocking content)

3. **Premium Banner/Prompts**:
   - [ ] Look for "Upgrade to Premium" banners
   - [ ] May appear on pages with ads
   - [ ] Click "Go Ad-Free" or similar CTA
   - [ ] Verify it leads to subscription page

---

### **Test 11: Premium Upgrade Flow** (10 minutes)

*Don't complete payment, just test the flow up to payment step.*

1. **Access Subscription Page**:
   - [ ] From Account → Subscription, click "Upgrade to Premium"
   - [ ] Or navigate to `/subscription/plans`

2. **View Subscription Plans**:
   - [ ] Verify you see plan options:
     - [ ] Free Plan (current)
     - [ ] Monthly Premium ($9.99/month or similar)
     - [ ] Yearly Premium ($99.99/year or similar)
   - [ ] Compare features listed
   - [ ] Check which features are locked for free users

3. **Select a Plan**:
   - [ ] Click "Select" or "Upgrade" on Monthly Premium
   - [ ] Verify you're taken to checkout/payment page

4. **Payment Page**:
   - [ ] You should see Stripe payment form
   - [ ] Card number field
   - [ ] Expiry date field
   - [ ] CVC field
   - [ ] Billing address (if required)
   - [ ] **DO NOT ENTER REAL CARD DETAILS**
   - [ ] You can use Stripe test card: `4242 4242 4242 4242`
   - [ ] Expiry: Any future date (e.g., 12/34)
   - [ ] CVC: Any 3 digits (e.g., 123)
   - [ ] **DO NOT CLICK "PAY" or "SUBSCRIBE"** (unless you want to become a premium tester)

5. **Cancel/Go Back**:
   - [ ] Click browser back button or "Cancel" button
   - [ ] Verify you return to account or plans page
   - [ ] Verify you're still on Free plan

---

### **Test 12: Mobile Experience** (20 minutes)

1. **Switch to Mobile Device or Resize Browser**:
   - [ ] Use real mobile device, or
   - [ ] Chrome DevTools → Device Toolbar
   - [ ] Test on iPhone (375px, 390px, 430px)
   - [ ] Test on Android (various sizes)

2. **Mobile Login**:
   - [ ] Logout if logged in
   - [ ] Click "Login" on mobile
   - [ ] Verify modal/form is usable
   - [ ] Login with your credentials
   - [ ] Verify successful login

3. **Mobile Navigation**:
   - [ ] Verify hamburger menu icon appears
   - [ ] Tap hamburger menu
   - [ ] Verify menu slides out
   - [ ] Navigate to:
     - [ ] Home
     - [ ] Fixtures
     - [ ] News
     - [ ] Followed Fixtures
     - [ ] Account
   - [ ] Verify all pages load correctly on mobile

4. **Mobile Followed Fixtures**:
   - [ ] Open Followed Fixtures page
   - [ ] Verify date selector is usable
   - [ ] Tap match cards
   - [ ] Verify navigation works

5. **Mobile Match Live**:
   - [ ] Open any match live page
   - [ ] Verify tabs are tappable
   - [ ] Swipe through tabs (if gesture enabled)
   - [ ] Verify commentary scrolls smoothly
   - [ ] Check statistics fit on screen (no horizontal scroll)

6. **Mobile Account Page**:
   - [ ] Open Account page
   - [ ] Verify all form fields are usable
   - [ ] Try editing profile
   - [ ] Try changing favorite team (team selector should work on mobile)
   - [ ] Save changes
   - [ ] Verify success

7. **Mobile Favorite Button**:
   - [ ] Favorite a match on mobile
   - [ ] Verify heart icon toggles correctly
   - [ ] Thumb-friendly size (not too small)

---

### **Test 13: Session Persistence** (10 minutes)

1. **Login and Close Browser**:
   - [ ] Login to your account
   - [ ] Favorite some matches
   - [ ] Close the browser completely (not just tab)

2. **Reopen Browser**:
   - [ ] Open browser again
   - [ ] Go to The Final Play website
   - [ ] Verify you're **still logged in** (session persisted)
   - [ ] Verify favorites are still saved

3. **Logout and Verify**:
   - [ ] Logout
   - [ ] Verify user menu changes to "Login/Register"
   - [ ] Go to Followed Fixtures
   - [ ] Verify you're redirected or see auth prompt

4. **Login Again**:
   - [ ] Login with same credentials
   - [ ] Verify all your data is still there:
     - [ ] Favorite team
     - [ ] Followed teams
     - [ ] Favorited matches
     - [ ] Profile information

---

### **Test 14: Re-test Team Onboarding** (10 minutes)

1. **Access Onboarding from Account**:
   - [ ] Go to Account → Team Preferences
   - [ ] Click "Change Teams" or "Edit Preferences" button
   - [ ] Team Onboarding Modal should open

2. **Verify Pre-filled Data**:
   - [ ] Your current favorite team should be pre-selected
   - [ ] Your followed teams should appear
   - [ ] isNewUser should be false (editing mode)

3. **Change Favorite Team**:
   - [ ] Search for a different team
   - [ ] Select new favorite (e.g., change Arsenal to Chelsea)
   - [ ] Proceed to next step

4. **Modify Followed Teams**:
   - [ ] Try adding another team (if allowed)
   - [ ] If blocked, note the "Upgrade to Premium" message
   - [ ] Remove one followed team (if you have any)

5. **Save Changes**:
   - [ ] Click "Save" or "Complete"
   - [ ] Verify success message
   - [ ] Go to Homepage
   - [ ] Verify content reflects new favorite team

---

### **Test 15: Cookie Consent Management** (10 minutes)

1. **Access Cookie Settings**:
   - [ ] Look for floating **Cookie Settings** button (usually bottom-right corner)
   - [ ] Click it
   - [ ] Cookie Settings Modal should open

2. **Review Cookie Categories**:
   - [ ] Essential Cookies: Should be always ON (non-toggleable)
   - [ ] Analytics Cookies: Toggle available
   - [ ] Marketing Cookies: Toggle available
   - [ ] Functional Cookies: Toggle available

3. **Change Cookie Preferences**:
   - [ ] Turn OFF Analytics cookies
   - [ ] Turn OFF Marketing cookies
   - [ ] Leave Functional ON
   - [ ] Click "Save Preferences"
   - [ ] Verify success message

4. **Verify Ad Changes** (if applicable):
   - [ ] Refresh pages
   - [ ] If marketing cookies are OFF, personalized ads might not show
   - [ ] Essential ads may still appear
   - [ ] Note any differences

5. **Re-enable All Cookies**:
   - [ ] Open Cookie Settings again
   - [ ] Turn all cookies ON
   - [ ] Save
   - [ ] Continue testing with all enabled

---

## 🐛 Bug Reporting

If you find any issues, please report them using this format:

```
**Bug Title**: [Short description]

**User Type**: Free Registered User (Bailey)

**Page**: [Followed Fixtures / Account / Match Live / etc.]

**Steps to Reproduce**:
1. Login as free user
2. Go to [page]
3. [Action taken]
4. [Result]

**Expected**: 
[What should happen]

**Actual**: 
[What actually happened]

**Account Used**: bailey_test@example.com (or your test account)

**Browser**: [Chrome / Firefox / Safari / Edge]
**Device**: [Desktop / iPhone / Android]
**Screenshot**: [Attach if possible]

**Severity**: 
[ ] Critical (feature completely broken)
[ ] High (major feature not working)
[ ] Medium (minor feature issue or visual bug)
[ ] Low (cosmetic issue)
```

---

## ✅ Testing Checklist Summary

### Account & Authentication:
- [ ] Registration flow works correctly
- [ ] Login/logout works reliably
- [ ] Session persists across browser restarts
- [ ] Profile updates save correctly

### Team Features:
- [ ] Team onboarding works for new users
- [ ] Favorite team selection saves
- [ ] Followed teams limited appropriately for free users
- [ ] Re-editing teams works from Account page
- [ ] Upgrade prompts appear when trying to add multiple teams

### Personalization:
- [ ] Followed Fixtures page shows correct matches
- [ ] Filter tabs work (All, Favorite, Followed, Favorited)
- [ ] Date selector filters matches correctly
- [ ] Homepage shows personalized content (if implemented)

### Favorite Matches:
- [ ] Heart icon works on match cards
- [ ] Favorites save and persist
- [ ] Favorited matches appear in Followed Fixtures tab
- [ ] Unfavoriting removes match from favorites

### Match Experience:
- [ ] Match Live page displays all tabs correctly
- [ ] Real-time updates work for live matches
- [ ] Match reports are accessible
- [ ] Statistics display (with appropriate premium locks if any)

### Account Management:
- [ ] Profile editing works
- [ ] Team preferences update correctly
- [ ] Subscription page displays current plan
- [ ] Cookie settings save properly

### Ads & Premium:
- [ ] Advertisements display for free users
- [ ] Ads don't break layout
- [ ] Premium upgrade prompts appear appropriately
- [ ] Subscription plans page loads correctly

### Mobile:
- [ ] All features work on mobile devices
- [ ] Navigation menu works on small screens
- [ ] Forms are usable on mobile
- [ ] Heart icons and buttons are tap-friendly

### Content Access:
- [ ] News page accessible
- [ ] Team pages load correctly
- [ ] Fixtures page with filters works
- [ ] No inappropriate paywalls blocking core content

---

## ✨ Features FREE Users Have:

- ✅ Follow ONE favorite team
- ✅ Save individual favorite matches
- ✅ Personalized Followed Fixtures page
- ✅ Access to all public match data
- ✅ Match live updates and reports
- ✅ Basic statistics
- ✅ Account management
- ✅ News and articles
- ✅ Mobile access

## 🚫 Features FREE Users DON'T Have:

- ❌ Ad-free experience (ads still visible)
- ❌ Follow MULTIPLE teams unlimited
- ❌ Premium statistics (may be locked)
- ❌ API access
- ❌ Push notifications (may be premium only)
- ❌ Exclusive premium content

---

## ⏱️ Estimated Testing Time

**Total Time**: ~3 hours

- Tests 1-3: 40 minutes (Account creation, onboarding, settings)
- Tests 4-5: 35 minutes (Followed Fixtures, Favorites)
- Tests 6-8: 40 minutes (Personalization, matches, news)
- Tests 9-11: 30 minutes (Ads, premium flow)
- Test 12: 20 minutes (Mobile testing)
- Tests 13-15: 30 minutes (Session, re-onboarding, cookies)

---

## 🎉 Thank You!

Your testing as a free registered user is critical! You're helping ensure that The Final Play provides a great experience for users who want personalized features without committing to a paid subscription.

**After completing this testing, you can proceed to test as a Premium User using the Premium testing guide.**

---

*Happy Testing!* ⚽
