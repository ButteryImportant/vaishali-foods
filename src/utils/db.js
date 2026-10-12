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
    heroTitle: 'Laddoos like <em>home</em> used to make.',
    heroSubtitle: 'Slow-made sweets with dates, dry fruits and seeds. No added sugar, no preservatives, prepared fresh in Nanded after you order.',
    contactEmail: 'vaishalisfoodcorner@gmail.com',
    whatsappNumber: '919730487916',
    phoneDisplay: '+91 9730487916',
    instagramHandle: 'vaishali.foods',
    founderName: 'Vaishali Biradar',
    founderPhoto: '',
    founderBio: 'Vaishali Biradar is a master at cooking, preparing laddoos, traditional foods and sweets since 2015. Every recipe at Vaishali Foods is hers, perfected over a decade in her own kitchen and made fresh for every order.'
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


