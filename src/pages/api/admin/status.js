import { getRuntimeEnv } from '../../../lib/runtime-env.js';

/**
 * Public diagnostics for deployment troubleshooting.
 * Returns booleans only - never secret values.
 * Visit https://<your-site>/api/admin/status to check the live deployment.
 */
export const GET = async (context) => {
  const env = await getRuntimeEnv(context);

  return new Response(
    JSON.stringify({
      ok: true,
      kvBound: !!env.VAISHALI_DB,
      razorpayConfigured: !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
      delhiveryConfigured: !!env.DELHIVERY_API_TOKEN,
      pickupPincode: env.PICKUP_PINCODE || '431605 (default)',
      timestamp: new Date().toISOString()
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    }
  );
};
