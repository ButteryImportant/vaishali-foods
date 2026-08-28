// FIX: this file used to import getShippingRates/selectCheapestCourier from
// './shiprocket.js' and re-implement calculateShippingProfile/getShippingQuote
// locally — a third, drifting copy of the shipping logic. It now imports the
// real module and exercises both the new multi-courier API and the
// backward-compatible single-courier wrapper, with fetch mocked so it runs
// without hitting Shiprocket.
import {
  calculateShippingProfile,
  getShippingQuoteOptions,
  getShippingQuote,
  listAvailableCouriers
} from './shipping.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

const sampleCart = [
  { id: 'khajoor-laddoo', name: 'Khajoor Laddoo', weight: '250g', weightGrams: 250, price: 299, qty: 2 }
];

const sampleEnv = {
  SHIPROCKET_EMAIL: 'test@example.com',
  SHIPROCKET_PASSWORD: 'secret',
  SHIPROCKET_PICKUP_PIN: '400001',
  SHIPROCKET_VOLUMETRIC_DIVISOR: '5000'
};

const mockAuthResponse = { token: 'mock-token' };
const mockServiceabilityResponse = {
  data: {
    available_courier_companies: [
      { courier_company_id: 1, courier_name: 'Fast Courier', rate: 120, estimated_delivery_days: '3', etd: '3 days' },
      { courier_company_id: 2, courier_name: 'Budget Courier', rate: 80, estimated_delivery_days: '5', etd: '5 days' },
      { courier_company_id: 3, courier_name: 'Broken Row', rate: 0 } // should be filtered out
    ]
  }
};

function installMockFetch() {
  const original = global.fetch;
  global.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/auth/login')) {
      return new Response(JSON.stringify(mockAuthResponse), { status: 200 });
    }
    if (href.includes('/courier/serviceability')) {
      return new Response(JSON.stringify(mockServiceabilityResponse), { status: 200 });
    }
    throw new Error(`Unexpected fetch in test: ${href}`);
  };
  return () => {
    global.fetch = original;
  };
}

async function run() {
  // calculateShippingProfile: basic shape + chargeable weight logic
  const profile = calculateShippingProfile(sampleCart, sampleEnv);
  assert(profile.actualWeightGrams === 500, 'actual weight should sum cart weights');
  assert(profile.chargeableWeightGrams >= profile.actualWeightGrams, 'chargeable weight is never below actual weight');

  const restoreFetch = installMockFetch();
  try {
    // New behavior: multiple courier options, cheapest cost filtered/sorted correctly
    const quote = await getShippingQuoteOptions({
      env: sampleEnv,
      validatedCart: sampleCart,
      deliveryPincode: '110001',
      orderValue: 598,
      paymentMethod: 'prepaid'
    });

    assert(Array.isArray(quote.options), 'getShippingQuoteOptions should return an options array');
    assert(quote.options.length === 2, 'zero-rate couriers should be filtered out');
    assert(quote.options[0].providerAmount <= quote.options[1].providerAmount, 'options should be sorted cheapest first');

    // Backward-compatible wrapper still works for old callers
    const legacyQuote = await getShippingQuote({
      env: sampleEnv,
      validatedCart: sampleCart,
      deliveryPincode: '110001',
      orderValue: 598,
      paymentMethod: 'prepaid'
    });

    assert(typeof legacyQuote.amount === 'number', 'getShippingQuote should still return a single amount');
    assert(legacyQuote.courier?.name === 'Budget Courier', 'getShippingQuote should pick the cheapest courier');
    assert(Array.isArray(legacyQuote.options), 'getShippingQuote should also expose the full options list');

    console.log('shipping.js smoke tests passed.');
  } finally {
    restoreFetch();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
