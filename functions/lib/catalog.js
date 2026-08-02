import { products } from '../../src/data/products.js';

function buildProductCatalog() {
  return Object.fromEntries(
    products.map((product) => [
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

export const PRODUCT_CATALOG = buildProductCatalog();

export function validateCart(cart) {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error('Your cart is empty.');
  }

  return cart.map((item) => {
    const product = PRODUCT_CATALOG[item.id];
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
