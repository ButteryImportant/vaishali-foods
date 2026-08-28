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

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const deliveryPincode = String(body.pincode || '').trim();
  if (!/^[1-9][0-9]{5}$/.test(deliveryPincode)) {
    return json({ error: 'Enter a valid 6-digit PIN code.' }, 400);
  }

  let validatedCart;
  try {
    validatedCart = validateCart(body.cart);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  try {
    const quote = await getShippingQuote({
      env,
      validatedCart,
      deliveryPincode,
      orderValue: calculateSubtotal(validatedCart),
      paymentMethod: body.paymentMethod === 'cod' ? 'cod' : 'prepaid'
    });

    return json({
      success: true,
      shipping: quote.amount,
      carrier: quote.carrier,
      estimateSource: quote.estimateSource,
      actualWeightGrams: quote.actualWeightGrams,
      volumetricWeightGrams: quote.volumetricWeightGrams,
      chargeableWeightGrams: quote.chargeableWeightGrams,
      dimensions: quote.dimensions,
      courier: quote.courier
    });
  } catch (error) {
    console.error('Shipping-rate error:', error);
    return json(
      { error: error.message || 'Unable to calculate delivery charges.' },
      400
    );
  }
}
