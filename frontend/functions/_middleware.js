// Basic authentication middleware for Cloudflare Pages
// This middleware will run on ALL requests
import { renderLiveMatchHtml } from '../server/liveMatchHtml.mjs';
import { legacyTeamNewsPath } from '../src/utils/teamNewsUrl.mjs';
import { renderNewsHtml } from '../server/newsHtml.mjs';
import { serveSitemap } from '../server/sitemapProxy.mjs';

export async function onRequest(context) {
  try {
    const { request, env, next } = context;
    const requestUrl = new URL(request.url);
    const newsRedirect = legacyTeamNewsPath(requestUrl.pathname, requestUrl.search);
    if (newsRedirect && ['GET', 'HEAD'].includes(request.method)) {
      return Response.redirect(new URL(newsRedirect, requestUrl).href, 301);
    }
    
    // TEMPORARY: Site-wide authentication disabled for AdSense testing
    // TODO: Remove this early return to re-enable the basic auth gate
    return serveSitemap({ ...context, next: () =>
      renderNewsHtml({ ...context, next: () => renderLiveMatchHtml(context) }) });
    
    /* COMMENTED OUT FOR ADSENSE TESTING
    // Get the URL
    const url = new URL(request.url);
    
    // Skip auth for specific paths
    const skipPaths = ['/health', '/robots.txt', '/favicon.ico'];
    if (skipPaths.includes(url.pathname)) {
      return next();
    }

    // Force authentication on all other paths
    
    // Get credentials from environment (fallback to defaults)
    const BASIC_AUTH_USERNAME = env.BASIC_AUTH_USERNAME || 'admin';
    const BASIC_AUTH_PASSWORD = env.BASIC_AUTH_PASSWORD || 'testing123';
    
    
    // Check for Authorization header
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return new Response('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Secure Site"',
          'Content-Type': 'text/plain',
        },
      });
    }

    // Decode and verify credentials
    const credentials = atob(authHeader.substring(6));
    const [username, password] = credentials.split(':');
    
    
    if (username !== BASIC_AUTH_USERNAME || password !== BASIC_AUTH_PASSWORD) {
      return new Response('Invalid credentials', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Secure Site"',
          'Content-Type': 'text/plain',
        },
      });
    }

    
    // Determine if this looks like a SPA route (no file extension, not a known static path)
    const isLikelySPARoute = !url.pathname.includes('.') && 
                             !url.pathname.startsWith('/static/') &&
                             url.pathname !== '/' &&
                             url.pathname !== '/favicon.ico' &&
                             url.pathname !== '/robots.txt' &&
                             url.pathname !== '/manifest.json';
    
    if (isLikelySPARoute) {
      // Serve index.html directly for SPA routes
      
      const indexUrl = new URL('/index.html', url.origin);
      const indexRequest = new Request(indexUrl, {
        method: 'GET',
        headers: request.headers
      });
      const indexResponse = await env.ASSETS.fetch(indexRequest);
      
      const newResponse = new Response(indexResponse.body, {
        status: 200,
        headers: indexResponse.headers,
      });
      
      newResponse.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
      newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      newResponse.headers.set('Pragma', 'no-cache');
      newResponse.headers.set('Expires', '0');
      
      return newResponse;
    }
    
    // For everything else (root, static files), pass through normally
    const response = await env.ASSETS.fetch(request);
    
    // Add security headers to all responses
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    
    newResponse.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    newResponse.headers.set('Pragma', 'no-cache');
    newResponse.headers.set('Expires', '0');
    
    return newResponse;
    END OF COMMENTED OUT SECTION */
    
  } catch (error) {
    console.error('🚨 Middleware error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}