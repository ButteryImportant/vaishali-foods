const DEFAULT_SETTINGS = {
  siteName: 'Vaishali Foods',
  siteDescription: 'Pure Tradition, Fresh Taste',
  heroTitle: 'Authentic Indian Sweets',
  heroSubtitle: 'Handcrafted with love, delivered to your door.'
};

export const GET = async (context) => {
  let env = {};
  try { env = context.locals.runtime.env; } catch (e) {}

  try {
    let settings = DEFAULT_SETTINGS;
    if (env.VAISHALI_DB) {
      const stored = await env.VAISHALI_DB.get('settings', 'json');
      if (stored) settings = { ...DEFAULT_SETTINGS, ...stored };
    }
    return new Response(JSON.stringify(settings), {
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
  
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== 'Bearer vaishali-admin-token-xyz') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const settingsData = await request.json();
    if (env.VAISHALI_DB) {
      await env.VAISHALI_DB.put('settings', JSON.stringify(settingsData));
      return new Response(JSON.stringify({ success: true }));
    } else {
      return new Response(JSON.stringify({ error: 'VAISHALI_DB not bound.' }), { status: 500 });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

