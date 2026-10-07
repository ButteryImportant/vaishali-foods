import { getEnv, isAuthorized, unauthorized, json } from '../../../lib/admin-auth.js';

const DEFAULT_SETTINGS = {
  siteName: 'Vaishali Foods',
  siteDescription: 'Pure Tradition, Fresh Taste',
  heroTitle: 'Tradition you can <em>taste.</em>',
  heroSubtitle: 'Freshly prepared laddoos and snacks made on demand with carefully selected ingredients—packed with warmth and delivered to your doorstep.',
};

function sanitizeSettings(input = {}) {
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  return {
    siteName: str(input.siteName, 80) || DEFAULT_SETTINGS.siteName,
    siteDescription: str(input.siteDescription, 160) || DEFAULT_SETTINGS.siteDescription,
    heroTitle: str(input.heroTitle, 200) || DEFAULT_SETTINGS.heroTitle,
    heroSubtitle: str(input.heroSubtitle, 500) || DEFAULT_SETTINGS.heroSubtitle,
  };
}

export const GET = async (context) => {
  const env = getEnv(context);
  if (!isAuthorized(context.request, env)) return unauthorized();

  try {
    let settings = DEFAULT_SETTINGS;
    if (env.VAISHALI_DB) {
      const stored = await env.VAISHALI_DB.get('settings', 'json');
      if (stored && typeof stored === 'object') settings = { ...DEFAULT_SETTINGS, ...stored };
    }
    return json(settings);
  } catch (err) {
    return json({ error: 'Unable to load settings.' }, 500);
  }
};

export const POST = async (context) => {
  const { request } = context;
  const env = getEnv(context);

  if (!isAuthorized(request, env)) return unauthorized();

  try {
    const settingsData = sanitizeSettings(await request.json());
    if (!env.VAISHALI_DB) {
      return json({ error: 'VAISHALI_DB KV namespace is not bound. Create a KV namespace named VAISHALI_DB and bind it in Cloudflare Pages → Settings → Functions → KV namespace bindings.' }, 500);
    }
    await env.VAISHALI_DB.put('settings', JSON.stringify(settingsData));
    return json({ success: true });
  } catch (err) {
    return json({ error: err.message || 'Unable to save settings.' }, 400);
  }
};
