/**
 * Delhivery shipment creation (used after successful Razorpay payment).
 * Shipping RATES are calculated offline in shipping.js from the
 * Delhivery Surface zone table; this file only books the shipment.
 */
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
