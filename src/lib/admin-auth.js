/**
 * Shared admin authentication helper for Cloudflare Pages.
 * Credentials are read from environment variables with safe fallbacks
 * for the existing store (username/password default to "vaishali").
 *
 * Set these in Cloudflare Dashboard -> Settings -> Variables and Secrets:
 * - ADMIN_USERNAME (default: vaishali)
 * - ADMIN_PASSWORD (default: vaishali - change this!)
 * - ADMIN_TOKEN   (default: vaishali-admin-token-xyz - change this!)
 */

export function getAdminConfig(env = {}) {
  return {
    username: env.ADMIN_USERNAME || 'vaishali',
    password: env.ADMIN_PASSWORD || 'vaishali',
    token: env.ADMIN_TOKEN || 'vaishali-admin-token-xyz',
  };
}

export function getEnv(context) {
  try {
    return context?.locals?.runtime?.env || {};
  } catch {
    return {};
  }
}

export function isAuthorized(request, env) {
  const { token } = getAdminConfig(env);
  const header = request.headers.get('Authorization') || '';
  return header === `Bearer ${token}`;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
