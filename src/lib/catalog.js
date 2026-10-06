import { products as staticProducts } from '../../src/data/products.js';

export async function getProductCatalog(env) {
  let p = staticProducts;
  if (env && env.VAISHALI_DB) {
    const stored = await env.VAISHALI_DB.get('products', 'json');
    if (stored) p = stored;
  }
  return Object.fromEntries(
    p.map((product) => [
      product.id,
      {
        name: product.name,
        variants: Object.fromEntries(
          product.variants.map((variant) => [
            variant.weight,
            {
              variantId: variant.id,
              price: variant.price,
              weightGrams: variant.weightGrams
            }
          ])
        )
      }
    ])
  );
}

export async function validateCart(cart, env) {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error('Your cart is empty.');
  }

  const catalog = await getProductCatalog(env);

  return cart.map((item) => {
    const product = catalog[item.id];
    const variant = product?.variants?.[item.weight];
    const quantity = Number(item.qty);

    if (
      !product ||
      !variant ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    ) {
      throw new Error('The cart contains an invalid product or quantity.');
    }

    return {
      id: item.id,
      name: product.name,
      variantId: variant.variantId,
      weight: item.weight,
      weightGrams: variant.weightGrams,
      price: variant.price,
      qty: quantity
    };
  });
}

export function calculateSubtotal(validatedCart) {
  return validatedCart.reduce(
    (total, item) => total + item.price * item.qty,
    0
  );
}
