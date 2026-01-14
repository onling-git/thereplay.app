// Test endpoint to verify middleware is working
export async function onRequest(context) {
  return new Response(JSON.stringify({
    message: 'Middleware test endpoint working!',
    timestamp: new Date().toISOString(),
    url: context.request.url
  }), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}