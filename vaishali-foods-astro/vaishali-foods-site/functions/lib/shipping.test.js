import test from 'node:test';
import assert from 'node:assert/strict';
import { getEstimatedShippingAmount } from './shipping.js';

test('uses a fallback shipping charge for implausibly high courier quotes', () => {
  const profile = {
    actualWeightGrams: 1500,
    chargeableWeightGrams: 1500
  };

  assert.equal(
    getEstimatedShippingAmount({ providerAmount: 500, profile, orderValue: 1000 }),
    70
  );
});

test('keeps a reasonable courier quote when it is already in range', () => {
  const profile = {
    actualWeightGrams: 800,
    chargeableWeightGrams: 800
  };

  assert.equal(
    getEstimatedShippingAmount({ providerAmount: 55, profile, orderValue: 800 }),
    55
  );
});
