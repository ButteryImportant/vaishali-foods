import { products as defaultProducts } from '../../../../src/data/products.js';

export const GET = async (context) => {
  let env = {};
  try { env = context.locals.runtime.env; } catch (e) {}
  try {
    let products = defaultProducts;
    if (env.VAISHALI_DB) {
      const stored = await env.VAISHALI_DB.get('products', 'json');
      if (stored) products = stored;
    }
    return new Response(JSON.stringify(products), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export const POST = async (context) => {
  const { request } = context;
  let env = {};
  try { env = context.locals.runtime.env; } catch (e) {}
  
  // Basic token check
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== 'Bearer vaishali-admin-token-xyz') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const productsData = await request.json();
    if (env.VAISHALI_DB) {
      await env.VAISHALI_DB.put('products', JSON.stringify(productsData));
      return new Response(JSON.stringify({ success: true }));
    } else {
      return new Response(JSON.stringify({ error: 'VAISHALI_DB KV namespace not bound. Please bind it in Cloudflare Dashboard.' }), { status: 500 });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
