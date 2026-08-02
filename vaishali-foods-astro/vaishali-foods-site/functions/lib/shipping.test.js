import test from 'node:test';
import assert from 'node:assert/strict';
import { getEstimatedShippingAmount } from './shipping.js';

test('returns the provider rate directly', () => {
  assert.equal(getEstimatedShippingAmount({ providerAmount: 226 }), 226);
});

test('returns zero when the provider rate is missing', () => {
  assert.equal(getEstimatedShippingAmount({ providerAmount: 0 }), 0);
});
