# Vaishali Foods — Astro storefront

A mobile-first branded storefront prepared for Cloudflare Pages.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Cloudflare Pages

1. Push this folder to a GitHub repository.
2. In Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Deploy.

## Before launch

- Replace `91XXXXXXXXXX` in `src/pages/index.astro` with your WhatsApp number.
- Replace placeholder product images.
- Confirm all prices, especially Khajoor Laddoo and Combo Pack.
- Add shipping, privacy, refund and terms pages.
- Razorpay and Shiprocket require a secure server-side Worker; do not place secret keys in frontend code.

## Courier routing and volumetric shipping

Shipping is calculated server-side in Cloudflare Pages Functions.

- Orders with **actual product weight below 1000 g** use **Delhivery**.
- Orders with **actual product weight of 1000 g or more** use **Shiprocket**.
- Exactly 1000 g therefore uses Shiprocket.
- Below 1 kg uses the 9 × 6 × 3 inch package profile.
- 1 kg or above uses the 9 × 6 × 6 inch package profile.
- Chargeable weight is the higher of actual and volumetric weight.
- The default volumetric divisor is 5000 for both carriers and can be overridden with environment variables.

The trusted product prices and weights used by the backend are in `functions/lib/catalog.js`. Keep that file synchronized with `src/data/products.js` whenever products or pack sizes change. The 9-piece combo is currently configured as 400 g; change both files if its measured net weight differs.

### Required Cloudflare variables

Add these in **Cloudflare Dashboard → Workers & Pages → your project → Settings → Variables and Secrets**:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `PICKUP_PINCODE`
- `DELHIVERY_API_TOKEN`
- `DELHIVERY_RATE_API_URL`
- `DELHIVERY_SHIPMENT_API_URL`
- `DELHIVERY_PICKUP_NAME`
- `DELHIVERY_VOLUMETRIC_DIVISOR`
- `SHIPROCKET_EMAIL`
- `SHIPROCKET_PASSWORD`
- `SHIPROCKET_PICKUP_PIN`
- `SHIPROCKET_PICKUP_LOCATION`
- `SHIPROCKET_VOLUMETRIC_DIVISOR`

Use `.dev.vars.example` as the local template. Never commit `.dev.vars` or `.env`.

