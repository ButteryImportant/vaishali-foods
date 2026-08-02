// Route: functions/api/shipping-rate.js -> POST /api/shipping-rate
//
// FIX: this used to import from '../../lib/shipping.js', which is one
// level too deep (functions/api/ -> ../ is functions/, so lib/shipping.js
// only needs a single '../', same as create-order.js's '../lib/catalog.js').
// The wrong depth is what produced the "no matching export" / 404 errors.
import { getShippingQuoteOptions } from '../lib/shipping.js';
import { validateCart, calculateSubtotal } from '../lib/catalog.js';
import { json, methodGuard } from '../lib/http.js';

const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

async function handleShippingRate(context) {
  const { request, env } = context;

  // Fail fast and clearly if the server isn't configured, rather than
  // letting the request fall through to a confusing upstream error.
  if (!env.SHIPROCKET_EMAIL || !env.SHIPROCKET_PASSWORD) {
    console.error('Shipping-rate: missing SHIPROCKET_EMAIL/SHIPROCKET_PASSWORD.');
    return json({ error: 'Shipping has not been configured on the server.' }, 500);
  }
  if (!env.SHIPROCKET_PICKUP_PIN) {
    console.error('Shipping-rate: missing SHIPROCKET_PICKUP_PIN.');
    return json({ error: 'Shipping has not been configured on the server.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const deliveryPincode = String(body.deliveryPincode || body.pincode || '').trim();
  if (!PINCODE_PATTERN.test(deliveryPincode)) {
    return json({ error: 'Enter a valid 6-digit delivery PIN code.' }, 400);
  }

  // FIX: previously the endpoint trusted `body.validatedCart` from the
  // client as-is (prices, weights, everything). Revalidate against the
  // trusted catalog, the same way create-order.js already does, so a
  // tampered request body can't influence declared value or weight.
  const rawCart = body.cart || body.validatedCart;
  let validatedCart;
  try {
    validatedCart = validateCart(rawCart);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  const orderValue = calculateSubtotal(validatedCart);
  const paymentMethod = body.paymentMethod === 'cod' ? 'cod' : 'prepaid';

  try {
    const quote = await getShippingQuoteOptions({
      env,
      validatedCart,
      deliveryPincode,
      orderValue,
      paymentMethod
    });

    return json(quote, 200);
  } catch (error) {
    // getShippingQuoteOptions() already logs the underlying Shiprocket
    // auth/serviceability failure with status + body; this is a clean,
    // safe-to-display message for the client.
    console.error('Shipping-rate handler error:', error);
    return json({ error: error.message || 'Shipping calculation failed.' }, 502);
  }
}

export const onRequest = methodGuard(['POST'], handleShippingRate);
