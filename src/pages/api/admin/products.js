import { products as defaultProducts } from '../../../data/products.js';
import { getEnv, isAuthorized, unauthorized, json } from '../../../lib/admin-auth.js';

function sanitizeProducts(list) {
  if (!Array.isArray(list)) throw new Error('Products must be an array.');
  if (list.length > 200) throw new Error('Too many products.');
  return list.map((p) => {
    if (!p || typeof p.name !== 'string' || !p.name.trim()) {
      throw new Error('Each product needs a name.');
    }
    const variants = Array.isArray(p.variants) ? p.variants : [];
    if (!variants.length) throw new Error(`"${p.name}" needs at least one variant.`);
    return {
      id: String(p.id || p.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'product',
      name: p.name.trim().slice(0, 120),
      note: typeof p.note === 'string' ? p.note.slice(0, 200) : '',
      category: ['Sweets', 'Snacks', 'Combos', 'Namkeen'].includes(p.category) ? p.category : 'Sweets',
      featured: p.featured !== false,
      image: typeof p.image === 'string' ? p.image.slice(0, 2000) : '',
      variants: variants.slice(0, 10).map((v) => ({
        id: String(v.id || `${p.name}-${v.weight}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        weight: String(v.weight || '').slice(0, 30),
        weightGrams: Math.max(0, parseInt(v.weightGrams, 10) || 0),
        price: Math.max(0, Number(v.price) || 0),
      })).filter((v) => v.weight),
    };
  });
}

export const GET = async (context) => {
  const env = await getEnv(context);
  if (!isAuthorized(context.request, env)) return unauthorized();
  try {
    let products = defaultProducts;
    if (env.VAISHALI_DB) {
      const stored = await env.VAISHALI_DB.get('products', 'json');
      if (Array.isArray(stored) && stored.length) products = stored;
    }
    return json(products);
  } catch (err) {
    return json({ error: 'Unable to load products.' }, 500);
  }
};

export const POST = async (context) => {
  const { request } = context;
  const env = await getEnv(context);

  if (!isAuthorized(request, env)) return unauthorized();

  try {
    const productsData = sanitizeProducts(await request.json());
    if (!env.VAISHALI_DB) {
      return json({ error: 'VAISHALI_DB KV namespace is not bound. Create a KV namespace named VAISHALI_DB and bind it in Cloudflare Pages -> Settings -> Functions -> KV namespace bindings.' }, 500);
    }
    await env.VAISHALI_DB.put('products', JSON.stringify(productsData));
    return json({ success: true, count: productsData.length });
  } catch (err) {
    return json({ error: err.message || 'Unable to save products.' }, 400);
  }
};
