# Complete Component, Feature & Interaction List

## Overview
This document provides a comprehensive list of all components, features, and possible user interactions in The Final Play application. Use this as a reference for creating additional testing materials, documentation, or training guides.

---

## 🗂️ Application Structure

### Frontend (React 19)
- **Framework**: React 19 with React Router
- **State Management**: Context API (AuthContext, SubscriptionContext, AdSenseContext)
- **Styling**: Custom CSS modules
- **API Communication**: Fetch API + axios
- **Real-time**: Server-Sent Events (SSE)
- **Payment**: Stripe Elements

### Backend (Node.js + Express)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Authentication**: JWT tokens
- **External APIs**: Sportmonks API (football data)
- **Payments**: Stripe API
- **RSS Parsing**: XML/RSS feed parsers
- **Social**: Twitter/X API integration

---

## 📄 Pages & Routes

### Public Pages (No Authentication Required)

1. **Homepage** - `/`
   - Live score cards
   - Today's matches
   - Date selector (Today, Tomorrow, Yesterday, Custom)
   - League filter
   - Top stories carousel
   - Latest news grid
   - AdSense ads

2. **Fixtures Page** - `/fixtures`
   - Date filter (quick buttons + date picker)
   - Country filter dropdown
   - League filter dropdown (updates based on country)
   - Live-only toggle
   - Clear filters button
   - Hierarchical display (Country → League → Matches)
   - Collapsible country sections
   - Collapsible league sections
   - Match cards with favorite button

3. **Team Overview** - `/:teamSlug`
   - Team header (name, logo)
   - Last match summary card
   - Team match history component
   - Upcoming fixtures
   - Team news section
   - AdSense ads

4. **Match Live** - `/:teamSlug/match/:matchId/live`
   - Match header (teams, score, status, venue)
   - Favorite match button
   - Real-time updates via SSE
   - Tabbed interface:
     - Commentary tab (auto-scrolling, highlighting new)
     - Key Events tab (goals, cards, subs, VAR)
     - Lineups tab (formation, starting XI, subs, coach)
     - Statistics tab (possession, shots, fouls, etc.)
   - Link to match report
   - AdSense ads

5. **Match Report** - `/:teamSlug/match/:matchId/report`
   - Match overview (score, date, venue)
   - AI-generated narrative report
   - Key moments description
   - Embedded tweets
   - Player ratings
   - Formation display
   - Statistics summary
   - Navigation links

6. **News Page** - `/news`
   - League filter dropdown
   - News cards grid
   - Article image, headline, source, timestamp
   - External links to full articles
   - Relative timestamps ("2 hours ago")
   - AdSense ads

7. **League Fixtures** - `/league/:leagueId/fixtures`
   - League header (name, logo)
   - All league fixtures
   - Similar filters to main fixtures page
   - League standings (if implemented)

8. **Privacy Policy** - `/privacy-policy`
   - GDPR compliance information
   - Data collection practices
   - Cookie usage
   - User rights
   - Contact info

9. **Terms of Service** - `/terms-of-service`
   - User agreement
   - Subscription terms
   - Refund policy
   - Disclaimers

### Authenticated Pages (Login Required)

10. **Account Page** - `/account`
    - Profile tab (edit first name, surname, display name, phone, country, bio)
    - Cookie settings section
    - Links to other account pages

11. **Team Preferences** - `/account/team-preferences`
    - Favorite team selector
    - Followed teams multi-selector
    - Team search
    - Save preferences button
    - Upgrade prompt for free users

12. **Followed Fixtures** - `/followed-fixtures`
    - Personalized match list for followed teams
    - Filter tabs:
      - All Matches
      - Favorite Team Only
      - Followed Teams
      - Favorited Matches
    - Date selector
    - Match cards with favorite button
    - Empty states

13. **Subscription Management** - `/account/subscription`
    - Current plan display
    - Subscription status
    - Next billing date
    - Payment method (last 4 digits)
    - Billing history
    - Upgrade/Downgrade options
    - Cancel subscription button

### Subscription Flow Pages

14. **Subscription Plans** - `/subscription/plans`
    - Free plan card
    - Monthly Premium card
    - Yearly Premium card
    - Feature comparison
    - Pricing display
    - Select/Subscribe buttons

15. **Subscription Success** - `/subscription/success`
    - Success message
    - Plan confirmation
    - Next billing date
    - Access to features
    - Continue button

16. **Subscription Cancel** - `/subscription/cancel`
    - Cancellation confirmation
    - Feedback form (optional)
    - Reason selection
    - Retention offers (optional)
    - Confirm cancel button

