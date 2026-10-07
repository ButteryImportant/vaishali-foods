import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ORIGIN_PINCODE,
  DELHIVERY_SURFACE_RATES,
  resolveDelhiveryZone,
  getDelhiverySlabRate,
  getEstimatedShippingAmount,
  calculateShippingProfile,
  getShippingQuote
} from './shipping.js';

const ORIGIN = DEFAULT_ORIGIN_PINCODE; // 431605 Nanded
const defaultEnv = { DELHIVERY_VOLUMETRIC_DIVISOR: '5000', PICKUP_PINCODE: ORIGIN };

test('origin defaults to Nanded 431605', () => {
  assert.equal(DEFAULT_ORIGIN_PINCODE, '431605');
});

test('Zone A: Nanded city pincodes', () => {
  assert.equal(resolveDelhiveryZone(ORIGIN, '431605').zone, 'A');
  assert.equal(resolveDelhiveryZone(ORIGIN, '431601').zone, 'A');
});

test('Zone B: regional destinations within ~500 km', () => {
  for (const pin of ['411001', '500001', '440001', '585101', '450001', '431401']) {
    assert.equal(resolveDelhiveryZone(ORIGIN, pin).zone, 'B', pin);
  }
});

test('Zone D: rest of India', () => {
  for (const pin of ['400001', '110001', '560001', '600001', '700001', '302001']) {
    assert.equal(resolveDelhiveryZone(ORIGIN, pin).zone, 'D', pin);
  }
});

test('Zone C: metro to metro only when both ends are metros', () => {
  assert.equal(resolveDelhiveryZone('110001', '400001').zone, 'C');
  // Origin Nanded is not a metro, so metro destinations stay Zone D.
  assert.equal(resolveDelhiveryZone(ORIGIN, '110001').zone, 'D');
});

test('Zone E: Jammu, Himachal, North East (excl. Manipur), Sikkim', () => {
  for (const pin of ['180001', '171001', '781001', '737101', '793001', '799001']) {
    assert.equal(resolveDelhiveryZone(ORIGIN, pin).zone, 'E', pin);
  }
});

test('Zone F: Kashmir, Manipur, Ladakh, Andaman & Nicobar', () => {
  for (const pin of ['190001', '194101', '795001', '744101']) {
    assert.equal(resolveDelhiveryZone(ORIGIN, pin).zone, 'F', pin);
  }
});

test('slab math: base for first 500 g, additional per extra 500 g slab', () => {
  // Zone D: base 61.36, additional 57.82
  assert.deepEqual(getDelhiverySlabRate('D', 400), { amount: 61.36, slabs: 1, base: 61.36, additional: 57.82 });
  assert.deepEqual(getDelhiverySlabRate('D', 500).slabs, 1);
  assert.equal(getDelhiverySlabRate('D', 501).amount, 61.36 + 57.82);
  assert.equal(getDelhiverySlabRate('D', 1000).slabs, 2);
  assert.equal(getDelhiverySlabRate('D', 1500).slabs, 3);
  assert.equal(getDelhiverySlabRate('D', 1501).slabs, 4);
  assert.throws(() => getDelhiverySlabRate('Z', 500), /Unknown Delhivery zone/);
});

test('rate table matches the Delhivery Surface card', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(DELHIVERY_SURFACE_RATES).map(([z, r]) => [z, [r.base, r.additional]])),
    {
      A: [35.4, 34.22],
      B: [38.94, 37.76],
      C: [51.92, 49.56],
      D: [61.36, 57.82],
      E: [75.52, 71.98],
      F: [88.5, 84.96]
    }
  );
});

test('getShippingQuote returns Delhivery zone quote with ceiled amount', async () => {
  const local = await getShippingQuote({
    env: defaultEnv,
    validatedCart: [{ weightGrams: 500, qty: 1 }],
    deliveryPincode: '431601'
  });
  assert.equal(local.carrier, 'delhivery');
  assert.equal(local.zone, 'A');
  assert.equal(local.courier.name, 'Delhivery Surface');
  // 500 g actual vs ~1062 g volumetric box -> 3 slabs: 35.40 + 2x34.22 = 103.84 -> 104
  assert.equal(local.amount, 104);

  const metro = await getShippingQuote({
    env: defaultEnv,
    validatedCart: [{ weightGrams: 1000, qty: 1 }],
    deliveryPincode: '400001'
  });
  assert.equal(metro.zone, 'D');
  // 1000 g actual vs ~1062 g volumetric -> 3 slabs: 61.36 + 2x57.82 = 177.00 -> 177
  assert.equal(metro.amount, 177);
});

test('getShippingQuote rejects bad pincodes', async () => {
  await assert.rejects(
    getShippingQuote({ env: defaultEnv, validatedCart: [{ weightGrams: 100, qty: 1 }], deliveryPincode: '123' }),
    /6-digit PIN/
  );
});

test('getEstimatedShippingAmount rounds up, 0 for junk', () => {
  assert.equal(getEstimatedShippingAmount({ providerAmount: undefined }), 0);
  assert.equal(getEstimatedShippingAmount({ providerAmount: 0 }), 0);
  assert.equal(getEstimatedShippingAmount({ providerAmount: 61.36 }), 62);
  assert.equal(getEstimatedShippingAmount({ providerAmount: 177.0 }), 177);
});

test('calculateShippingProfile uses Delhivery carrier and divisor', () => {
  const cart = [
    { weightGrams: 250, qty: 2 },
    { weightGrams: 500, qty: 1 }
  ];
  const profile = calculateShippingProfile(cart, defaultEnv);
  assert.equal(profile.carrier, 'delhivery');
  assert.equal(profile.actualWeightGrams, 1000);
  assert.equal(profile.actualWeightKg, 1);
  assert.equal(profile.chargeableWeightGrams, Math.max(1000, profile.volumetricWeightGrams));

  const fallback = calculateShippingProfile(cart, { DELHIVERY_VOLUMETRIC_DIVISOR: 'nope' });
  assert.equal(fallback.volumetricWeightGrams, profile.volumetricWeightGrams);
});

test('box height scales with quantity and caps at 4x the base', () => {
  const base = calculateShippingProfile([{ weightGrams: 100, qty: 1 }], defaultEnv);
  const capped = calculateShippingProfile([{ weightGrams: 100, qty: 10 }], defaultEnv);
  assert.equal(base.dimensions.heightCm, 15.24);
  assert.equal(capped.dimensions.heightCm, base.dimensions.heightCm * 4);
});
