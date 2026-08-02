let cachedToken = null;
let tokenExpiresAt = 0;

export async function getShiprocketToken(env) {
  const now = Date.now();

  if (cachedToken && now < tokenExpiresAt) {
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
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.token) {
    console.error('Shiprocket login error:', data);
    throw new Error('Unable to authenticate with Shiprocket.');
  }

  cachedToken = data.token;
  tokenExpiresAt = now + 9 * 24 * 60 * 60 * 1000;
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
    pickup_postcode: env.SHIPROCKET_PICKUP_PIN,
    delivery_postcode: deliveryPincode,
    weight: String(weight),
    cod: cod ? '1' : '0',
    length: String(dimensions.lengthCm),
    breadth: String(dimensions.breadthCm),
    height: String(dimensions.heightCm)
  });

  if (Number.isFinite(Number(declaredValue))) {
    params.set('declared_value', String(Math.round(Number(declaredValue))));
  }

  const response = await fetch(
    `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?${params}`,
    {
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

export function selectCheapestCourier(couriers) {
  const validCouriers = couriers.filter((courier) => {
    const rate = Number(courier.rate);
    return Number.isFinite(rate) && rate > 0 && courier.courier_company_id;
  });

  if (validCouriers.length === 0) {
    throw new Error('No valid courier rate was found.');
  }

  // Shiprocket's serviceability API can return multiple courier options.
  // The checkout UI should reflect the primary serviceability option returned
  // by Shiprocket rather than the absolute cheapest rate, which can differ from
  // the quote shown in Shiprocket's own panel.
  return validCouriers[0];
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
      name: `${item.name} - ${item.weight}`,
      sku: item.variantId,
      units: item.qty,
      selling_price: item.price,
      discount: 0,
      tax: 0,
      hsn: ''
    })),
    payment_method: 'Prepaid',
    sub_total: orderTotal,
    weight: profile.actualWeightGrams / 1000,
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
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('Shiprocket shipment error:', data);
    throw new Error(data?.message || 'Shiprocket shipment creation failed.');
  }

  return data;
}