### Admin Pages (Admin Authentication Required)

17. **Admin Panel** - `/admin`
    - Admin login page
    - Dashboard with stats and health indicators
    - Navigation menu to all admin sections
    - Recent activity log

---

## 🧩 Components

### Layout Components

1. **MainLayout** - `components/MainLayout/MainLayout.jsx`
   - Wrapper for pages with header and footer
   - Renders Header, page content, Footer
   - Outlet for React Router

2. **Header** - `components/Header/Header.jsx`
   - App logo (links to home)
   - Navigation menu (Home, Fixtures, News, Followed Fixtures)
   - Auth buttons (Login, Register) for guests
   - User menu for authenticated users
   - Mobile hamburger menu

3. **FooterNav** - `components/FooterNav/FooterNav.jsx`
   - Quick links (Home, Fixtures, News, Account)
   - Legal links (Privacy, Terms)
   - Copyright notice
   - Social media links (if implemented)

4. **HeaderNav** - `components/HeaderNav/HomeHeaderNav.jsx`
   - Variation for homepage
   - Sticky/fixed positioning options

### Content Components

5. **LiveScoreCards** - `components/LiveScoreCards/LiveScoreCards.jsx`
   - Displays live match cards
   - Auto-updates with live scores
   - Props: matches array, status filter

6. **OverviewScoreCards** - `components/LiveScoreCards/OverviewScoreCards.jsx`
   - Compact score card for overview pages
   - Team names, scores, status

7. **TopStories** - `components/TopStories/TopStories.jsx`
   - Carousel/slider of featured news
   - Image, headline, source
   - Click to read more

8. **NewsCard** - `components/NewsCard/NewsCard.jsx`
   - Individual news article card
   - Image, headline, source, timestamp
   - External link

9. **MatchInfoCard** - `components/MatchInfoCard/MatchInfoCard.jsx`
   - Match summary card
   - Teams, score, date, venue, status
   - Link to match live/report

10. **TeamMatchSummary** - `components/TeamMatchSummary/TeamMatchSummary.jsx`
    - Historical match stats for a team
    - Recent form, win/loss/draw
    - Performance metrics

11. **TopLeagues** - `components/TopLeagues/TopLeagues.jsx`
    - Display of popular leagues
    - League logos, names, links

12. **MatchLivePanel** - `components/MatchLivePanel.jsx`
    - Container for live match tabbed interface
    - Manages tab switching
    - Real-time update handling

13. **ReportContent** - `components/ReportContent/ReportContent.jsx`
    - Renders AI-generated match report
    - Parses and displays report sections
    - Embeds tweets, images, stats

14. **EmbeddedTweet** - `components/EmbeddedTweet/EmbeddedTweet.jsx`
    - Twitter/X embed component
    - Displays tweet in match reports
    - Loads Twitter widget script

15. **FormationTestComponent** - `components/FormationTestComponent.jsx`
    - Visual team formation display
    - Player positioning
    - Tactical layout (4-4-2, 4-3-3, etc.)

### User Management Components

16. **AuthModal** - `components/Auth/AuthModal.jsx`
    - Login/Register modal dialog
    - Tab switching between login and register
    - Form validation
    - Success/error messaging
    - Links to legal pages

17. **AuthButtons** - `components/Auth/AuthButtons.jsx`
    - Login and Register buttons
    - Displayed in header for guests

18. **UserMenu** - `components/Auth/UserMenu.jsx`
    - Dropdown menu for authenticated users
    - Display name/email
    - Account Settings link
    - Team Preferences link
    - Subscription link
    - Logout button

19. **TeamOnboarding** - `components/TeamOnboarding/TeamOnboarding.jsx`
    - Modal for team selection
    - Favorite team step
    - Followed teams step
    - Search and select interface
    - Skip and complete buttons
    - isNewUser vs editing mode

20. **TeamSelection** - `components/TeamSelection/TeamSelection.jsx`
    - Team search component
    - Browse by league/country
    - Select team(s)
    - Used in onboarding and preferences

### Favorites Components

21. **FavoriteButton** - `components/Favorites/FavoriteButton.jsx`
    - Heart icon button
    - Toggle favorite state
    - Login prompt for guests
    - API integration

22. **FavoriteMatchCard** - `components/Favorites/FavoriteMatchCard.jsx`
    - Match card variant for favorites
    - Includes unfavorite option
    - Used in Followed Fixtures page

### Subscription Components

23. **SubscriptionPlans** - `components/Subscription/SubscriptionPlans.jsx`
    - Plan comparison cards
    - Feature lists
    - Pricing display
    - Subscribe buttons

