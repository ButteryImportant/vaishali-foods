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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: env.SHIPROCKET_EMAIL,
        password: env.SHIPROCKET_PASSWORD
      })
    }
  );

  const data = await response.json();

  if (!response.ok || !data.token) {
    console.error('Shiprocket login error:', data);
    throw new Error('Unable to authenticate with Shiprocket.');
  }

  cachedToken = data.token;

  // Refresh before Shiprocket's token expires.
  tokenExpiresAt = now + 9 * 24 * 60 * 60 * 1000;

  return cachedToken;
}

export async function getShippingRates({
  env,
  deliveryPincode,
  weight,
  cod = false
}) {
  const token = await getShiprocketToken(env);

  const params = new URLSearchParams({
    pickup_postcode: env.SHIPROCKET_PICKUP_PIN,
    delivery_postcode: deliveryPincode,
    weight: String(weight),
    cod: cod ? '1' : '0'
  });

  const response = await fetch(
    `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?${params}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error('Shiprocket serviceability error:', data);
    throw new Error('Unable to calculate shipping.');
  }

  const couriers =
    data?.data?.available_courier_companies;

  if (!Array.isArray(couriers) || couriers.length === 0) {
    throw new Error(
      'No courier service is available for this PIN code.'
    );
  }

  return couriers;
}

export function selectCheapestCourier(couriers) {
  const validCouriers = couriers.filter((courier) => {
    const rate = Number(courier.rate);

    return (
      Number.isFinite(rate) &&
      rate > 0 &&
      courier.courier_company_id
    );
  });

  if (validCouriers.length === 0) {
    throw new Error('No valid courier rate was found.');
  }

  return validCouriers.reduce((cheapest, courier) => {
    return Number(courier.rate) < Number(cheapest.rate)
      ? courier
      : cheapest;
  });
}