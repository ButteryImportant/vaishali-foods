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
3. Framework preset: **Astro**. Build command: `npm run build`
4. Build output directory: `dist`
5. Deploy. (The `postbuild.js` script converts Astro's `dist/server` output
   into `dist/_worker.js` which is what Pages expects — no extra setup needed.)

### Enable the admin panel storage (required for saving products/settings)

1. Cloudflare Dashboard → Storage & Databases → **KV** → Create a namespace
   (e.g. `vaishali-db`).
2. Workers & Pages → your project → **Settings → Functions → KV namespace bindings** →
   Add binding: Variable name `VAISHALI_DB`, value = your new namespace.
3. Redeploy (or Retry deployment). Until this is bound, the admin panel will
   show an explicit "VAISHALI_DB KV namespace is not bound" error instead of
   silently failing.

### Admin login

- Default username: `vaishali`, default password: `vaishali`.
- Change them immediately in **Settings → Variables and Secrets** by setting
  `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_TOKEN` (use a long random string).
- Open `/admin` on your deployed site to sign in.

## Before launch

- Replace `91XXXXXXXXXX` in `src/pages/index.astro` with your WhatsApp number.
- Replace placeholder product images.
- Confirm all prices, especially Khajoor Laddoo and Combo Pack.
- Add shipping, privacy, refund and terms pages.
- Razorpay and Shiprocket require a secure server-side Worker; do not place secret keys in frontend code.

## Courier routing and volumetric shipping

Shipping is calculated server-side in the Astro API routes (`src/pages/api/`).

- Orders with **actual product weight below 1000 g** use **Delhivery**.
- Orders with **actual product weight of 1000 g or more** use **Shiprocket**.
- Exactly 1000 g therefore uses Shiprocket.
- Below 1 kg uses the 9 × 6 × 3 inch package profile.
- 1 kg or above uses the 9 × 6 × 6 inch package profile.
- Chargeable weight is the higher of actual and volumetric weight.
- The default volumetric divisor is 5000 for both carriers and can be overridden with environment variables.

The trusted product prices and weights used by the backend are in `src/lib/catalog.js`.
Keep that file synchronized with `src/data/products.js` whenever products or pack sizes change.

### Required Cloudflare variables

Add these in **Cloudflare Dashboard → Workers & Pages → your project → Settings → Variables and Secrets**:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD` (Secret — encrypt it)
- `ADMIN_TOKEN` (Secret — encrypt it)
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET` (Secret)
- `PICKUP_PINCODE`
- `DELHIVERY_API_TOKEN` (Secret)
- `DELHIVERY_RATE_API_URL`
- `DELHIVERY_SHIPMENT_API_URL`
- `DELHIVERY_PICKUP_NAME`
- `DELHIVERY_VOLUMETRIC_DIVISOR`
- `SHIPROCKET_EMAIL`
- `SHIPROCKET_PASSWORD` (Secret)
- `SHIPROCKET_PICKUP_PIN`
- `SHIPROCKET_PICKUP_LOCATION`
- `SHIPROCKET_VOLUMETRIC_DIVISOR`

Use `.dev.vars.example` as the local template. Never commit `.dev.vars` or `.env`.
