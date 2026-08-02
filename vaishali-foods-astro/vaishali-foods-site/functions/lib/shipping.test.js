import test from 'node:test';
import assert from 'node:assert/strict';
import { getEstimatedShippingAmount } from './shipping.js';

test('returns a sensible estimate for a 1.5kg order', () => {
  const profile = {
    actualWeightGrams: 1500,
    chargeableWeightGrams: 1500
  };

  assert.equal(getEstimatedShippingAmount({ profile }), 80);
});

test('returns a lower estimate for a light order', () => {
  const profile = {
    actualWeightGrams: 800,
    chargeableWeightGrams: 800
  };

  assert.equal(getEstimatedShippingAmount({ profile }), 60);
});
