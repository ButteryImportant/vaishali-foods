import { getShippingRates, selectCheapestCourier } from './shiprocket.js';
import { getDelhiveryRate } from './delhivery.js';

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
  const actualWeightGrams = validatedCart.reduce(
    (total, item) => total + item.weightGrams * item.qty,
    0
  );

  // User rule: below 1 kg = Delhivery; exactly 1 kg or more = Shiprocket.
  const carrier = actualWeightGrams < 1000 ? 'delhivery' : 'shiprocket';
  const heightInches = actualWeightGrams < 1000 ? 3 : 6;
  const dimensions = {
    lengthCm: round(9 * INCH_TO_CM),
    breadthCm: round(6 * INCH_TO_CM),
    heightCm: round(heightInches * INCH_TO_CM)
  };

  const configuredDivisor = Number(
    carrier === 'delhivery'
      ? env.DELHIVERY_VOLUMETRIC_DIVISOR
      : env.SHIPROCKET_VOLUMETRIC_DIVISOR
  );
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
    carrier,
    actualWeightGrams,
    volumetricWeightGrams,
    chargeableWeightGrams,
    chargeableWeightKg: round(chargeableWeightGrams / 1000, 3),
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

  if (profile.carrier === 'delhivery') {
    const rate = await getDelhiveryRate({
      env,
      deliveryPincode,
      orderValue,
      paymentMethod,
      profile
    });

    return {
      ...profile,
      amount: Math.ceil(Number(rate.amount)),
      courier: {
        id: null,
        name: 'Delhivery',
        estimatedDeliveryDays: rate.estimatedDeliveryDays || null,
        etd: rate.etd || null
      }
    };
  }

  try {
    const couriers = await getShippingRates({
      env,
      deliveryPincode,
      weight: profile.chargeableWeightKg,
      dimensions: profile.dimensions,
      cod: paymentMethod === 'cod',
      declaredValue: orderValue
    });
    const cheapest = selectCheapestCourier(couriers);

    const amount = getEstimatedShippingAmount({ providerAmount: cheapest.rate });

    return {
      ...profile,
      amount,
      courier: {
        id: cheapest.courier_company_id,
        name: cheapest.courier_name,
        estimatedDeliveryDays: cheapest.estimated_delivery_days || null,
        etd: cheapest.etd || null
      }
    };
  } catch (error) {
    const delhiveryConfigured =
      env.DELHIVERY_API_TOKEN &&
      env.DELHIVERY_RATE_API_URL &&
      env.PICKUP_PINCODE;

    if (!delhiveryConfigured) {
      throw error;
    }

    const rate = await getDelhiveryRate({
      env,
      deliveryPincode,
      orderValue,
      paymentMethod,
      profile
    });

    return {
      carrier: 'delhivery',
      actualWeightGrams: profile.actualWeightGrams,
      volumetricWeightGrams: profile.volumetricWeightGrams,
      chargeableWeightGrams: profile.chargeableWeightGrams,
      chargeableWeightKg: profile.chargeableWeightKg,
      dimensions: profile.dimensions,
      amount: Math.ceil(Number(rate.amount)),
      courier: {
        id: null,
        name: 'Delhivery',
        estimatedDeliveryDays: rate.estimatedDeliveryDays || null,
        etd: rate.etd || null
      }
    };
  }
}