24. **SubscriptionManagement** - `components/Subscription/SubscriptionManagement.jsx`
    - Current subscription details
    - Manage plan options
    - Cancel/Upgrade buttons
    - Billing history

### AdSense Components

25. **AdSenseAd** - `components/AdSense/AdSenseAd.jsx`
    - Google AdSense ad slot
    - Responsive sizing
    - Lazy loading
    - Hidden for premium users

26. **PremiumBanner** - `components/AdSense/PremiumBanner.jsx`
    - "Thank you" banner for premium users
    - Replaces ad slots
    - Premium branding

### Cookie Consent Components

27. **CookieConsentBanner** - `components/CookieConsent/CookieConsentBanner.jsx`
    - GDPR cookie consent banner
    - Accept All, Reject All, Customize buttons
    - Persistent until choice made

28. **CookieSettingsButton** - `components/CookieConsent/CookieSettingsButton.jsx`
    - Floating button to reopen settings
    - Visible after consent given
    - Usually bottom-right corner

29. **CookieSettingsSection** - `components/CookieConsent/CookieSettingsSection.jsx`
    - Cookie preferences modal/section
    - Toggle for each cookie category
    - Save preferences button
    - Used in Account page and as modal

### Admin Components

30. **AdminPanel** - `components/Admin/AdminPanel.jsx`
    - Main admin dashboard
    - Navigation to admin sections
    - Stats and health indicators

31. **AdminAuth** - `components/Admin/AdminAuth.jsx`
    - Admin login form
    - Separate from user authentication

32. **RssManagement** - `components/Admin/RssManagement.jsx`
    - List of RSS feeds
    - Add, edit, delete feeds
    - Test feed parsing
    - View feed items

33. **TeamManagement** - `components/Admin/TeamManagement.jsx`
    - List all teams
    - Edit team details
    - Add new teams (if allowed)
    - Sync from API

34. **TeamFeedSubscriptions** - `components/Admin/TeamFeedSubscriptions.jsx`
    - Link teams to RSS feeds
    - Manage subscriptions
    - Set priorities

35. **UnifiedRssManagement** - `components/Admin/UnifiedRssManagement.jsx`
    - Combined RSS and team-feed management
    - Streamlined interface

### Utility Components

36. **ErrorBoundary** - `components/ErrorBoundary.jsx`
    - React error boundary
    - Catches component errors
    - Displays fallback UI

37. **TestingBanner** - `components/TestingBanner.js`
    - Yellow warning banner
    - "This site is in testing mode"
    - Visible in test environments only

---

## 🎯 Features

### Authentication Features

1. **User Registration**
   - Email and password
   - First name and surname
   - Terms & Conditions acceptance
   - Email validation
   - Password strength requirements (min 8 chars)

2. **User Login**
   - Email and password
   - "Remember me" option
   - JWT token-based auth
   - HTTP-only cookies
   - Session persistence

3. **Logout**
   - Clear JWT token
   - Clear session
   - Redirect to homepage

4. **Password Reset** (if implemented)
   - Email-based reset link
   - Token expiration
   - New password validation

5. **Session Management**
   - Auto-login on page reload
   - Token refresh
   - Session timeout

### Team Following Features

6. **Favorite Team**
   - Select one primary team
   - All users can choose one
   - Personalized content

7. **Followed Teams**
   - Free users: Limited (0-1 beyond favorite)
   - Premium users: Unlimited
   - Multi-select interface
   - Team search

8. **Team Onboarding**
   - First-time modal
   - Guided team selection
   - Skip option
   - Re-editable from Account

9. **Team Search**
   - Search by team name
   - Filter by league
   - Filter by country
   - Auto-complete suggestions

### Match Features

10. **Live Matches**
    - Real-time score updates
    - Live commentary stream
    - SSE (Server-Sent Events)
    - Auto-refresh every 6 seconds
    - Connection status indicator

11. **Match Commentary**
    - Minute-by-minute updates
    - Auto-scroll to latest
    - Highlight new comments
    - Minute markers (45', 67', etc.)

12. **Key Events**
    - Goals with scorer names
    - Yellow cards
    - Red cards
    - Substitutions
    - VAR decisions
    - Penalties
    - Event icons (⚽, 🟨, 🟥, etc.)

13. **Match Lineups**
    - Starting XI for both teams
    - Formation diagram (if available)
    - Substitute players
    - Coach information
    - Team selector (Home/Away tabs)

14. **Match Statistics**
    - Possession percentage
    - Shots on/off target
    - Corners
    - Fouls
    - Offsides
    - Pass accuracy
    - Advanced metrics (premium)

