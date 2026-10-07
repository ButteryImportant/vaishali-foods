import { products as staticProducts } from '../data/products.js';
import { getRuntimeEnv } from '../lib/runtime-env.js';

export async function getProducts(AstroContext) {
  let p = staticProducts;
  try {
    let env = await getRuntimeEnv(AstroContext);
    if (env && env.VAISHALI_DB) {
      const stored = await env.VAISHALI_DB.get('products', 'json');
      if (stored && Array.isArray(stored)) {
        p = stored;
      }
    }
  } catch (e) {
    console.error('Error fetching dynamic products:', e);
  }
  return p;
}

export async function getSettings(AstroContext) {
  let settings = {
    siteName: 'Vaishali Foods',
    siteDescription: 'Pure Tradition, Fresh Taste',
    heroTitle: 'Tradition you can <em>taste.</em>',
    heroSubtitle: 'Freshly prepared laddoos and snacks made on demand with carefully selected ingredients\u2014packed with warmth and delivered to your doorstep.',
    contactEmail: 'vaishalisfoodcorner@gmail.com',
    whatsappNumber: '919730487916',
    phoneDisplay: '+91 9730487916',
    instagramHandle: 'vaishali.foods'
  };
  try {
    let env = {};
    env = await getRuntimeEnv(AstroContext);
    if (env && env.VAISHALI_DB) {
      const stored = await env.VAISHALI_DB.get('settings', 'json');
      if (stored) {
        settings = { ...settings, ...stored };
      }
    }
  } catch (e) {
    console.error('Error fetching dynamic settings:', e);
  }
  return settings;
}


