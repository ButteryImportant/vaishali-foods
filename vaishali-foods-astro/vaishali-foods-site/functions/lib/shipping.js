const INCH_TO_CM = 2.54;

let cachedToken = null;
let tokenExpiresAt = 0;
let cachedTokenKey = null;

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readJsonResponse(response) {
  const text = await response.text();
  return {
    text,
    data: parseJsonSafely(text)
  };
}

export function getEstimatedShippingAmount({ providerAmount }) {
  const amount = Number(providerAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return Math.round(amount);
}

export async function getShiprocketToken(env) {
  const now = Date.now();

  if (!env.SHIPROCKET_EMAIL || !env.SHIPROCKET_PASSWORD) {
    throw new Error('Shiprocket credentials are missing.');
  }

  const tokenKey = `${env.SHIPROCKET_EMAIL}:${env.SHIPROCKET_PASSWORD}`;

  if (cachedToken && cachedTokenKey === tokenKey && now < tokenExpiresAt) {
    return cachedToken;
  }

  const response = await fetch(
    'https://apiv2.shiprocket.in/v1/external/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: env.SHIPROCKET_EMAIL,
        password: env.SHIPROCKET_PASSWORD
      })
    }
  );

  const { text, data } = await readJsonResponse(response);

  if (!response.ok || !data?.token) {
    console.error('Shiprocket login error:', {
      status: response.status,
      body: text
    });

    throw new Error(
      data?.message ||
        `Unable to authenticate with Shiprocket (${response.status}).`
    );
  }

  cachedToken = data.token;
  cachedTokenKey = tokenKey;
  tokenExpiresAt = now + 23 * 60 * 60 * 1000;

  return cachedToken;
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
    height: String(Number(dimensions.heightCm) || 0),
    mode: 'Surface'
  });

  if (Number.isFinite(Number(declaredValue))) {
    params.set('declared_value', String(Math.round(Number(declaredValue))));
  }

  const response = await fetch(
    `https://apiv2.shiprocket.in/v1/external/courier/serviceability?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const { text, data } = await readJsonResponse(response);

  if (response.status === 401) {
    cachedToken = null;
    cachedTokenKey = null;
    tokenExpiresAt = 0;
  }

  if (!response.ok) {
    console.error('Shiprocket serviceability error:', {
      status: response.status,
      body: text
    });

    throw new Error(
      data?.message ||
        `Unable to calculate Shiprocket shipping (${response.status}).`
    );
  }

  const couriers =
    data?.data?.available_courier_companies ||
    data?.data?.available_counter_companies ||
    [];

  if (!Array.isArray(couriers) || couriers.length === 0) {
    throw new Error('No courier service is available for this PIN code.');
  }

  return couriers;
}

export function listAvailableCouriers(couriers) {
  return couriers
    .filter((courier) => {
      const rate = Number(courier.rate);
      return Number.isFinite(rate) && rate > 0 && courier.courier_company_id;
    })
    .map((courier) => ({
      id: courier.courier_company_id,
      name: courier.courier_name,
      amount: getEstimatedShippingAmount({ providerAmount: courier.rate }),
      providerAmount: Number(courier.rate),
      estimatedDeliveryDays: courier.estimated_delivery_days || null,
      etd: courier.etd || null,
      cod: courier.cod || 0,
      courierData: courier
    }))
    .sort((a, b) => a.providerAmount - b.providerAmount);
}

export async function getShippingQuoteOptions({
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

    const options = listAvailableCouriers(couriers);

    if (!options.length) {
      throw new Error('No valid courier options were found.');
    }

    return {
      ...profile,
      options
    };
  } catch (error) {
    console.error('Critical Shipping Interception Failure:', error);
    throw new Error(`Shipping calculation unavailable: ${error.message}`);
  }
}

export function selectCourierById(courierOptions, courierId) {
  const selected = courierOptions.find(
    (option) => String(option.id) === String(courierId)
  );

  if (!selected) {
    throw new Error('Selected courier is not available.');
  }

  return selected;
}

export async function createShiprocketShipment({
  env,
  customer,
  validatedCart,
  orderId,
  orderTotal,
  profile,
  paymentMethod = 'prepaid'
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
      name: `${item.name}${item.weight ? ` - ${item.weight}` : ''}`,
      sku: item.variantId,
      units: item.qty,
      selling_price: item.price,
      discount: 0,
      tax: 0,
      hsn: ''
    })),
    payment_method: paymentMethod === 'cod' ? 'COD' : 'Prepaid',
    sub_total: orderTotal,
    weight: profile.actualWeightKg,
    length: profile.dimensions.lengthCm,
    breadth: profile.dimensions.breadthCm,
    height: profile.dimensions.heightCm
  };

  const response = await fetch(
    'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  const { text, data } = await readJsonResponse(response);

  if (response.status === 401) {
    cachedToken = null;
    cachedTokenKey = null;
    tokenExpiresAt = 0;
  }

  if (!response.ok) {
    console.error('Shiprocket shipment error:', {
      status: response.status,
      body: text
    });

    throw new Error(
      data?.message ||
        `Shiprocket shipment creation failed (${response.status}).`
    );
  }

  return data;
}