import {
  getShiprocketToken,
  getShippingRates,
  selectCheapestCourier,
  createShiprocketShipment
} from './shiprocket.js';

const INCH_TO_CM = 2.54;

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function getEstimatedShippingAmount({ providerAmount }) {
  const amount = Number(providerAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return Math.ceil(amount);
}

export function calculateShippingProfile(validatedCart, env) {
  const totalQuantity = validatedCart.reduce(
    (total, item) => total + item.qty,
    0
  );

  const actualWeightGrams = validatedCart.reduce(
    (total, item) => total + item.weightGrams * item.qty,
    0
  );

  const baseHeightInches = 6;
  const scaledHeightInches =
    baseHeightInches * Math.max(1, Math.min(totalQuantity, 4));

  const dimensions = {
    lengthCm: round(9 * INCH_TO_CM),
    breadthCm: round(6 * INCH_TO_CM),
    heightCm: round(scaledHeightInches * INCH_TO_CM)
  };

  const configuredDivisor = Number(env?.SHIPROCKET_VOLUMETRIC_DIVISOR);
  const volumetricDivisor =
    Number.isFinite(configuredDivisor) && configuredDivisor > 0
      ? configuredDivisor
      : 5000;

  const volumetricWeightKg =
    (dimensions.lengthCm * dimensions.breadthCm * dimensions.heightCm) /
    volumetricDivisor;

  const volumetricWeightGrams = Math.ceil(volumetricWeightKg * 1000);
  const chargeableWeightGrams = Math.max(
    actualWeightGrams,
    volumetricWeightGrams
  );

  return {
    carrier: 'shiprocket',
    actualWeightGrams,
    volumetricWeightGrams,
    chargeableWeightGrams,
    chargeableWeightKg: round(chargeableWeightGrams / 1000, 3),
    actualWeightKg: round(actualWeightGrams / 1000, 3),
    dimensions
  };
}

/**
 * Calculate standard fixed shipping cost based on weight tiers:
 * - 500g or less: ₹80
 * - Above 500g: ₹140
 */
export function getStandardShippingRate(weightGrams) {
  return weightGrams <= 500 ? 80 : 140;
}

export async function getShippingQuote({
  env,
  validatedCart,
  deliveryPincode,
  orderValue,
  paymentMethod = 'prepaid'
}) {
  const profile = calculateShippingProfile(validatedCart, env);
  const amount = getStandardShippingRate(profile.actualWeightGrams);

  return {
    ...profile,
    amount,
    carrier: 'standard',
    estimateSource: 'standard_tier',
    courier: {
      id: 'standard_courier',
      name: 'Standard Delivery',
      estimatedDeliveryDays: '3–7 days',
      etd: '3–7 business days'
    }
  };
}

export {
  getShiprocketToken,
  getShippingRates,
  selectCheapestCourier,
  createShiprocketShipment
};
