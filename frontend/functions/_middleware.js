// Basic authentication middleware for Cloudflare Pages
// This middleware will run on ALL requests

export async function onRequest(context) {
  try {
    const { request, env, next } = context;
    
    // Get the URL
    const url = new URL(request.url);
    
    // Skip auth for specific paths
    const skipPaths = ['/health', '/robots.txt', '/favicon.ico'];
    if (skipPaths.includes(url.pathname)) {
      return next();
    }

    // Force authentication on all other paths
    console.log('🔒 Password protection middleware triggered for:', url.pathname);
    
    // Get credentials from environment (fallback to defaults)
    const BASIC_AUTH_USERNAME = env.BASIC_AUTH_USERNAME || 'admin';
    const BASIC_AUTH_PASSWORD = env.BASIC_AUTH_PASSWORD || 'testing123';
    
    console.log('👤 Username configured:', BASIC_AUTH_USERNAME);
    
    // Check for Authorization header
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      console.log('❌ No valid auth header found');
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
    
    console.log('🔍 Auth attempt for username:', username);
    
    if (username !== BASIC_AUTH_USERNAME || password !== BASIC_AUTH_PASSWORD) {
      console.log('❌ Invalid credentials provided');
      return new Response('Invalid credentials', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Secure Site"',
          'Content-Type': 'text/plain',
        },
      });
    }

    console.log('✅ Authentication successful');
    
    // Authentication successful - proceed to next middleware/page
    const response = await next();
    
    // Add security headers to prevent indexing and caching
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    // Add anti-crawling headers
    newResponse.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    newResponse.headers.set('Pragma', 'no-cache');
    newResponse.headers.set('Expires', '0');

    return newResponse;
    
  } catch (error) {
    console.error('🚨 Middleware error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}