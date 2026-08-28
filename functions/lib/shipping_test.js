import {
  calculateShippingProfile,
  getStandardShippingRate,
  getShippingQuote
} from './shipping.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

const sampleCart500g = [
  { id: 'khajur-dry-fruit-laddoo', name: 'Khajur Dry Fruit Laddoo', weight: '400 g', weightGrams: 400, price: 560, qty: 1 }
];

const sampleCart1kg = [
  { id: 'besan-laddoo', name: 'Besan Laddoo', weight: '1 kg', weightGrams: 1000, price: 799, qty: 1 }
];

async function run() {
  // Rate tier assertions
  assert(getStandardShippingRate(100) === 80, '100g should be 80 rs');
  assert(getStandardShippingRate(400) === 80, '400g should be 80 rs');
  assert(getStandardShippingRate(500) === 80, '500g should be 80 rs');
  assert(getStandardShippingRate(501) === 140, '501g should be 140 rs');
  assert(getStandardShippingRate(1000) === 140, '1000g should be 140 rs');

  // getShippingQuote for <=500g
  const quote500 = await getShippingQuote({
    validatedCart: sampleCart500g,
    deliveryPincode: '411001',
    orderValue: 560
  });
  assert(quote500.amount === 80, 'quote for <=500g should be 80');
  assert(quote500.carrier === 'standard', 'carrier should be standard');

  // getShippingQuote for >500g
  const quote1kg = await getShippingQuote({
    validatedCart: sampleCart1kg,
    deliveryPincode: '411001',
    orderValue: 799
  });
  assert(quote1kg.amount === 140, 'quote for >500g should be 140');

  console.log('All standard shipping rate tests passed successfully.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
