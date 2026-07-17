import {
  getShippingRates,
  selectCheapestCourier
} from '../lib/shiprocket.js';

const PACKED_WEIGHTS = {
  'ragi-laddoo': {
    '400 g': 0.5,
    '1 kg': 1.2
  },
  'besan-laddoo': {
    '400 g': 0.5,
    '1 kg': 1.2
  },
  'khajoor-laddoo': {
    '400 g': 0.5,
    '1 kg': 1.2
  },
  'poha-chiwda': {
    '500 g': 0.6,
    '1 kg': 1.2
  },
  'sweet-shankarpale': {
    '400 g': 0.5,
    '1 kg': 1.2
  },
  'khare-shankarpale': {
    '500 g': 0.6,
    '1 kg': 1.2
  },
  'laddoo-combo': {
    '9 pieces': 0.7
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

function calculatePackedWeight(cart) {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error('Your cart is empty.');
  }

  const totalWeight = cart.reduce((total, item) => {
    const weight =
      PACKED_WEIGHTS[item.id]?.[item.weight];

    const quantity = Number(item.qty);

    if (
      !Number.isFinite(weight) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    ) {
      throw new Error(
        'The cart contains an invalid product.'
      );
    }

    return total + weight * quantity;
  }, 0);

  // Round upward to the next 100 g.
  return Math.ceil(totalWeight * 10) / 10;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (
    !env.SHIPROCKET_EMAIL ||
    !env.SHIPROCKET_PASSWORD ||
    !env.SHIPROCKET_PICKUP_PIN
  ) {
    return json(
      {
        error:
          'Shiprocket has not been configured on the server.'
      },
      500
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const deliveryPincode =
    String(body.pincode || '').trim();

  if (!/^[1-9][0-9]{5}$/.test(deliveryPincode)) {
    return json(
      { error: 'Enter a valid 6-digit PIN code.' },
      400
    );
  }

  let packedWeight;

  try {
    packedWeight = calculatePackedWeight(body.cart);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  try {
    const couriers = await getShippingRates({
      env,
      deliveryPincode,
      weight: packedWeight,
      cod: false
    });

    const cheapest =
      selectCheapestCourier(couriers);

    const shipping = Math.ceil(Number(cheapest.rate));

    return json({
      success: true,
      shipping,
      packedWeight,
      courier: {
        id: cheapest.courier_company_id,
        name: cheapest.courier_name,
        estimatedDeliveryDays:
          cheapest.estimated_delivery_days || null,
        etd: cheapest.etd || null
      }
    });
  } catch (error) {
    console.error('Shipping-rate error:', error);

    return json(
      {
        error:
          error.message ||
          'Unable to calculate delivery charges.'
      },
      400
    );
  }
}