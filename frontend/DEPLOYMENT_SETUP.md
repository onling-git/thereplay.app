# Cloudflare Pages Deployment Setup

## Site Protection Setup

This site uses HTTP Basic Authentication to protect it during testing/staging.

### Environment Variables Required in Cloudflare Pages

1. Go to your Cloudflare Pages dashboard
2. Select your project
3. Go to Settings > Environment Variables
4. Add these variables:

**Production Environment:**
- `BASIC_AUTH_USERNAME` = `admin` (or your preferred username)
- `BASIC_AUTH_PASSWORD` = `your-secure-password` (choose a strong password)

**Preview Environment:**
- `BASIC_AUTH_USERNAME` = `admin` 
- `BASIC_AUTH_PASSWORD` = `testing123`

### How it works:

- All visitors will see a browser login prompt
- Default credentials (if env vars not set): username `admin`, password `testing123`
- The middleware protects all routes except `/health` and `/robots.txt`
- Adds security headers to prevent indexing and caching

### Testing:

1. Visit your deployed site
2. You should see a browser authentication dialog
3. Enter the configured username and password
4. Site should load normally after authentication

### Troubleshooting:

If authentication isn't working:
1. Check that `functions/_middleware.js` is deployed (visible in Cloudflare Pages Functions tab)
2. Verify environment variables are set correctly
3. Check function logs in Cloudflare Pages dashboard for debugging output
4. Ensure you're not cached - try incognito mode

### Security Headers Added:

- `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`
- `Cache-Control: no-cache, no-store, must-revalidate`
- `Pragma: no-cache`
- `Expires: 0`

This prevents search engines from indexing the site and browsers from caching sensitive content.