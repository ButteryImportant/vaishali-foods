import { getShippingRates, selectCheapestCourier } from './shiprocket.js';

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
  // 1. Calculate total items to adjust volumetric box height dynamically
  const totalQuantity = validatedCart.reduce((total, item) => total + item.qty, 0);
  
  const actualWeightGrams = validatedCart.reduce(
    (total, item) => total + item.weightGrams * item.qty,
    0
  );

  // 2. Multi-item Box Sizing Logic
  // Avoids sending fixed tiny box dimensions when a customer orders large quantities
  const baseHeightInches = 6;
  const scaledHeightInches = baseHeightInches * Math.max(1, Math.min(totalQuantity, 4)); 

  const dimensions = {
    lengthCm: round(9 * INCH_TO_CM),
    breadthCm: round(6 * INCH_TO_CM),
    heightCm: round(scaledHeightInches * INCH_TO_CM)
  };

  // 3. Volumetric Weight Calculation
  const configuredDivisor = Number(env.SHIPROCKET_VOLUMETRIC_DIVISOR);
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
    actualWeightKg: round(actualWeightGrams / 1000, 3), // Passed to API to avoid inflated double-charging
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
  // Generate package metrics
  const profile = calculateShippingProfile(validatedCart, env);

  try {
    // Fire API request cleanly to Shiprocket using raw actual dead weight alongside box sizes
    const couriers = await getShippingRates({
      env,
      pickupPincode: env.PICKUP_PINCODE, // Pulls origin location parameter from .env
      deliveryPincode,
      weight: profile.actualWeightKg,    // Shiprocket internal math checks this vs dimensions
      dimensions: profile.dimensions,
      cod: paymentMethod === 'cod',
      declaredValue: orderValue
    });
    
    // Sort array automatically to slice the single cheapest available rate tier
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
    console.error("Critical Shiprocket Integration Failure:", error);
    // Explicitly bubble up the exact failure context to avoid silent checkout breaks
    throw new Error(`Shipping calculation unavailable: ${error.message}`);
  }
}