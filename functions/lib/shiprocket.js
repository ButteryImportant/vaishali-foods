let cachedToken = null;
let tokenExpiresAt = 0;
let cachedTokenKey = null;

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

export async function getShiprocketToken(env) {
  const now = Date.now();

  const tokenKey = env?.SHIPROCKET_EMAIL && env?.SHIPROCKET_PASSWORD
    ? `${env.SHIPROCKET_EMAIL}:${env.SHIPROCKET_PASSWORD}`
    : null;

  if (cachedToken && tokenKey && cachedTokenKey === tokenKey && now < tokenExpiresAt) {
    return cachedToken;
  }

  if (!env.SHIPROCKET_EMAIL || !env.SHIPROCKET_PASSWORD) {
    throw new Error('Shiprocket credentials are missing.');
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

export function selectCheapestCourier(couriers) {
  const validCouriers = couriers.filter((courier) => {
    const rate = Number(courier.rate);
    return Number.isFinite(rate) && rate > 0 && courier.courier_company_id;
  });

  if (validCouriers.length === 0) {
    throw new Error('No valid courier rate was found.');
  }

  return validCouriers.sort((a, b) => Number(a.rate) - Number(b.rate))[0];
}

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
