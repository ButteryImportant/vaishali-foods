const INCH_TO_CM = 2.54;

let cachedToken = null;
let tokenExpiresAt = 0;

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

// 1. AUTHENTICATION MODULE
export async function getShiprocketToken(env) {
  const now = Date.now();

  // Token freshness validation check
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  if (!env.SHIPROCKET_EMAIL || !env.SHIPROCKET_PASSWORD) {
    throw new Error('Shiprocket credentials are missing.');
  }

  // FIX: Restored the exact Shiprocket login address
  const response = await fetch(
    'https://shiprocket.in',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: env.SHIPROCKET_EMAIL,
        password: env.SHIPROCKET_PASSWORD
      })
    }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.token) {
    console.error('Shiprocket login error:', data);
    throw new Error('Unable to authenticate with Shiprocket.');
  }

  cachedToken = data.token;
  tokenExpiresAt = now + 23 * 60 * 60 * 1000; 
  return cachedToken;
}

// 2. SHIPPING PROFILE MATH MODULE
export function calculateShippingProfile(validatedCart, env) {
  const totalQuantity = validatedCart.reduce((total, item) => total + item.qty, 0);
  
  const actualWeightGrams = validatedCart.reduce(
    (total, item) => total + item.weightGrams * item.qty,
    0
  );

  const baseHeightInches = 6;
  const scaledHeightInches = baseHeightInches * Math.max(1, Math.min(totalQuantity, 4)); 

  const dimensions = {
    lengthCm: round(9 * INCH_TO_CM),
    breadthCm: round(6 * INCH_TO_CM),
    heightCm: round(scaledHeightInches * INCH_TO_CM)
  };

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
    actualWeightKg: round(actualWeightGrams / 1000, 3),
    dimensions
  };
}

// 3. SERVICEABILITY RATES FETCH MODULE
export async function getShippingRates({
  env,
  deliveryPincode,
  weight,
  dimensions,
  cod = false,
  declaredValue
}) {
  if (!env.SHIPROCKET_PICKUP_PIN) {
    throw new Error('Shiprocket pickup PIN is missing.');
  }

  const token = await getShiprocketToken(env);
  const params = new URLSearchParams({
    pickup_postcode: String(env.SHIPROCKET_PICKUP_PIN),
    delivery_postcode: String(deliveryPincode),
    weight: String(Number(weight) || 0),
    cod: cod ? '1' : '0',
    length: String(Number(dimensions.lengthCm) || 0),
    breadth: String(Number(dimensions.breadthCm) || 0),
    height: String(Number(dimensions.heightCm) || 0)
  });

  if (Number.isFinite(Number(declaredValue))) {
    params.set('declared_value', String(Math.round(Number(declaredValue))));
  }

  params.set('mode', 'Surface');

  // FIX: Restored the exact Shiprocket rate calculation address
  const response = await fetch(
    `https://shiprocket.in{params}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('Shiprocket serviceability error:', data);
    throw new Error(data?.message || 'Unable to calculate Shiprocket shipping.');
  }

  const couriers = data?.data?.available_courier_companies;
  if (!Array.isArray(couriers) || couriers.length === 0) {
    throw new Error('No courier service is available for this PIN code.');
  }

  return couriers;
}

// 4. SORTING CALCULATOR
export function selectCheapestCourier(couriers) {
  const validCouriers = couriers.filter((courier) => {
    const rate = Number(courier.rate);
    return Number.isFinite(rate) && rate > 0 && courier.courier_company_id;
  });

  if (validCouriers.length === 0) {
    throw new Error('No valid courier rate was found.');
  }

  // Double check sorting map layout configurations
  const sorted = validCouriers.sort((a, b) => Number(a.rate) - Number(b.rate));
  return sorted[0];
}

// 5. CHANNELS ENTRY POINT FOR ASTRO
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
    console.error("Critical Shipping Interception Failure:", error);
    throw new Error(`Shipping calculation unavailable: ${error.message}`);
  }
}

// 6. ORDER FULFILLMENT CREATION MODULE
export async function createShiprocketShipment({
  env,
  customer,
  validatedCart,
  orderId,
  orderTotal,
  profile
}) {
  if (!env.SHIPROCKET_PICKUP_LOCATION) {
    throw new Error('Shiprocket pickup location is missing.');
  }

  const token = await getShiprocketToken(env);
  const payload = {
    order_id: orderId,
    order_date: new Date().toISOString().slice(0, 10),
    pickup_location: env.SHIPROCKET_PICKUP_LOCATION,
    billing_customer_name: customer.name,
    billing_last_name: '',
    billing_address: customer.addressLine1,
    billing_address_2: [customer.addressLine2, customer.landmark]
      .filter(Boolean)
      .join(', '),
    billing_city: customer.city,
    billing_pincode: customer.pincode,
    billing_state: customer.state,
    billing_country: 'India',
    billing_email: customer.email,
    billing_phone: customer.phone,
    shipping_is_billing: true,
    order_items: validatedCart.map((item) => ({
      name: `${item.name} - ${item.weight || ''}`,
      sku: item.variantId,
      units: item.qty,
      selling_price: item.price,
      discount: 0,
      tax: 0,
      hsn: ''
    })),
    payment_method: 'Prepaid',
    sub_total: orderTotal,
    weight: profile.actualWeightKg,
    length: profile.dimensions.lengthCm,
    breadth: profile.dimensions.breadthCm,
    height: profile.dimensions.heightCm
  };

  // FIX: Restored the exact Shiprocket order shipment dispatch creation address
  const response = await fetch(
    'https://shiprocket.in',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('Shiprocket shipment error:', data);
    throw new Error(data?.message || 'Shiprocket shipment creation failed.');
  }

  return data;
}
