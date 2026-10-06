import { products as staticProducts } from '../data/products.js';

export async function getProducts(AstroContext) {
  let p = staticProducts;
  try {
    const env = AstroContext.locals.runtime?.env;
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
