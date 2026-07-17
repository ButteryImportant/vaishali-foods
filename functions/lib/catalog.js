export const PRODUCT_CATALOG = {
  'ragi-laddoo': {
    name: 'Ragi Laddoo',
    variants: {
      '400 g': { variantId: 'ragi-400g', price: 440, weightGrams: 400 },
      '1 kg': { variantId: 'ragi-1kg', price: 990, weightGrams: 1000 }
    }
  },
  'besan-laddoo': {
    name: 'Besan Laddoo',
    variants: {
      '400 g': { variantId: 'besan-400g', price: 380, weightGrams: 400 },
      '1 kg': { variantId: 'besan-1kg', price: 855, weightGrams: 1000 }
    }
  },
  'khajoor-laddoo': {
    name: 'Khajoor Dry Fruit Laddoo',
    variants: {
      '400 g': { variantId: 'khajoor-400g', price: 520, weightGrams: 400 },
      '1 kg': { variantId: 'khajoor-1kg', price: 1170, weightGrams: 1000 }
    }
  },
  'poha-chiwda': {
    name: 'Poha Chiwda',
    variants: {
      '500 g': { variantId: 'poha-500g', price: 290, weightGrams: 500 },
      '1 kg': { variantId: 'poha-1kg', price: 520, weightGrams: 1000 }
    }
  },
  'sweet-shankarpale': {
    name: 'Sweet Shankarpale',
    variants: {
      '400 g': { variantId: 'sweet-shankarpale-400g', price: 230, weightGrams: 400 },
      '1 kg': { variantId: 'sweet-shankarpale-1kg', price: 520, weightGrams: 1000 }
    }
  },
  'khare-shankarpale': {
    name: 'Khare Shankarpale',
    variants: {
      '500 g': { variantId: 'khare-shankarpale-500g', price: 280, weightGrams: 500 },
      '1 kg': { variantId: 'khare-shankarpale-1kg', price: 500, weightGrams: 1000 }
    }
  },
  'laddoo-combo': {
    name: 'Laddoo Combo Pack',
    variants: {
      '9 pieces': { variantId: 'laddoo-combo-9pc', price: 499, weightGrams: 400 }
    }
  }
};

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
