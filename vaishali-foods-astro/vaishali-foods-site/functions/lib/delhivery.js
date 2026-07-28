function extractRate(data) {
  const candidates = [
    data?.total_amount,
    data?.total_charge,
    data?.amount,
    data?.charge,
    data?.data?.total_amount,
    data?.data?.total_charge,
    Array.isArray(data) ? data[0]?.total_amount : undefined,
    Array.isArray(data) ? data[0]?.total_charge : undefined
  ];

  return candidates.map(Number).find((value) => Number.isFinite(value) && value >= 0);
}

export async function getDelhiveryRate({
  env,
  deliveryPincode,
  orderValue,
  paymentMethod,
  profile
}) {
  if (!env.DELHIVERY_API_TOKEN || !env.DELHIVERY_RATE_API_URL || !env.PICKUP_PINCODE) {
    throw new Error('Delhivery rate API has not been configured on the server.');
  }

  const params = new URLSearchParams({
    origin_pin: env.PICKUP_PINCODE,
    destination_pin: deliveryPincode,
    weight: String(profile.chargeableWeightGrams),
    length: String(profile.dimensions.lengthCm),
    width: String(profile.dimensions.breadthCm),
    height: String(profile.dimensions.heightCm),
    payment_mode: paymentMethod === 'cod' ? 'COD' : 'Prepaid',
    cod_amount: paymentMethod === 'cod' ? String(Math.round(orderValue)) : '0'
  });

  const separator = env.DELHIVERY_RATE_API_URL.includes('?') ? '&' : '?';
  const response = await fetch(
    `${env.DELHIVERY_RATE_API_URL}${separator}${params.toString()}`,
    {
      headers: {
        Authorization: `Token ${env.DELHIVERY_API_TOKEN}`,
        Accept: 'application/json'
      }
    }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('Delhivery rate error:', data);
    throw new Error(data?.message || 'Unable to calculate Delhivery shipping.');
  }

  const amount = extractRate(data);
  if (!Number.isFinite(amount)) {
    console.error('Unexpected Delhivery rate response:', data);
    throw new Error('Delhivery returned an unexpected rate response.');
  }

  return {
    amount,
    estimatedDeliveryDays: data?.estimated_days ?? data?.data?.estimated_days ?? null,
    etd: data?.etd ?? data?.tat ?? data?.data?.etd ?? null
  };
}

export async function createDelhiveryShipment({
  env,
  customer,
  validatedCart,
  orderId,
  paymentId,
  orderTotal,
  profile
}) {
  if (!env.DELHIVERY_API_TOKEN || !env.DELHIVERY_PICKUP_NAME) {
    throw new Error('Delhivery shipment API has not been configured on the server.');
  }

  const shipment = {
    name: customer.name,
    add: [customer.addressLine1, customer.addressLine2, customer.landmark]
      .filter(Boolean)
      .join(', '),
    pin: customer.pincode,
    city: customer.city,
    state: customer.state,
    country: 'India',
    phone: customer.phone,
    order: orderId,
    payment_mode: 'Prepaid',
    cod_amount: 0,
    products_desc: validatedCart
      .map((item) => `${item.name} (${item.weight}) x ${item.qty}`)
      .join(', '),
    total_amount: orderTotal,
    weight: profile.actualWeightGrams,
    shipment_length: profile.dimensions.lengthCm,
    shipment_width: profile.dimensions.breadthCm,
    shipment_height: profile.dimensions.heightCm,
    seller_name: 'Vaishali Foods',
    seller_inv: paymentId
  };

  const body = new URLSearchParams({
    format: 'json',
    data: JSON.stringify({
      shipments: [shipment],
      pickup_location: { name: env.DELHIVERY_PICKUP_NAME }
    })
  });

  const response = await fetch(
    env.DELHIVERY_SHIPMENT_API_URL || 'https://track.delhivery.com/api/cmu/create.json',
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${env.DELHIVERY_API_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.success === false) {
    console.error('Delhivery shipment error:', data);
    throw new Error(data?.message || 'Delhivery shipment creation failed.');
  }

  return data;
}
