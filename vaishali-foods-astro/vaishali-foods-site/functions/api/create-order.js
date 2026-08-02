// Route: functions/api/create-order.js -> POST /api/create-order
import { validateCart, calculateSubtotal } from '../lib/catalog.js';
import { json, methodGuard } from '../lib/http.js';

async function handleCreateOrder(context) {
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
  // NOTE: shipping is still hard-coded to 0 here, unchanged from before.
  // Now that shipping-rate returns multiple courier options with different
  // prices, this endpoint will need to receive the *selected* courier's
  // amount from the frontend (and re-verify it) before it can charge the
  // real total. Flagging this since it's now visibly inconsistent with the
  // new multi-courier flow, but leaving the logic as-is since it's outside
  // the reported bug and I don't have the checkout page to wire it up
  // safely — happy to do that next if you share it.
  const shipping = 0;
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
      total
    });
  } catch (error) {
    console.error('Create-order exception:', error);
    return json({ error: 'Unable to connect to the payment service.' }, 500);
  }
}

export const onRequest = methodGuard(['POST'], handleCreateOrder);