15. **Match Reports**
    - AI-generated narrative
    - Match summary
    - Key moments
    - Player ratings
    - Statistics recap
    - Embedded tweets
    - Formation display

16. **Match Status**
    - Not Started (NS)
    - First Half (1H)
    - Half Time (HT)
    - Second Half (2H)
    - Full Time (FT)
    - Extra Time (ET)
    - Penalties (PEN)
    - Abandoned (ABD)

### Fixtures Features

17. **Date Filtering**
    - Quick select (Today, Tomorrow, Yesterday)
    - Custom date picker
    - Date range selection (if implemented)

18. **Geographic Filtering**
    - Filter by country
    - Filter by league (dependent on country)
    - Clear filters option

19. **Live-Only Toggle**
    - Show only live matches
    - Checkbox filter
    - Real-time refresh

20. **Hierarchical Display**
    - Organized by Country
    - Sub-organized by League
    - Match count badges
    - Expand/Collapse sections

21. **Fixture Cards**
    - Team names (linkable)
    - Match time or score
    - League/competition badge
    - Match status
    - Venue name
    - Live indicator (pulsing animation)
    - Favorite button

### Favorite Features

22. **Favorite Matches**
    - Heart icon on match cards
    - Save individual matches
    - View all favorites
    - Unfavorite option
    - Persists across sessions

23. **Favorite Persistence**
    - Saved to database
    - Synced across devices
    - Appears in Followed Fixtures

### News Features

24. **News Articles**
    - RSS feed aggregation
    - Article cards (image, headline, source)
    - External links
    - Publication timestamps

25. **News Filtering**
    - Filter by league
    - All leagues option
    - Auto-updates on filter change

26. **News Sources**
    - ESPN, Goal.com, BBC, etc.
    - Configurable RSS feeds
    - Admin-managed sources

### Subscription Features

27. **Subscription Plans**
    - Free: Basic features, ads, 1 team
    - Monthly Premium: Ad-free, unlimited teams, $9.99/mo
    - Yearly Premium: All Monthly + API, $99.99/yr

28. **Stripe Integration**
    - Secure checkout
    - Stripe Elements
    - Test mode support
    - PCI compliance
    - Saved payment methods

29. **Subscription Management**
    - View current plan
    - Upgrade/Downgrade
    - Cancel subscription
    - Reactivate subscription
    - Update payment method
    - View billing history
    - Download invoices

30. **Payment Processing**
    - Credit/Debit cards
    - 3D Secure authentication
    - Declined card handling
    - Proration for plan changes

31. **Premium Benefits**
    - Ad-free experience
    - Follow unlimited teams
    - Premium statistics
    - Exclusive content
    - Priority support
    - API access (Yearly only)

### AdSense Features

32. **Ad Display**
    - Banner ads
    - Inline ads
    - Medium rectangles
    - Responsive sizing
    - Lazy loading

33. **Ad Placement**
    - Header banner
    - Sidebar (desktop)
    - Inline within content
    - Footer (protected from overlap)

34. **Ad Controls**
    - Hidden for premium users
    - Cookie consent enforcement
    - Marketing cookies toggle

### Cookie Consent Features

35. **Cookie Banner**
    - First-visit popup
    - Accept All, Reject All, Customize
    - Persistent choice
    - GDPR compliant

36. **Cookie Categories**
    - Essential (always on)
    - Analytics (optional)
    - Marketing (optional)
    - Functional (optional)

37. **Cookie Management**
    - Reopen settings anytime
    - Update preferences
    - Clear and reset

### Account Management Features

38. **Profile Editing**
    - First name, surname
    - Display name
    - Phone number
    - Country selection
    - Bio text
    - Save changes

39. **Team Preferences**
    - Change favorite team
    - Add/remove followed teams
    - Team search
    - Upgrade prompts for free users

40. **Cookie Settings**
    - Manage cookie preferences
    - Toggle categories
    - Save preferences

41. **Subscription Settings**
    - View plan details
    - Manage payment method
    - View billing history
    - Cancel/upgrade plan

### Admin Features

42. **RSS Feed Management**
    - View all feeds
    - Add new feed
    - Edit feed URL and settings
    - Test feed parsing
    - Disable/Enable feeds
    - Delete feeds
    - View feed items

43. **Team Management**
    - View all teams
    - Search/filter teams
    - Edit team details
    - Add new teams
    - Sync from Sportmonks API
    - Delete teams

44. **Team-Feed Subscriptions**
    - Link teams to RSS feeds
    - Set feed priorities
    - Enable/Disable associations
    - Bulk operations

