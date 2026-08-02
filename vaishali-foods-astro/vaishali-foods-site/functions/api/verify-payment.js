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

async function createSignature(message, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return bytesToHex(new Uint8Array(signature));
}

function safeEqual(first, second) {
  if (typeof first !== 'string' || typeof second !== 'string' || first.length !== second.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < first.length; index += 1) {
    difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }
  return difference === 0;
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

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return json({ error: 'Missing payment verification fields.' }, 400);
  }

  const expectedSignature = await createSignature(
    `${razorpay_order_id}|${razorpay_payment_id}`,
    env.RAZORPAY_KEY_SECRET
  );

  if (!safeEqual(expectedSignature, razorpay_signature)) {
    return json({ success: false, error: 'Payment signature verification failed.' }, 400);
  }

  return json({
    success: true,
    payment_id: razorpay_payment_id,
    order_id: razorpay_order_id,
    message: 'Payment verified.'
  });
}
