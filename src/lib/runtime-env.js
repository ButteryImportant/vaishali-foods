/**
 * Read Cloudflare runtime env (secrets, bindings, variables) in any context.
 *
 * Order of attempts:
 *  1. context.locals.runtime.env (older @astrojs/cloudflare adapter).
 *     NOTE: on adapter v13+ / Astro v6+ this getter THROWS by design.
 *  2. `cloudflare:workers` env (the supported API on the new adapter).
 *  3. Empty object (local dev without bindings) - callers must handle this.
 *
 * Always async because the workers-module import is dynamic: a static
 * `import ... from 'cloudflare:workers'` would crash `astro dev`/build
 * under plain Node where that specifier does not exist.
 */
export async function getRuntimeEnv(context) {
  try {
    const legacy = context?.locals?.runtime?.env;
    if (legacy && typeof legacy === 'object') return legacy;
  } catch {
    // Getter throws on the new adapter - fall through.
  }

  try {
    const workers = await import('cloudflare:workers');
    if (workers && workers.env && typeof workers.env === 'object') {
      return workers.env;
    }
  } catch {
    // Not running on workerd (plain Node) - fall through.
  }

  return {};
}
