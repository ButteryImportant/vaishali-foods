import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEstimatedShippingAmount,
  calculateShippingProfile
} from './shipping.js';
import { selectCheapestCourier } from './shiprocket.js';

const defaultEnv = { SHIPROCKET_VOLUMETRIC_DIVISOR: '5000' };

test('getEstimatedShippingAmount returns 0 for missing, invalid, zero or negative rates', () => {
  assert.equal(getEstimatedShippingAmount({ providerAmount: undefined }), 0);
  assert.equal(getEstimatedShippingAmount({ providerAmount: 'abc' }), 0);
  assert.equal(getEstimatedShippingAmount({ providerAmount: 0 }), 0);
  assert.equal(getEstimatedShippingAmount({ providerAmount: -10 }), 0);
});

test('getEstimatedShippingAmount rounds up to the next rupee', () => {
  assert.equal(getEstimatedShippingAmount({ providerAmount: 49.2 }), 50);
  assert.equal(getEstimatedShippingAmount({ providerAmount: 100.01 }), 101);
  assert.equal(getEstimatedShippingAmount({ providerAmount: 100 }), 100);
});

test('calculateShippingProfile computes dead weight correctly', () => {
  const cart = [
    { weightGrams: 250, qty: 2 },
    { weightGrams: 500, qty: 1 }
  ];

  const profile = calculateShippingProfile(cart, defaultEnv);

  assert.equal(profile.carrier, 'shiprocket');
  assert.equal(profile.actualWeightGrams, 1000);
  assert.equal(profile.actualWeightKg, 1);
  assert.equal(
    profile.chargeableWeightGrams,
    Math.max(1000, profile.volumetricWeightGrams)
  );
  assert.ok(profile.chargeableWeightKg >= profile.actualWeightKg);
});

test('calculateShippingProfile falls back to divisor 5000 when unset or invalid', () => {
  const cart = [{ weightGrams: 100, qty: 1 }];

  const defaultProfile = calculateShippingProfile(cart, defaultEnv);
  const invalidEnvProfile = calculateShippingProfile(cart, {
    SHIPROCKET_VOLUMETRIC_DIVISOR: 'not-a-number'
  });
  const higherDivisorProfile = calculateShippingProfile(cart, {
    SHIPROCKET_VOLUMETRIC_DIVISOR: '7000'
  });

  assert.equal(
    defaultProfile.volumetricWeightGrams,
    invalidEnvProfile.volumetricWeightGrams
  );
  assert.ok(
    defaultProfile.volumetricWeightGrams > higherDivisorProfile.volumetricWeightGrams
  );
});

test('box height scales with quantity and caps at 4x the base', () => {
  const base = calculateShippingProfile(
    [{ weightGrams: 100, qty: 1 }],
    defaultEnv
  );
  const capped = calculateShippingProfile(
    [{ weightGrams: 100, qty: 10 }],
    defaultEnv
  );

  assert.equal(base.dimensions.heightCm, 15.24);
  assert.equal(capped.dimensions.heightCm, base.dimensions.heightCm * 4);
});

test('selectCheapestCourier ignores invalid rates and picks the lowest valid one', () => {
  const couriers = [
    { courier_company_id: 1, rate: '90', courier_name: 'Express' },
    { courier_company_id: 2, rate: '45.5', courier_name: 'Cheapest' },
    { courier_company_id: 3, rate: '0', courier_name: 'Free' },
    { courier_company_id: 4, rate: 'abc', courier_name: 'Broken' }
  ];

  assert.equal(selectCheapestCourier(couriers).courier_company_id, 2);
});

test('selectCheapestCourier throws when no courier has a valid rate', () => {
  const couriers = [{ courier_company_id: 1, rate: '0', courier_name: 'Free' }];

  assert.throws(() => selectCheapestCourier(couriers), /No valid courier rate/);
});
