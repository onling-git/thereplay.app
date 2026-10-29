# The Final Play - Football App with Stripe Subscriptions

A full-stack football application with premium subscription features powered by Stripe.

### Public coverage boundaries

Public team, fixture, match, news, report/RSS, standings, cup and sitemap reads use
the configured coverage catalogue. Uninitialized coverage returns HTTP 503;
disabled clubs and competitions return HTTP 404 on direct public routes.
Fixtures require an enabled competition and at least one supported club, with
filters applied before pagination, counts and grouping. Foreign opponents remain
visible inside supported fixtures/standings but have `supported: false` and no
independent public club/report access. `/api/teams/coverage` exposes supported
club metadata. Public reads use `Cache-Control: no-store`; SSE checks coverage
again on each update. Admin jobs and internal model reads remain independent.

Focused offline validation: `cd backend; node --test test_public_coverage.js`.

## Features

### Free Features
- ✅ Live Scores
- ✅ Basic Match Information
- ✅ Team Following (Single Team)

### Premium Features (Monthly/Yearly Subscription)
- 🔒 Premium Statistics & Analytics
- 🔒 Follow Multiple Teams
- 🔒 Ad-Free Experience
- 🔒 Push Notifications
- 🔒 Exclusive Content
- 🔒 API Access (Yearly subscribers only)

## News URLs

General football news remains at `/news`, including its league filter.
Team news uses `/:teamSlug/news`, for example `/southampton/news`, with the
existing team-news API. Each team's public match reports are merged with RSS
stories by publication date.

Team slugs now normalize ampersands as `and` (for example
`/brighton-and-hove-albion`) and collapse duplicate separators. Backend route
resolution accepts legacy stored variants (for example
`/brighton--hove-albion`) for compatibility.

Old `/news?team=southampton` links redirect permanently (301) through Cloudflare
Pages Functions. Client-side navigation and local development also replace the
old URL with `/southampton/news`. Other query parameters are retained; general
news URLs without a team do not redirect. Deploy the frontend with its Pages
Functions to enable the server redirect.

## Application logging

Frontend and backend application code keeps warnings and errors for actionable
diagnostics, without routine console debug/progress messages or payload dumps.
Maintenance scripts and diagnostic/test tools retain their useful console output.
Backend HTTP access logging remains enabled.

## Match report generation and usage

Report generation is disabled on staging for both automated jobs and manual
admin tests (detected by `NODE_ENV` or `RAILWAY_ENVIRONMENT_NAME`). Setting
`REPORT_GENERATION_ENABLED=false` also disables generation in any environment.
Report eligibility follows the public coverage policy below, not a club's
country field. Welsh clubs playing in supported English leagues are included.
Stored reports outside public coverage remain available to administrators but
are not publicly listed or served.

### Public coverage and enrichment

The League & Country Management admin area is authoritative. Domestic leagues
define public clubs from their current-season membership. Country switches gate
domestic leagues without resetting league preferences. Cups and international
competitions cover fixtures involving those clubs, but never make every
opponent a public club. AI reports require a public club and an enabled
competition with reports selected.

Initial launch coverage comprises Premier League (8), Championship (9), League
One (12), League Two (14), and National League (17), with FA Cup (24) and
Carabao Cup (27) coverage for those clubs. Opponents remain available as match
context but cannot be discovered, followed, or opened as standalone public
clubs unless their domestic league is also enabled.

Run **Initialize five-league launch coverage** once in admin before exposing
this release publicly. Until initialization succeeds, coverage fails closed
with an explicit unavailable response. **Refresh from Sportmonks** discovers
subscription changes and refreshes membership; newly discovered competitions
remain disabled until approved. An intentionally empty selection means no
coverage, never a worldwide fallback. Scheduled catalogue refreshes run every
six hours when cron is enabled. Provider refresh errors are surfaced without
interpreting a failed request as loss of all access.