45. **Twitter Integration**
    - Add team Twitter accounts
    - Configure reporter accounts
    - Fetch tweets manually
    - Hashtag monitoring
    - Tweet prioritization rules

46. **Content Moderation**
    - Review pending articles
    - Approve/Reject content
    - Edit article metadata
    - Flag inappropriate content
    - Delete content

47. **User Management** (if implemented)
    - View user list
    - Search users
    - View user details
    - Edit user roles
    - Suspend/Ban users
    - Delete users (GDPR)

48. **Analytics Dashboard**
    - User statistics
    - Subscription metrics
    - Revenue tracking
    - Content performance
    - Top teams/leagues
    - Traffic sources

49. **System Configuration**
    - General settings
    - API keys
    - Email settings
    - Stripe configuration
    - Sync frequencies

50. **Data Sync**
    - Manual sync triggers
    - View sync status
    - Sync logs
    - Configure cron jobs
    - Error handling

51. **Database Tools**
    - View database stats
    - Search/query data
    - Backup database
    - Restore from backup
    - Optimize database

52. **Logs & Monitoring**
    - Application logs
    - Error logs
    - API logs
    - Security logs
    - Export logs

### SEO & Metadata Features

53. **JSON-LD Schemas**
    - SportsEvent schema
    - LiveBlogPosting schema
    - NewsArticle schema
    - Organization schema
    - BreadcrumbList schema

54. **Meta Tags**
    - Dynamic page titles
    - Open Graph tags
    - Twitter Card tags
    - Canonical URLs
    - Robots meta (noindex in testing)

### Miscellaneous Features

55. **Testing Mode**
    - Testing banner display
    - Noindex meta tags
    - Visual indicators
    - Test data flagging

56. **Mobile Responsiveness**
    - All pages adapt to mobile
    - Touch-friendly buttons
    - Mobile navigation menu
    - Responsive images
    - No horizontal scrolling

57. **Cross-Browser Compatibility**
    - Chrome support
    - Firefox support
    - Safari support
    - Edge support
    - Mobile browser support

58. **Performance Optimization**
    - Image lazy loading
    - Code splitting
    - Bundle optimization
    - Caching strategies
    - CDN usage (if implemented)

59. **Error Handling**
    - Error boundaries
    - Graceful degradation
    - User-friendly error messages
    - Retry mechanisms
    - Fallback content

60. **Accessibility**
    - Keyboard navigation
    - Screen reader support
    - ARIA labels
    - Color contrast
    - Focus indicators

---

## 🔄 User Interactions

### Guest User Interactions

1. View homepage
2. Browse live matches
3. Filter matches by date
4. Filter matches by league
5. View fixtures page
6. Filter fixtures by country/league/date
7. Expand/Collapse country sections
8. Expand/Collapse league sections
9. Click match card to view live match
10. View match commentary
11. Switch between match tabs (Commentary, Events, Lineups, Stats)
12. View match report (finished matches)
13. Click team name to view team page
14. View team overview
15. Browse news page
16. Filter news by league
17. Click news article to read more
18. Click favorite button (prompts login)
19. Accept/Reject cookie consent
20. Customize cookie settings
21. View privacy policy
22. View terms of service
23. Click register button
24. Fill registration form
25. Submit registration
26. Click login button
27. Fill login form
28. Submit login

### Free Registered User Interactions

*All Guest interactions, plus:*

29. Auto-login on page load
30. Team onboarding modal appears
31. Search for favorite team
32. Select favorite team
33. Try to add followed teams (limited)
34. See upgrade prompt
35. Skip or complete onboarding
36. Access Followed Fixtures page
37. View matches for favorite team
38. Filter Followed Fixtures by tabs
39. Change date in Followed Fixtures
40. Favorite individual matches (heart icon)
41. View favorited matches tab
42. Unfavorite matches
43. Go to Account page
44. Edit profile information
45. Save profile changes
46. Go to Team Preferences
47. Change favorite team
48. Try to add multiple followed teams (blocked)
49. See upgrade to premium message
50. Go to Subscription page
51. View subscription plans
52. Click upgrade button (navigates to checkout)
53. Manage cookie preferences in Account
54. Open user menu
55. Logout from user menu

### Premium User Interactions

*All Free User interactions, plus:*

