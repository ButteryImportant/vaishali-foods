import { validateCart, calculateSubtotal } from '../lib/catalog.js';
import { getShippingQuote } from '../lib/shipping.js';
import { createDelhiveryShipment } from '../lib/delhivery.js';
import { createShiprocketShipment } from '../lib/shiprocket.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function safeEqual(first, second) {
  if (
    typeof first !== 'string' ||
    typeof second !== 'string' ||
    first.length !== second.length
  ) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < first.length; index += 1) {
    difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }
  return difference === 0;
}

async function createSignature(message, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );
  return bytesToHex(new Uint8Array(signature));
}

function validateCustomer(customer) {
  const required = [
    'name',
    'phone',
    'email',
    'addressLine1',
    'addressLine2',
    'city',
    'state',
    'pincode'
  ];

  if (!customer || required.some((key) => !String(customer[key] || '').trim())) {
    throw new Error('Missing customer delivery details.');
  }

  if (!/^[0-9]{10}$/.test(String(customer.phone))) {
    throw new Error('Enter a valid 10-digit phone number.');
  }

  if (!/^[1-9][0-9]{5}$/.test(String(customer.pincode))) {
    throw new Error('Enter a valid 6-digit PIN code.');
  }

  return Object.fromEntries(
    Object.entries(customer).map(([key, value]) => [key, String(value || '').trim()])
  );
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.RAZORPAY_KEY_SECRET) {
    return json({ error: 'Razorpay has not been configured on the server.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    cart,
    customer
  } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return json({ error: 'Missing payment verification fields.' }, 400);
  }

  const expectedSignature = await createSignature(
    `${razorpay_order_id}|${razorpay_payment_id}`,
    env.RAZORPAY_KEY_SECRET
  );

  if (!safeEqual(expectedSignature, razorpay_signature)) {
    return json(
      { success: false, error: 'Payment signature verification failed.' },
      400
    );
  }

  let validatedCart;
  let validatedCustomer;
  try {
    validatedCart = validateCart(cart);
    validatedCustomer = validateCustomer(customer);
  } catch (error) {
    return json(
      {
        success: true,
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
        shipmentCreated: false,
        shipmentError: error.message
      },
      200
    );
  }

  const subtotal = calculateSubtotal(validatedCart);
  let quote;
  try {
    quote = await getShippingQuote({
      env,
      validatedCart,
      deliveryPincode: validatedCustomer.pincode,
      orderValue: subtotal,
      paymentMethod: 'prepaid'
    });
  } catch (error) {
    console.error('Post-payment shipping quote failed:', error);
    return json({
      success: true,
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      shipmentCreated: false,
      shipmentError: error.message || 'Shipment quote failed after payment.'
    });
  }

  const internalOrderId = `VF-${Date.now()}-${razorpay_payment_id.slice(-6)}`;
  const orderTotal = subtotal + quote.amount;

  try {
    const shipment =
      quote.carrier === 'delhivery'
        ? await createDelhiveryShipment({
            env,
            customer: validatedCustomer,
            validatedCart,
            orderId: internalOrderId,
            paymentId: razorpay_payment_id,
            orderTotal,
            profile: quote
          })
        : await createShiprocketShipment({
            env,
            customer: validatedCustomer,
            validatedCart,
            orderId: internalOrderId,
            orderTotal,
            profile: quote
          });

    return json({
      success: true,
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      internalOrderId,
      shipmentCreated: true,
      carrier: quote.carrier,
      shipment
    });
  } catch (error) {
    console.error('Shipment creation failed after verified payment:', error);
    return json({
      success: true,
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      internalOrderId,
      shipmentCreated: false,
      carrier: quote.carrier,
      shipmentError:
        error.message || 'Shipment creation failed. Create it manually in the courier dashboard.'
    });
  }
}
