import { products as defaultProducts } from '../../../data/products.js';
import { getEnv, isAuthorized, unauthorized, json } from '../../../lib/admin-auth.js';

/**
 * Overwrite the KV catalog with the defaults shipped in code.
 * Used when KV holds a stale catalog ( KV always wins over code, so a
 * stale save keeps showing old prices even after a redeploy ).
 */
export const POST = async (context) => {
  const { request } = context;
  const env = await getEnv(context);

  if (!isAuthorized(request, env)) return unauthorized();

  if (!env.VAISHALI_DB) {
    return json({ error: 'VAISHALI_DB KV namespace is not bound.' }, 500);
  }

  try {
    await env.VAISHALI_DB.put('products', JSON.stringify(defaultProducts));
    return json({ success: true, count: defaultProducts.length });
  } catch (err) {
    return json({ error: 'Unable to reset catalog.' }, 500);
  }
};