56. Navigate to subscription plans page
57. Select Monthly or Yearly plan
58. Enter Stripe payment details
59. Complete payment
60. View success page
61. Subscription activates immediately
62. No ads displayed anywhere
63. Add unlimited followed teams
64. View Followed Fixtures with many teams
65. See all matches for all teams
66. Access premium statistics
67. View advanced match metrics
68. Go to Account → Subscription
69. View current plan and status
70. View billing history
71. Download invoices
72. Update payment method
73. Upgrade from Monthly to Yearly
74. Downgrade from Yearly to Monthly
75. Cancel subscription
76. See retention offer (optional)
77. Confirm cancellation
78. Subscription remains active until period ends
79. Reactivate subscription before expiry
80. Access API keys (Yearly only)
81. View API documentation
82. Premium banner instead of ads

### Admin User Interactions

*Plus admin-specific:*

83. Navigate to /admin
84. Admin login
85. View admin dashboard
86. View system health indicators
87. View recent activity log
88. Navigate to RSS Management
89. View all RSS feeds
90. Add new RSS feed
91. Edit RSS feed
92. Test RSS feed parsing
93. Disable/Enable RSS feed
94. Delete RSS feed
95. View feed articles
96. Navigate to Team Management
97. View all teams
98. Search for team
99. Edit team details
100. Add new team
101. Sync team from Sportmonks API
102. Delete team
103. Navigate to Team-Feed Subscriptions
104. Link team to RSS feed
105. Set feed priority
106. Edit subscription
107. Remove subscription
108. Navigate to Twitter Integration
109. Add team Twitter account
110. Add reporter accounts
111. Fetch tweets manually
112. Configure hashtag monitoring
113. Set tweet prioritization rules
114. Navigate to Content Moderation
115. Review pending articles
116. Approve article
117. Reject article
118. Edit article metadata
119. Flag inappropriate content
120. Delete article
121. Navigate to User Management (if available)
122. View user list
123. Search for user
124. View user details
125. Edit user role
126. Suspend user
127. Delete user
128. Navigate to Analytics
129. View user statistics
130. View subscription metrics
131. View content performance
132. Export analytics report
133. Navigate to System Configuration
134. Edit general settings
135. Configure API settings
136. Configure email settings
137. Configure Stripe settings
138. Save configuration
139. Navigate to Data Sync
140. View sync status
141. Trigger manual sync (matches, RSS, Twitter)
142. View sync logs
143. Configure cron jobs
144. Navigate to Database Tools
145. View database statistics
146. Search/Query database
147. Backup database
148. Restore from backup
149. Optimize database
150. Navigate to Logs
151. View application logs
152. Filter logs by level/date
153. Search logs
154. Export logs
155. Admin logout

---

## 🔌 API Endpoints (Backend)

### Authentication Endpoints
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login user
- POST `/api/auth/logout` - Logout user
- GET `/api/auth/me` - Get current user
- POST `/api/auth/refresh` - Refresh JWT token
- POST `/api/auth/forgot-password` - Request password reset
- POST `/api/auth/reset-password` - Reset password with token

### User Endpoints
- GET `/api/users/:userId` - Get user profile
- PUT `/api/users/:userId` - Update user profile
- DELETE `/api/users/:userId` - Delete user account
- GET `/api/users/:userId/team-preferences` - Get team preferences
- PUT `/api/users/:userId/team-preferences` - Update team preferences

### Match Endpoints
- GET `/api/matches` - Get all matches (with filters)
- GET `/api/matches/live` - Get live matches
- GET `/api/matches/today` - Get today's matches
- GET `/api/matches/:matchId` - Get match by ID
- GET `/api/matches/:matchId/stream` - SSE stream for live updates
- GET `/api/:teamSlug/match/:matchId/live` - Get match live data
- GET `/api/:teamSlug/match/:matchId/report` - Get match report

### Fixtures Endpoints
- GET `/api/fixtures` - Get all fixtures (with filters)
- GET `/api/fixtures/countries` - Get all countries with matches
- GET `/api/fixtures/leagues` - Get all leagues (optionally filtered by country)
- GET `/api/fixtures/live` - Get live fixtures only

### Team Endpoints
- GET `/api/teams` - Get all teams (paginated)
- GET `/api/teams/:teamId` - Get team by ID
- GET `/api/teams/:teamSlug` - Get team by slug
- GET `/api/teams/:teamId/matches` - Get team's matches
- GET `/api/teams/:teamId/last-match` - Get team's last match
- GET `/api/teams/:teamId/upcoming` - Get team's upcoming matches
- GET `/api/teams/:teamId/news` - Get team's news

### News Endpoints
- GET `/api/news` - Get all news articles
- GET `/api/news/leagues` - Get leagues with news available
- GET `/api/news/league/:leagueId` - Get news for specific league

### League Endpoints
- GET `/api/leagues` - Get all leagues
- GET `/api/leagues/:leagueId` - Get league by ID
- GET `/api/leagues/:leagueId/fixtures` - Get league fixtures