Metadata enrichment runs every 15 minutes for a bounded batch of supported
upcoming fixtures. It refreshes stale or incomplete metadata even if kickoff
has not changed and preserves existing values omitted by lightweight provider
responses. Foreign opponent data may be fetched for these matches without
enabling foreign hubs, routine social collection, or opponent reports.
Enabling reports does not automatically backfill historical fixtures; explicit
single-report regeneration remains subject to club and competition eligibility.

Automatic generation skips matches without a confirmed, consistent full-time
result before starting a generation trace or AI request. Failed paid V4 attempts
have a six-hour automatic retry cooldown; explicit single-report regeneration
can bypass this cooldown, but not the staging or English-team restrictions.

Run 1 uses OpenAI `gpt-4o-mini` unless `INTERPRETATION_MODEL` overrides it.
The V4 final reporter defaults to Claude (`CLAUDE_REPORT_MODEL`, default
`claude-opus-5-5`); its preparation and interpretation stages are not cached.

V4 publication and staging entry points share a MongoDB-backed match/team claim.
Concurrent generation returns HTTP 409 before duplicate AI work starts. Claims
renew every 30 seconds, expire after 10 minutes without renewal after a crash,
and are checked before paid runs and publication. Ordinary automatic triggers
reuse existing V4 reports from the selected provider, even after prompt edits.
The single-report generate endpoint remains an intentional regeneration action;
staging generation remains explicit. No migration or historical regeneration
is performed by this change.

Reporter tweets are collected immediately for the focused team, without an
additional wait. Home and away reports run concurrently. The former five-minute
tweet-backfill regeneration job is removed: a missing or unused tweet is not a
reason to rerun the AI pipeline. Report `meta.social_evidence` and generation
traces distinguish available, usable and embedded tweets, with
`generated_without_usable_tweets` identifying articles written without usable
reporter evidence. This is diagnostic metadata, not a public warning badge.
The two-minute final-whistle-to-publication goal is not a guaranteed deadline:
match-status polling currently runs every two minutes, followed by provider
collection and AI latency. No intentional tweet delay is added.

Matches finishing after extra time (`AET`) or penalties (`FT_PEN`/`FTP`) count as
finished for the instant trigger, missing-report monitors, the backup sweep and
the webhook. Shootout kicks are excluded from the goal ledger; the shootout
score and winner are passed as authoritative facts, so a level score settled on
penalties is reported as a win or loss on penalties rather than a draw.

Generation traces record `trigger`, `forced`, and `published_at` (after saving).
Each run's `requests` records initial/repair calls, provider, model, response ID,
stop reason, timestamps and the provider's raw `usage`. Claude usage includes
input/output and cache-write/cache-read tokens; OpenAI includes prompt/completion
and cached/reasoning details when supplied. Missing usage is null, not zero;
exact currency costs are not inferred from absent usage or hardcoded pricing.
Internal HTTP callers identify their trigger with `x-report-trigger`.

Only the V4 final writer's stable editorial instructions use Claude's explicit
five-minute prefix cache. Club identity and the complete indented dossier follow
the breakpoint. Read/write usage must be measured after deployment; concurrent
cold requests can miss the cache. Dossier fields, JSON formatting and the repeated
report-guidance block are deliberately unchanged pending a separate quality
review. Batch processing is not enabled. Score validation allows winner-first
and club-perspective scores and does not demand a literal score where prose
already describes the result; explicit contradictory final scores still repair.

## Guest homepage preview

The guest homepage uses the team overview layout with static preview content.
The selected team remains "Your Club" with a generic badge; opponents and nearby
table entries use Premier League club names and badges. Match scouting and live
feeds are disabled. Preview actions, including statistics, full table, news and
community links, open the login modal instead of navigating.
The preview dashboard owns its markup in `frontend/src/pages/GuestHome.jsx`
and all its styles in `frontend/src/pages/css/guesthome.css`. Its `gh-` classes
are scoped under `.guest-home`; do not reuse shared dashboard classes or import
team overview/card styles here. Edit this stylesheet to change the guest
dashboard without changing the live hub. Only team search and the login modal
remain shared UI components.

