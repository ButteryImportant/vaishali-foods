const PRODUCT_PRICES = {
  'ragi-laddoo': {
    '400 g': 440,
    '1 kg': 990
  },
  'besan-laddoo': {
    '400 g': 380,
    '1 kg': 855
  },
  'khajoor-laddoo': {
    '400 g': 520,
    '1 kg': 1170
  },
  'poha-chiwda': {
    '500 g': 290,
    '1 kg': 520
  },
  'sweet-shankarpale': {
    '400 g': 230,
    '1 kg': 520
  },
  'khare-shankarpale': {
    '500 g': 280,
    '1 kg': 500
  },
  'laddoo-combo': {
    '9 pieces': 499
  }
};

const FREE_SHIPPING_THRESHOLD = 999;
const STANDARD_SHIPPING_FEE = 69;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

function calculateSubtotal(cart) {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error('Your cart is empty.');
  }

  return cart.reduce((total, item) => {
    const productPrices = PRODUCT_PRICES[item.id];
    const unitPrice = productPrices?.[item.weight];
    const quantity = Number(item.qty);

    if (
      !productPrices ||
      !Number.isInteger(unitPrice) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    ) {
      throw new Error(
        'The cart contains an invalid product or quantity.'
      );
    }

    return total + unitPrice * quantity;
  }, 0);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return json(
      {
        error:
          'Razorpay has not been configured on the server.'
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

  let subtotal;

  try {
    subtotal = calculateSubtotal(body.cart);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  const shipping =
    subtotal >= FREE_SHIPPING_THRESHOLD
      ? 0
      : STANDARD_SHIPPING_FEE;

  const total = subtotal + shipping;

  // Razorpay expects the amount in paise.
  const amount = Math.round(total * 100);

  if (amount < 100) {
    return json(
      { error: 'Order amount must be at least ₹1.' },
      400
    );
  }

  const receipt =
    `vf_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const credentials = btoa(
    `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`
  );

  try {
    const razorpayResponse = await fetch(
      'https://api.razorpay.com/v1/orders',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount,
          currency: 'INR',
          receipt,
          notes: {
            store: 'Vaishali Foods',
            subtotal: String(subtotal),
            shipping: String(shipping)
          }
        })
      }
    );

    const razorpayData = await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      console.error(
        'Razorpay order error:',
        razorpayData
      );

      const status =
        razorpayResponse.status === 401 ? 401 : 500;

      return json(
        {
          error:
            status === 401
              ? 'Razorpay authentication failed.'
              : 'Unable to create the payment order.'
        },
        status
      );
    }

    return json({
      order_id: razorpayData.id,
      amount: razorpayData.amount,
      currency: razorpayData.currency,
      key_id: env.RAZORPAY_KEY_ID,
      subtotal,
      shipping,
      total
    });
  } catch (error) {
    console.error(
      'Create-order exception:',
      error
    );

    return json(
      {
        error:
          'Unable to connect to the payment service.'
      },
      500
    );
  }
}