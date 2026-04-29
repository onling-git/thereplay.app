# Cloudflare Pages Deployment Troubleshooting

## Problem: GitHub Auto-Deploy Not Working

### Symptoms
- Code is pushed to GitHub successfully
- Cloudflare Pages shows in dashboard but doesn't update with latest changes
- Site shows old version even after GitHub push
- No new deployment triggered in Cloudflare Pages dashboard

### Root Cause
Cloudflare Pages GitHub integration sometimes fails to detect new commits or doesn't automatically trigger a new build.

---

## Solution: Manual Deployment with Wrangler CLI

### Option 1: Using NPM Script (Recommended)

```bash
cd frontend
npm run deploy:cloudflare
```

This will:
1. Build the React app (`npm run build`)
2. Deploy to Cloudflare Pages using Wrangler

### Option 2: Manual Commands

```bash
cd frontend
npm run build
npx wrangler pages deploy build --project-name thereplay
```

### Option 3: Using the Deploy Script

```bash
cd frontend
node deploy-testing.js
```

---

## Prerequisites

### 1. Wrangler CLI
Wrangler is installed as a dev dependency and will be used via `npx`.

To install globally (optional):
```bash
npm install -g wrangler
```

### 2. Cloudflare Authentication

First-time setup requires authentication:

```bash
npx wrangler login
```

This will:
- Open a browser window
- Ask you to authorize Wrangler
- Save credentials locally

### 3. Project Name
Ensure the project name in commands matches your Cloudflare Pages project:
- Current project: `thereplay`
- Check in Cloudflare Dashboard > Pages

---

## Step-by-Step Deployment

### 1. Navigate to Frontend Directory
```bash
cd frontend
```

### 2. Build the Production Bundle
```bash
npm run build
```

**Expected output:**
- Creates `build/` directory
- Optimized production files
- Build should complete without errors

### 3. Deploy with Wrangler
```bash
npx wrangler pages deploy build --project-name thereplay
```

**Expected output:**
```
✨ Success! Uploaded X files (Y.yy sec)

✨ Deployment complete! Take a peek over at https://xxxxx.thereplay.pages.dev
```

### 4. Verify Deployment
- Visit the deployment URL shown in output
- Check Cloudflare Pages dashboard for new deployment
- Test the site to confirm changes are live

---

## Common Issues

### Issue 1: "Not authenticated"
**Error:** `Authentication error` or `No access token found`

**Solution:**
```bash
npx wrangler login
```

### Issue 2: "Project not found"
**Error:** `Project "thereplay" not found`

**Solutions:**
1. Check project name in Cloudflare Dashboard
2. Update command with correct name:
   ```bash
   npx wrangler pages deploy build --project-name YOUR-ACTUAL-PROJECT-NAME
   ```

### Issue 3: "Build directory not found"
**Error:** `build not found` or `No files to upload`

**Solution:**
```bash
# Make sure you build first
npm run build
# Then deploy
npx wrangler pages deploy build --project-name thereplay
```

### Issue 4: Environment variables not set
**Problem:** Site works but environment variables are undefined

**Solution:**
Set in Cloudflare Dashboard:
1. Go to Pages > Your Project > Settings > Environment Variables
2. Add required variables:
   - `BASIC_AUTH_USERNAME`
   - `BASIC_AUTH_PASSWORD`
   - `TESTING_MODE`
   - Any other environment variables from `.env`

### Issue 5: Old version still showing
**Cause:** Browser cache or Cloudflare CDN cache

**Solutions:**
1. Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Open in incognito/private window
3. Clear browser cache
4. Wait 5-10 minutes for CDN cache to expire
5. Purge Cloudflare cache (Dashboard > Caching > Purge Everything)

---

## Alternative: Retry in Cloudflare Dashboard

If you prefer not to use Wrangler:

1. Go to Cloudflare Dashboard
2. Select your Pages project
3. Go to "Deployments" tab
4. Find the failed or stale deployment
5. Click "Retry deployment" or "View details" > "Retry"

**Note:** This only works if there was a deployment attempt. If GitHub integration completely failed to trigger, use Wrangler instead.

---

## Prevention: Check GitHub Integration

### Verify Integration Status

1. **Cloudflare Dashboard:**
   - Pages > Settings > Builds & deployments
   - Check "Source repository" is connected
   - Verify branch is correct (usually `main`)

2. **GitHub Repository:**
   - Settings > Integrations > Cloudflare Pages
   - Ensure integration is active
   - Check webhook deliveries

### Re-enable Auto-Deploy

If auto-deploy is broken:

1. **Disconnect and Reconnect:**
   - Cloudflare Dashboard > Your Project > Settings
   - Disconnect source repository
   - Reconnect and reauthorize

2. **Check Build Configuration:**
   - Build command: `npm run build`
   - Build output directory: `build`
   - Root directory: `frontend` (if applicable)

---

## Quick Reference Commands

```bash
# Full deployment process
cd frontend
npm run build
npx wrangler pages deploy build --project-name thereplay

# Or use the npm script
cd frontend
npm run deploy:cloudflare

# Login to Wrangler (first time)
npx wrangler login

# Check Wrangler version
npx wrangler --version

# List your Cloudflare Pages projects
npx wrangler pages project list
```

---

## When to Use Manual Deployment

### Always Use For:
- ✅ GitHub auto-deploy is broken
- ✅ Need immediate deployment (faster than waiting for GitHub hook)
- ✅ Testing deployment without committing to Git
- ✅ Deploying from a local branch

### GitHub Auto-Deploy Preferred For:
- ⚙️ Regular development workflow
- ⚙️ Automatic deployments on push
- ⚙️ Preview deployments for PRs
- ⚙️ Team collaboration

---

## Help & Resources

- **Cloudflare Wrangler Docs:** https://developers.cloudflare.com/workers/wrangler/
- **Cloudflare Pages Docs:** https://developers.cloudflare.com/pages/
- **Project-specific setup:** See `frontend/TESTING_PROTECTION_SETUP.md`

---

## Contact

If issues persist:
1. Check Cloudflare status page: https://www.cloudflarestatus.com/
2. Review Cloudflare Pages deployment logs in dashboard
3. Contact Cloudflare support if platform issue suspected

---

*Last Updated: April 7, 2026*
