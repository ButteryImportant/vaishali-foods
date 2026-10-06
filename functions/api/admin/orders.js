export async function onRequestGet(context) {
  const { request, env } = context;
  
  // Basic token check
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== 'Bearer vaishali-admin-token-xyz') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    let orders = [];
    if (env.VAISHALI_DB) {
      const stored = await env.VAISHALI_DB.get('orders', 'json');
      if (stored) orders = stored;
    }
    
    return new Response(JSON.stringify(orders), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