### Favorites Endpoints
- GET `/api/favorites/matches` - Get user's favorite matches
- POST `/api/favorites/matches/:matchId` - Add match to favorites
- DELETE `/api/favorites/matches/:matchId` - Remove match from favorites

### Subscription Endpoints
- GET `/api/subscriptions/plans` - Get available subscription plans
- POST `/api/subscriptions/create-checkout-session` - Create Stripe checkout
- POST `/api/subscriptions/customer-portal` - Access Stripe customer portal
- GET `/api/subscriptions/current` - Get current subscription
- POST `/api/subscriptions/cancel` - Cancel subscription
- POST `/api/subscriptions/reactivate` - Reactivate subscription
- GET `/api/subscriptions/billing-history` - Get billing history

### Admin Endpoints
- POST `/api/admin/login` - Admin login
- GET `/api/admin/dashboard` - Admin dashboard data
- GET `/api/admin/rss-feeds` - Get all RSS feeds
- POST `/api/admin/rss-feeds` - Add new RSS feed
- PUT `/api/admin/rss-feeds/:feedId` - Update RSS feed
- DELETE `/api/admin/rss-feeds/:feedId` - Delete RSS feed
- POST `/api/admin/rss-feeds/:feedId/fetch` - Fetch feed manually
- GET `/api/admin/teams` - Get all teams
- POST `/api/admin/teams` - Add new team
- PUT `/api/admin/teams/:teamId` - Update team
- DELETE `/api/admin/teams/:teamId` - Delete team
- GET `/api/admin/team-feeds` - Get team-feed subscriptions
- POST `/api/admin/team-feeds` - Add team-feed subscription
- PUT `/api/admin/team-feeds/:subscriptionId` - Update subscription
- DELETE `/api/admin/team-feeds/:subscriptionId` - Delete subscription
- GET `/api/admin/twitter` - Get Twitter accounts
- POST `/api/admin/twitter` - Add Twitter account
- PUT `/api/admin/twitter/:accountId` - Update Twitter account
- DELETE `/api/admin/twitter/:accountId` - Delete Twitter account
- POST `/api/admin/twitter/:accountId/fetch` - Fetch tweets
- GET `/api/admin/articles` - Get all articles
- PUT `/api/admin/articles/:articleId/approve` - Approve article
- PUT `/api/admin/articles/:articleId/reject` - Reject article
- DELETE `/api/admin/articles/:articleId` - Delete article
- GET `/api/admin/users` - Get all users
- GET `/api/admin/users/:userId` - Get user details
- PUT `/api/admin/users/:userId` - Update user
- DELETE `/api/admin/users/:userId` - Delete user
- GET `/api/admin/analytics` - Get analytics data
- GET `/api/admin/sync/status` - Get sync status
- POST `/api/admin/sync/matches` - Trigger match sync
- POST `/api/admin/sync/rss` - Trigger RSS sync
- POST `/api/admin/sync/twitter` - Trigger Twitter sync
- GET `/api/admin/logs` - Get application logs
- GET `/api/admin/database/stats` - Get database statistics
- POST `/api/admin/database/backup` - Backup database

### Webhook Endpoints
- POST `/api/webhooks/stripe` - Stripe webhook handler

---

## 💾 Database Schema (MongoDB)

### User Model
```
{
  _id: ObjectId,
  email: String (unique),
  password_hash: String,
  first_name: String,
  surname: String,
  display_name: String,
  phone: String,
  country: String,
  bio: String,
  favourite_team: Number (team_id),
  followed_teams: [Number] (team_ids),
  subscription_status: String (free/premium_monthly/premium_yearly),
  stripe_customer_id: String,
  stripe_subscription_id: String,
  cookie_preferences: {
    analytics: Boolean,
    marketing: Boolean,
    functional: Boolean
  },
  created_at: Date,
  updated_at: Date,
  last_login: Date
}
```

### Team Model
```
{
  _id: ObjectId,
  id: Number (Sportmonks team_id),
  name: String,
  team_slug: String,
  country: String,
  league: String,
  logo_url: String,
  twitter_handle: String,
  active: Boolean,
  created_at: Date,
  updated_at: Date
}
```

