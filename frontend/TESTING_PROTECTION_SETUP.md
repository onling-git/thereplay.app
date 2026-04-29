# Testing Phase Protection Setup

This guide outlines the complete setup to protect your site during testing while preventing search engine crawling and unauthorized access.

## 🔐 Protection Features Implemented

### 1. Password Protection (HTTP Basic Auth)
- **Location**: `functions/_middleware.js`
- **Default Credentials**: 
  - Username: `admin`
  - Password: `testing123`
- **Coverage**: Protects all routes except `/health` and `/robots.txt`

### 2. Search Engine Protection
- **robots.txt**: Blocks all crawlers completely
- **Meta Tags**: Multiple layers of no-index directives
- **HTTP Headers**: `X-Robots-Tag` header added to all responses
- **Cache Prevention**: No-cache headers to prevent content caching

### 3. Visual Testing Indicators
- **Testing Banner**: Orange banner at top indicating testing environment
- **Environment Variables**: Conditional feature disabling

## 🚀 Deployment Setup

### For Cloudflare Pages:

1. **Set Environment Variables** in Cloudflare Dashboard:
   ```
   BASIC_AUTH_USERNAME = admin
   BASIC_AUTH_PASSWORD = your-secure-password
   TESTING_MODE = true
   ```

2. **Deploy with Wrangler**:
   ```bash
   cd frontend
   npm run build
   npx wrangler pages deploy build --project-name thereplay
   ```

3. **Set Password via Wrangler** (alternative):
   ```bash
   npx wrangler pages secret put BASIC_AUTH_PASSWORD --project-name thereplay
   ```

### For Local Testing:

1. **Create `.env.local`** (copy from `.env.testing`):
   ```bash
   cp .env.testing .env.local
   ```

2. **Start Development Server**:
   ```bash
   npm start
   ```

## 🛡️ Security Layers

### Layer 1: HTTP Basic Authentication
- Requires username/password before accessing any content
- Implemented at the edge (Cloudflare Functions)
- Cannot be bypassed by web crawlers

### Layer 2: robots.txt
- Explicitly blocks all user agents
- Includes `Noindex` directive
- Located at `/robots.txt`

### Layer 3: HTML Meta Tags
- `robots` meta with comprehensive no-index directives
- `googlebot` specific meta tag
- Applied to all pages

### Layer 4: HTTP Response Headers
- `X-Robots-Tag` header on all responses
- Cache-control headers prevent content caching
- Applied by the middleware

### Layer 5: Runtime Protection
- JavaScript adds additional meta tags
- Visual testing banner
- Conditional feature disabling

## 🎯 Testing Checklist

### Before Going Live:
- [ ] Verify password protection works
- [ ] Test that robots.txt returns blocking directives
- [ ] Check testing banner appears
- [ ] Confirm no-index meta tags present
- [ ] Validate X-Robots-Tag headers
- [ ] Test with different browsers
- [ ] Verify AdSense/Analytics are disabled

### Verification Commands:
```bash
# Test password protection
curl -I https://your-site.pages.dev
# Should return 401 Unauthorized

# Test with credentials
curl -u admin:testing123 -I https://your-site.pages.dev
# Should return 200 OK with X-Robots-Tag header

# Check robots.txt
curl https://your-site.pages.dev/robots.txt
# Should show "Disallow: /" for all user agents
```

## 🔄 Going Live Checklist

When ready to make the site public:

1. **Update Environment Variables**:
   - Remove or set `TESTING_MODE=false`
   - Remove `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD`

2. **Update robots.txt**:
   - Change to allow search engines
   - Add sitemap reference

3. **Update HTML meta tags**:
   - Remove no-index directives
   - Add proper SEO meta tags

4. **Remove Testing Components**:
   - Testing banner will auto-hide when `TESTING_MODE=false`
   - Re-enable analytics and AdSense

## 📋 Environment Variables Reference

### Testing Phase:
```
BASIC_AUTH_USERNAME=admin
BASIC_AUTH_PASSWORD=your-secure-password
TESTING_MODE=true
REACT_APP_TESTING_MODE=true
REACT_APP_DISABLE_ANALYTICS=true
REACT_APP_DISABLE_ADSENSE=true
```

### Production Phase:
```
TESTING_MODE=false
REACT_APP_TESTING_MODE=false
REACT_APP_DISABLE_ANALYTICS=false
REACT_APP_DISABLE_ADSENSE=false
# Remove BASIC_AUTH_* variables
```

## 🆘 Troubleshooting

### Password Not Working:
- Check environment variables are set correctly
- Verify `_middleware.js` is in the `functions` folder
- Check Cloudflare Pages Functions are enabled

### Still Being Crawled:
- Verify robots.txt is accessible and blocking
- Check meta tags are present in HTML source
- Confirm X-Robots-Tag headers are being sent

### Testing Banner Not Showing:
- Check `REACT_APP_TESTING_MODE=true` in environment
- Verify the component import in App.js
- Check browser console for errors

## 📞 Support

If you encounter issues:
1. Check browser developer tools (Network tab)
2. Verify environment variables in Cloudflare dashboard
3. Test with curl commands to isolate issues
4. Check Cloudflare Pages Functions logs