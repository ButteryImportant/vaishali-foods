import { validateCart, calculateSubtotal } from '../../lib/catalog.js';
import { getShippingQuote } from '../../lib/shipping.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export const POST = async (context) => {
  const { request } = context;
  let env = {};
  try { env = context.locals.runtime.env; } catch (e) {}

  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return json({ error: 'Razorpay has not been configured on the server.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const pincode = String(body.pincode || '').trim();
  if (!/^[1-9][0-9]{5}$/.test(pincode)) {
    return json({ error: 'Enter a valid 6-digit PIN code.' }, 400);
  }

  let validatedCart;
  try {
    validatedCart = await validateCart(body.cart, env);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  const subtotal = calculateSubtotal(validatedCart);

  let quote;
  try {
    quote = await getShippingQuote({
      env,
      validatedCart,
      deliveryPincode: pincode,
      orderValue: subtotal,
      paymentMethod: body.paymentMethod === 'cod' ? 'cod' : 'prepaid'
    });
  } catch (error) {
    console.error('Create-order shipping error:', error);
    return json(
      { error: error.message || 'Unable to calculate delivery charges.' },
      400
    );
  }

  const shipping = quote.amount;
  const total = subtotal + shipping;
  const amount = Math.round(total * 100);
  const receipt = `vf_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const credentials = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);

  try {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
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
          shipping: String(shipping),
          carrier: quote.courier?.name || '',
          pincode
        }
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Razorpay order error:', data);
      return json({ error: 'Unable to create the payment order.' }, 500);
    }

    return json({
      order_id: data.id,
      amount: data.amount,
      currency: data.currency,
      key_id: env.RAZORPAY_KEY_ID,
      subtotal,
      shipping,
      total,
      carrier: quote.courier
    });
  } catch (error) {
    console.error('Create-order exception:', error);
    return json({ error: 'Unable to connect to the payment service.' }, 500);
  }
}