### Match Model
```
{
  _id: ObjectId,
  match_id: Number (Sportmonks match_id),
  teams: {
    home: {
      team_id: Number,
      team_name: String,
      team_slug: String
    },
    away: {
      team_id: Number,
      team_name: String,
      team_slug: String
    }
  },
  score: {
    home: Number,
    away: Number
  },
  match_status: {
    state: String,
    short_name: String,
    developer_name: String
  },
  match_info: {
    starting_at: Date,
    starting_at_timestamp: Number,
    venue: String,
    league: String,
    competition_id: Number,
    season_id: Number,
    stage: String
  },
  minute: Number,
  comments: [Object] (commentary),
  events: [Object] (goals, cards, subs),
  lineups: {
    home: [Object],
    away: [Object]
  },
  statistics: Object,
  report: Object (AI-generated),
  tweets: [Object],
  created_at: Date,
  updated_at: Date
}
```

### News Article Model
```
{
  _id: ObjectId,
  id: String,
  title: String,
  description: String,
  content: String,
  source: String,
  source_url: String,
  image_url: String,
  published_at: Date,
  league_id: Number,
  team_ids: [Number],
  rss_feed_id: ObjectId,
  approved: Boolean,
  flagged: Boolean,
  created_at: Date,
  updated_at: Date
}
```

### RSS Feed Model
```
{
  _id: ObjectId,
  name: String,
  url: String,
  category: String,
  league_id: Number,
  priority: String (high/medium/low),
  active: Boolean,
  last_fetched: Date,
  fetch_frequency: Number (minutes),
  items_count: Number,
  created_at: Date,
  updated_at: Date
}
```

### Team Feed Subscription Model
```
{
  _id: ObjectId,
  team_id: Number,
  rss_feed_id: ObjectId,
  priority: String,
  active: Boolean,
  created_at: Date,
  updated_at: Date
}
```

### Favorite Match Model
```
{
  _id: ObjectId,
  user_id: ObjectId,
  match_id: Number,
  created_at: Date
}
```

### Subscription Model
```
{
  _id: ObjectId,
  user_id: ObjectId,
  stripe_subscription_id: String,
  stripe_customer_id: String,
  plan: String (monthly/yearly),
  status: String (active/canceled/expired),
  current_period_start: Date,
  current_period_end: Date,
  cancel_at_period_end: Boolean,
  canceled_at: Date,
  created_at: Date,
  updated_at: Date
}
```

### Twitter Account Model
```
{
  _id: ObjectId,
  team_id: Number,
  twitter_handle: String,
  account_type: String (official/reporter),
  priority: Number,
  verified: Boolean,
  active: Boolean,
  last_fetched: Date,
  created_at: Date,
  updated_at: Date
}
```

---

## 🎨 Styling & Design

### Color Palette
- Background: `#141417` (dark)
- Cards: `#1c1c21`
- Borders: `#2a2a2f`
- Text Primary: `#fff`
- Text Secondary: `#807e84`
- Accent/Primary: `#e9716b` (coral red)
- Success: `#4caf50`
- Warning: `#ff9800`
- Error: `#ff4444`

### Typography
- Primary Font: System fonts (Arial, Segoe UI, etc.)
- Font Sizes: 14px - 32px range
- Font Weights: 400 (normal), 500 (medium), 600 (semi-bold), 700 (bold)

### Breakpoints
- Desktop: > 1024px
- Tablet: 768px - 1024px
- Mobile: < 768px
- Small Mobile: < 480px

### Common CSS Patterns
- Border Radius: 8px - 12px
- Padding: 0.5rem - 2rem
- Transitions: 0.2s ease
- Box Shadows: `0 4px 12px rgba(0, 0, 0, 0.3)`

---

## 🧪 Testing Personas

1. **Alex** - Guest User
2. **Bailey** - Free Registered User
3. **Charlie** - Premium User
4. **Dana** - Admin User

---

## 📊 Analytics & Metrics

### User Metrics
- Total Users
- New Registrations (daily/weekly/monthly)
- Active Users (DAU/WAU/MAU)
- User Retention Rate
- Churn Rate

### Subscription Metrics
- Free vs Premium breakdown
- Monthly vs Yearly subscribers
- Subscription Conversion Rate
- Monthly Recurring Revenue (MRR)
- Annual Recurring Revenue (ARR)
- Cancellation Rate
- Lifetime Value (LTV)

### Content Metrics
- Total Matches in database
- Matches updated today
- Total News Articles
- Articles published today
- Most viewed teams
- Most viewed matches
- Top performing news articles

### Engagement Metrics
- Average session duration
- Pages per session
- Bounce rate
- Most visited pages
- Feature usage (Favorites, Followed Fixtures, etc.)

---

**End of Document**

This comprehensive list can be used by any AI or human to create additional testing materials, documentation, training guides, or further analysis of The Final Play application.

---

*Version: 1.0*  
*Last Updated: April 7, 2026*  
*Total Components: 60+*  
*Total Features: 60+*  
*Total Interactions: 155+*
