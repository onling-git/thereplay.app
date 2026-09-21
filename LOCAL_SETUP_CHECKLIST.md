# Local Setup Checklist

Use this checklist when setting up this project on a fresh machine.

## 1) Prerequisites

- Install Node.js (LTS)
- Verify tools:
  - `node -v`
  - `npm -v`

## 2) Install Dependencies

From project root:

```bash
cd backend
npm install

cd ../frontend
npm install
```

Notes:

- Backend lockfile currently does not support `npm ci` cleanly on fresh setup; use `npm install`.
- Frontend supports `npm ci` or `npm install`.

## 3) Environment Files

### Backend

- Ensure `backend/.env.local` exists.
- Required for local auth + API startup:
  - `DBURI`
  - `SPORTMONKS_API_KEY`
  - `ADMIN_API_KEY`
  - `JWT_SECRET`

### Frontend

- Ensure `frontend/.env.local` exists with:

```env
REACT_APP_API_BASE="http://localhost:8080"
REACT_APP_STRIPE_PUBLIC_KEY=""
REACT_APP_TESTING_MODE="true"
REACT_APP_DISABLE_ANALYTICS="true"
REACT_APP_DISABLE_ADSENSE="true"
```

## 4) Run Locally

Use two terminals:

```bash
# Terminal 1
cd backend
npm run dev:local

# Terminal 2
cd frontend
npm start
```

## 5) Quick Health Checks

- Backend: `http://localhost:8080/health`
- Backend API: `http://localhost:8080/api/health`
- Frontend: `http://localhost:3000`

## 6) Optional Smoke Tests

### Guest User

- Open home/news/fixtures pages
- Confirm cookie banner behavior
- Confirm watchlist route prompts sign-in

### Free User

- Register account from Sign Up modal
- Skip onboarding (or complete it)
- Sign out and sign in again

## 7) Known Local Notes

- Cron jobs are disabled unless `ENABLE_CRON='true'`.
- Stripe local warnings are expected if `STRIPE_SECRET_KEY` is not set.
- Frontend uses a legacy CRA stack; startup deprecation logs are suppressed via `NODE_OPTIONS=--no-deprecation` in the local `start` script.
