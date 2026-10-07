import { getEnv, isAuthorized, unauthorized, json } from '../../../lib/admin-auth.js';

export const GET = async (context) => {
  const env = await getEnv(context);

  if (!isAuthorized(context.request, env)) return unauthorized();

  try {
    let orders = [];
    if (env.VAISHALI_DB) {
      const stored = await env.VAISHALI_DB.get('orders', 'json');
      if (Array.isArray(stored)) orders = stored;
    }

    return json(orders);
  } catch (err) {
    return json({ error: 'Unable to load orders.' }, 500);
  }
};