## Dynamic sitemaps

`/sitemap.xml` lists exactly four children: `/sitemaps/teams.xml`,
`/sitemaps/matches.xml`, `/sitemaps/reports.xml` and `/sitemaps/pages.xml`.
Cloudflare Pages Functions proxy these to matching `/api` backend routes.
Deploy both backend and frontend Functions; static-only hosting is insufficient.
Responses have a 60-second cache TTL. Database/proxy failures return errors,
not empty successful sitemaps. Unknown child names return 404.

- Teams: existing team hubs and folder news routes. Generic team `updatedAt`
  is deliberately not used because cache jobs bump it. Published story
  timestamps are used when available; otherwise hub `lastmod` is omitted.
- Matches: stored fixtures only, once per canonical home-team URL, never `/live`
  or an away-team duplicate. Before kickoff, use fixture creation time; at
  kickoff use actual period start (scheduled kickoff if unavailable and past).
  After full-time use period end/final schema freeze time. Live sync `updatedAt`
  never changes sitemap freshness.
- Reports: separate team perspectives, with headlines and public match
  references, using real report creation/edit timestamps. Staging previews
  and unlinked reports are excluded.
- Pages: `/` (guest homepage), `/news`, `/fixtures`, `/privacy-policy`, `/terms-of-service`.
  Static pages have no invented `lastmod`. Account/admin/subscription and
  personalized pages are excluded.

The default 20-item general/team news responses persist only their newest
genuinely dated visible item's timestamp in `NewsCollectionSnapshot`.
Undated, future-dated or empty collections omit `lastmod`; RSS parser fallback
"now" dates are not trusted. News timestamps are available after the first
default news request, not guessed from reports alone or generated on crawl.
Filtered/alternate-limit requests do not overwrite the default snapshot.

XML is escaped, deterministic and deduplicated. Files exceeding 50,000 URLs
or 50 MB fail explicitly rather than silently truncating. Before a type reaches
40,000 URLs, introduce season-specific children directly in the index (no
nested indexes). No `priority` or `changefreq` is emitted.

`robots.txt` references `https://thereplay.app/sitemap.xml` once. **Testing-phase
crawler blocks and HTML noindex remain intentionally enabled.** These sitemaps
are launch-ready URL inventories, not permission to index the site yet.
At launch, remove production indexing blocks (retain staging/preview blocks)
and submit that same index URL to Google Search Console and Bing Webmaster Tools.

## Tech Stack

### Backend
- **Node.js** with Express
- **MongoDB** with Mongoose
- **Stripe** for subscription management
- **JWT** for authentication
- **Sportmonks API** for football data

### Frontend
- **React 19** with React Router
- **Stripe Elements** for payment processing
- **Context API** for state management

## Quick Start

### Prerequisites
- Node.js 20+
- MongoDB database
- Stripe account (test mode for development)
- Sportmonks API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd thefinalplay.com
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Environment Setup**
   
   **Backend (.env)**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```
   
   **Frontend (.env)**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

5. **Set up Stripe Products**
   ```bash
   cd backend
   npm run setup:stripe-products
   ```

6. **Start the application**
   
   **Backend:**
   ```bash
   cd backend
   npm run dev
   ```
   
   **Frontend:**
   ```bash
   cd frontend
   npm start
   ```

## Stripe Configuration

### 1. Create Stripe Account
1. Sign up at [stripe.com](https://stripe.com)
2. Get your test API keys from the dashboard
3. Add them to your `.env` files

### 2. Set up Products & Prices
Run the setup script to create subscription products:
```bash
cd backend
npm run setup:stripe-products
```

This creates:
- **Monthly Plan**: £9.99/month
- **Yearly Plan**: £99.99/year (17% savings)

### 3. Configure Webhooks
1. In Stripe Dashboard, go to Developers > Webhooks
2. Add endpoint: `https://your-domain.com/api/subscription/webhook`
3. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook secret to your `.env` file

