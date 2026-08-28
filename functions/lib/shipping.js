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

export async function getShippingQuote({
  env,
  validatedCart,
  deliveryPincode,
  orderValue,
  paymentMethod = 'prepaid'
}) {
  const profile = calculateShippingProfile(validatedCart, env);

  try {
    const couriers = await getShippingRates({
      env,
      deliveryPincode,
      weight: profile.actualWeightKg,
      dimensions: profile.dimensions,
      cod: paymentMethod === 'cod',
      declaredValue: orderValue
    });

    const cheapest = selectCheapestCourier(couriers);
    const amount = getEstimatedShippingAmount({
      providerAmount: cheapest.rate
    });

    return {
      ...profile,
      amount,
      estimateSource: 'provider',
      courier: {
        id: cheapest.courier_company_id,
        name: cheapest.courier_name,
        estimatedDeliveryDays: cheapest.estimated_delivery_days || null,
        etd: cheapest.etd || null
      }
    };
  } catch (error) {
    console.error('Shipping rate failure:', error);
    throw new Error(`Shipping calculation unavailable: ${error.message}`);
  }
}

export {
  getShiprocketToken,
  getShippingRates,
  selectCheapestCourier,
  createShiprocketShipment
};
