import assert from 'node:assert/strict';
import { getShippingQuote } from '../functions/lib/shipping.js';

const originalFetch = globalThis.fetch;

globalThis.fetch = async (url, options = {}) => {
  const target = String(url);

  if (target.includes('/auth/login')) {
    return new Response(JSON.stringify({ message: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (target.includes('/serviceability')) {
    return new Response(JSON.stringify({ data: { available_courier_companies: [] } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (target.includes('delhivery')) {
    return new Response(JSON.stringify({ total_amount: 120 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({}), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
};

try {
  const quote = await getShippingQuote({
    env: {
      SHIPROCKET_EMAIL: 'bad@example.com',
      SHIPROCKET_PASSWORD: 'bad',
      SHIPROCKET_PICKUP_PIN: '110001',
      SHIPROCKET_VOLUMETRIC_DIVISOR: 5000,
      DELHIVERY_API_TOKEN: 'token',
      DELHIVERY_RATE_API_URL: 'https://example.com/delhivery',
      PICKUP_PINCODE: '110001'
    },
    validatedCart: [{ name: 'Test', weightGrams: 1200, qty: 1 }],
    deliveryPincode: '110001',
    orderValue: 500,
    paymentMethod: 'prepaid'
  });

  assert.equal(quote.amount, 120);
  assert.equal(quote.courier.name, 'Delhivery');
  console.log('Fallback quote amount:', quote.amount);
} finally {
  globalThis.fetch = originalFetch;
}