## API Endpoints

### Subscription Management
- `GET /api/subscription/plans` - Get available subscription plans
- `POST /api/subscription/checkout` - Create checkout session
- `GET /api/subscription/status` - Get current subscription status
- `POST /api/subscription/cancel` - Cancel subscription
- `POST /api/subscription/reactivate` - Reactivate subscription
- `POST /api/subscription/billing-portal` - Create billing portal session
- `POST /api/subscription/webhook` - Stripe webhook handler

### User Management
- `POST /api/users/register` - User registration
- `POST /api/users/login` - User login
- `GET /api/users/me` - Get current user
- `PATCH /api/users/me` - Update user profile

## Subscription Flow

### 1. User Registration/Login
Users can register and use free features immediately.

### 2. Subscription Purchase
1. User visits `/subscription/plans`
2. Selects Monthly or Yearly plan
3. Redirected to Stripe Checkout
4. After payment, redirected to success page
5. Subscription status updated via webhooks

### 3. Subscription Management
Users can manage their subscription at `/account/subscription`:
- View current plan and billing info
- Cancel or reactivate subscription
- Access Stripe billing portal

### 4. Feature Access Control
Premium features are protected by middleware that checks:
- User authentication
- Active subscription status
- Feature-specific permissions

## Deployment

### Railway Deployment
This app is configured for Railway deployment:

1. **Connect Repository**
   - Connect your GitHub repo to Railway
   - Railway will auto-deploy on git pushes

2. **Environment Variables**
   Set all required environment variables in Railway dashboard

3. **Database**
   - Add MongoDB database service in Railway
   - Or use external MongoDB Atlas

### Environment Variables Required

**Backend:**
- `DBURI` - MongoDB connection string
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `FRONTEND_URL` - Website origin for Stripe checkout success/cancel and billing-portal returns (production: `https://thereplay.app`; local: `http://localhost:3000`; staging: your staging frontend origin). Use an HTTP(S) origin without a path or query.
- `SELF_BASE` - Backend API URL for internal API requests; do not change this to the frontend URL.
- `JWT_SECRET` - JWT signing secret
- `ADMIN_API_KEY` - Admin API key
- All other vars from `.env.example`

**Frontend:**
- `REACT_APP_API_BASE` - Backend API URL
- `REACT_APP_STRIPE_PUBLIC_KEY` - Stripe public key

After changing `FRONTEND_URL`, redeploy/restart the backend and create a new checkout session to test the return page. Existing Stripe checkout sessions retain their original return URLs. A return-page 404 does not undo a subscription already created in Stripe; check the existing subscription before starting another checkout.

## Development Scripts

### Backend
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run setup:stripe-products` - Create Stripe products and prices

### Frontend
- `npm start` - Start development server
- `npm run build` - Build for production

## Project Structure

```
thefinalplay.com/
├── backend/
│   ├── controllers/
│   │   ├── subscriptionController.js
│   │   └── userController.js
│   ├── models/
│   │   └── User.js
│   ├── routes/
│   │   ├── subscriptionRoutes.js
│   │   └── userRoutes.js
│   ├── utils/
│   │   ├── stripe.js
│   │   └── catchAsync.js
│   ├── scripts/
│   │   └── setup-stripe-products.js
│   └── server.js
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── Subscription/
    │   ├── contexts/
    │   │   ├── AuthContext.js
    │   │   └── SubscriptionContext.js
    │   ├── pages/
    │   │   ├── SubscriptionPlansPage.jsx
    │   │   └── SubscriptionManagementPage.jsx
    │   └── api/
    │       └── subscriptionApi.js
    └── public/
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support or questions:
- Create an issue in the GitHub repository
- Check the documentation above
- Review Stripe's documentation for payment-related questions