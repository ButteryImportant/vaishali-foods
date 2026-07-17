import { validateCart, calculateSubtotal } from '../lib/catalog.js';
import { getShippingQuote } from '../lib/shipping.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

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
    validatedCart = validateCart(body.cart);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  const subtotal = calculateSubtotal(validatedCart);
  let shippingQuote;

  try {
    shippingQuote = await getShippingQuote({
      env,
      validatedCart,
      deliveryPincode: pincode,
      orderValue: subtotal,
      paymentMethod: 'prepaid'
    });
  } catch (error) {
    return json({ error: error.message || 'Unable to calculate shipping.' }, 400);
  }

  const shipping = shippingQuote.amount;
  const total = subtotal + shipping;
  const amount = Math.round(total * 100);
  const receipt = `vf_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const credentials = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);

  try {
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
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
          carrier: shippingQuote.carrier,
          actual_weight_g: String(shippingQuote.actualWeightGrams),
          chargeable_weight_g: String(shippingQuote.chargeableWeightGrams)
        }
      })
    });
    const razorpayData = await razorpayResponse.json().catch(() => ({}));

    if (!razorpayResponse.ok) {
      console.error('Razorpay order error:', razorpayData);
      return json(
        {
          error:
            razorpayResponse.status === 401
              ? 'Razorpay authentication failed.'
              : 'Unable to create the payment order.'
        },
        razorpayResponse.status === 401 ? 401 : 500
      );
    }

    return json({
      order_id: razorpayData.id,
      amount: razorpayData.amount,
      currency: razorpayData.currency,
      key_id: env.RAZORPAY_KEY_ID,
      subtotal,
      shipping,
      total,
      shippingQuote
    });
  } catch (error) {
    console.error('Create-order exception:', error);
    return json({ error: 'Unable to connect to the payment service.' }, 500);
  }
}
