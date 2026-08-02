import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fs = require('fs');

const token = process.env.SHIPROCKET_TOKEN;
const email = process.env.SHIPROCKET_EMAIL;
const password = process.env.SHIPROCKET_PASSWORD;

if (!token && (!email || !password)) {
  console.error('Set SHIPROCKET_TOKEN or SHIPROCKET_EMAIL + SHIPROCKET_PASSWORD');
  process.exit(1);
}

async function getToken() {
  if (token) return token;

  const response = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.token) {
    throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  }

  return data.token;
}

async function main() {
  const authToken = await getToken();
  const pickupPostcode = process.env.SHIPROCKET_PICKUP_PIN || '110001';
  const deliveryPostcode = process.env.DELIVERY_PIN || '110002';
  const weight = process.env.WEIGHT || '1';
  const cod = process.env.COD || '0';
  const declaredValue = process.env.DECLARED_VALUE || '1000';

  const params = new URLSearchParams({
    pickup_postcode: pickupPostcode,
    delivery_postcode: deliveryPostcode,
    weight,
    cod,
    mode: 'Surface',
    length: process.env.LENGTH || '15',
    breadth: process.env.BREADTH || '10',
    height: process.env.HEIGHT || '10',
    declared_value: declaredValue
  });

  const url = `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?${params}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json().catch(() => ({}));
  console.log('Status:', response.status);
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
