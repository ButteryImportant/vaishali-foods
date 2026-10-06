export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

/**
 * Wraps a handler so that only the given HTTP methods are accepted.
 * Any other method gets a clean JSON 405 instead of Cloudflare's default
 * (non-JSON) method-not-allowed response.
 *
 * Usage:
 *   export const onRequest = methodGuard(['POST'], handlePost);
 */
export function methodGuard(allowedMethods, handler) {
  return async (context) => {
    if (!allowedMethods.includes(context.request.method)) {
      return json(
        {
          error: `Method ${context.request.method} not allowed on this endpoint. Use ${allowedMethods.join(', ')}.`
        },
        405
      );
    }

    try {
      return await handler(context);
    } catch (error) {
      console.error('Unhandled API error:', error);
      return json({ error: 'Unexpected server error.' }, 500);
    }
  };
}
